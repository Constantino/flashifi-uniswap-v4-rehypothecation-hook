// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager, SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LiquidityMath} from "@uniswap/v4-core/src/libraries/LiquidityMath.sol";
// import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";

import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {toBalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {Position} from "@uniswap/v4-core/src/libraries/Position.sol";
import {CurrencySettler} from "@openzeppelin/uniswap-hooks/src/utils/CurrencySettler.sol";

contract ReHypothecation is BaseHook, ERC20 {
    using TransientStateLibrary for IPoolManager;
    using StateLibrary for IPoolManager;
    using CurrencySettler for Currency;

    using PoolIdLibrary for PoolKey;
    using SafeERC20 for IERC20;
    using SafeCast for *;

    error InvalidCurrency();
    error ZeroLiquidity();
    error InvalidAmounts();
    error PoolKeyNotInitialized();
    error AlreadyInitialized();

    PoolKey private _poolKey;

    address private _vault0;
    address private _vault1;

    // NOTE: ---------------------------------------------------------
    // state variables should typically be unique to a pool
    // a single hook contract should be able to service multiple pools
    // ---------------------------------------------------------------

    mapping(PoolId => uint256 count) public beforeSwapCount;
    mapping(PoolId => uint256 count) public afterSwapCount;

    mapping(PoolId => uint256 count) public beforeAddLiquidityCount;
    mapping(PoolId => uint256 count) public beforeRemoveLiquidityCount;

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) ERC20("FlashiFiReHypothecation", "FFRH") {}

    function setVaults(address vault0_, address vault1_) external {
        _vault0 = vault0_;
        _vault1 = vault1_;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function addReHypothecatedLiquidity(uint128 liquidity) external payable returns (BalanceDelta delta) {
        if (_poolKey.currency1.isAddressZero()) revert PoolKeyNotInitialized();

        if (liquidity == 0) revert ZeroLiquidity();

        delta = _getDeltaForDepositedShares(liquidity);

        uint256 amount0 = uint256(int256(-delta.amount0()));
        uint256 amount1 = uint256(int256(-delta.amount1()));

        IERC20(Currency.unwrap(_poolKey.currency0)).safeTransferFrom(msg.sender, address(this), amount0);

        IERC20(Currency.unwrap(_poolKey.currency1)).safeTransferFrom(msg.sender, address(this), amount1);

        _depositToVault(_poolKey.currency0, amount0);
        _depositToVault(_poolKey.currency1, amount1);

        _mint(msg.sender, liquidity);
    }

    function removeReHypothecatedLiquidity(address owner) external returns (BalanceDelta delta) {
        if (_poolKey.currency1.isAddressZero()) revert PoolKeyNotInitialized();

        uint256 sharesAmount = balanceOf(owner);
        if (sharesAmount == 0) revert ZeroLiquidity();

        delta = _getDeltaForWithdrawnShares(sharesAmount);

        uint256 amount0 = uint256(int256(delta.amount0()));
        uint256 amount1 = uint256(int256(delta.amount1()));

        _burn(owner, sharesAmount);

        _withdrawFromVault(_poolKey.currency0, amount0);
        _withdrawFromVault(_poolKey.currency1, amount1);

        _poolKey.currency0.transfer(owner, amount0);
        _poolKey.currency1.transfer(owner, amount1);

        // emit ReHypothecatedLiquidityRemoved(owner, uint128(sharesAmount), amount0, amount1);
    }

    function _getLiquidityToUse(PoolKey calldata key, SwapParams calldata)
        internal
        virtual
        returns (uint128 liquidity)
    {
        uint256 balanceVault0 = IERC4626(getVaultAddress(key.currency0)).balanceOf(address(this));
        uint256 balanceVault1 = IERC4626(getVaultAddress(key.currency1)).balanceOf(address(this));

        uint256 assetsCurrency0 = IERC4626(getVaultAddress(key.currency0)).convertToAssets(balanceVault0);
        uint256 assetsCurrency1 = IERC4626(getVaultAddress(key.currency1)).convertToAssets(balanceVault1);

        (uint160 currentSqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        liquidity = LiquidityAmounts.getLiquidityForAmounts(
            currentSqrtPriceX96,
            TickMath.getSqrtPriceAtTick(getTickLower()),
            TickMath.getSqrtPriceAtTick(getTickUpper()),
            assetsCurrency0,
            assetsCurrency1
        );
    }

    function _modifyLiquidity(int256 liquidityDelta) internal virtual returns (BalanceDelta delta) {
        (delta,) = poolManager.modifyLiquidity(
            _poolKey,
            ModifyLiquidityParams({
                tickLower: getTickLower(),
                tickUpper: getTickUpper(),
                liquidityDelta: liquidityDelta,
                salt: bytes32(0)
            }),
            ""
        );
    }

    function _getDeltaForWithdrawnShares(uint256 sharesAmount) internal virtual returns (BalanceDelta delta) {
        address yieldSource0 = getVaultAddress(_poolKey.currency0);
        address yieldSource1 = getVaultAddress(_poolKey.currency1);

        uint256 totalSharesCurrency0 = IERC4626(yieldSource0).maxWithdraw(address(this));
        uint256 totalSharesCurrency1 = IERC4626(yieldSource1).maxWithdraw(address(this));

        uint256 amount0 = FullMath.mulDiv(sharesAmount, totalSharesCurrency0, totalSupply());
        uint256 amount1 = FullMath.mulDiv(sharesAmount, totalSharesCurrency1, totalSupply());

        delta = toBalanceDelta(int256(amount0).toInt128(), int256(amount1).toInt128());
    }

    function _depositToVault(Currency currency, uint256 amount) internal {
        if (currency.isAddressZero()) {
            revert InvalidCurrency();
        }

        address vault = getVaultAddress(currency);
        IERC20(Currency.unwrap(currency)).approve(vault, amount);
        IERC4626(vault).deposit(amount, address(this));
    }

    function getVaultAddress(Currency currency) public view returns (address) {
        PoolKey memory key = _poolKey;
        if (key.currency0 == currency) return _vault0;
        if (key.currency1 == currency) return _vault1;
        revert InvalidCurrency();
    }

    function _getDeltaForDepositedShares(uint128 liquidity) internal virtual returns (BalanceDelta delta) {
        int24 tickLower = getTickLower();
        int24 tickUpper = getTickUpper();

        (uint160 currentSqrtPriceX96, int24 currentTick,,) = poolManager.getSlot0(_poolKey.toId());

        delta = _calculateDeltaForLiquidity(liquidity, currentTick, tickLower, tickUpper, currentSqrtPriceX96);

        if (delta.amount0() > 0 || delta.amount1() > 0) {
            revert InvalidAmounts();
        }
    }

    function _withdrawFromVault(Currency currency, uint256 amount) internal virtual {
        address vault = getVaultAddress(currency);
        IERC4626(vault).withdraw(amount, address(this), address(this));
    }

    function _calculateDeltaForLiquidity(
        uint128 liquidity,
        int24 currentTick,
        int24 tickLower,
        int24 tickUpper,
        uint160 currentSqrtPriceX96
    ) internal pure returns (BalanceDelta delta) {
        if (currentTick < tickLower) {
            delta = toBalanceDelta(
                SqrtPriceMath.getAmount0Delta(
                    TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), int128(liquidity)
                ).toInt128(),
                0
            );
        } else if (currentTick < tickUpper) {
            delta = toBalanceDelta(
                SqrtPriceMath.getAmount0Delta(
                    currentSqrtPriceX96, TickMath.getSqrtPriceAtTick(tickUpper), int128(liquidity)
                ).toInt128(),
                SqrtPriceMath.getAmount1Delta(
                    TickMath.getSqrtPriceAtTick(tickLower), currentSqrtPriceX96, int128(liquidity)
                ).toInt128()
            );
        } else {
            delta = toBalanceDelta(
                0,
                SqrtPriceMath.getAmount1Delta(
                    TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), int128(liquidity)
                ).toInt128()
            );
        }
    }

    function getTickLower() public view virtual returns (int24) {
        return TickMath.minUsableTick(_poolKey.tickSpacing);
    }

    function getTickUpper() public view virtual returns (int24) {
        return TickMath.maxUsableTick(_poolKey.tickSpacing);
    }

    // -----------------------------------------------
    // NOTE: see IHooks.sol for function documentation
    // -----------------------------------------------

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // beforeSwapCount[key.toId()]++;

        // Get the amount of liquidity to be provided from yield sources
        uint128 liquidityToUse = _getLiquidityToUse(key, params);

        // If there's liquidity to be provided, add it to the pool (in a Just-in-Time provision of liquidity)
        if (liquidityToUse > 0) {
            _modifyLiquidity(liquidityToUse.toInt256());
        }

        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        // afterSwapCount[key.toId()]++;

        // Get the hook owned liquidity currently in the pool
        uint128 liquidity = _getHookLiquidity(key);
        if (liquidity == 0) {
            return (this.afterSwap.selector, 0);
        }
        // Remove all of the hook owned liquidity from the pool
        _modifyLiquidity(-liquidity.toInt256());

        // Assert the hook's deltas in each currency in order to zero them
        _assertHookDelta(key.currency0);
        _assertHookDelta(key.currency1);

        return (this.afterSwap.selector, 0);
    }

    function _getHookLiquidity(PoolKey calldata key) internal virtual returns (uint128 liquidity) {
        bytes32 positionKey = Position.calculatePositionKey(address(this), getTickLower(), getTickUpper(), bytes32(0));
        liquidity = poolManager.getPositionLiquidity(key.toId(), positionKey);
    }

    function _assertHookDelta(Currency currency) internal virtual {
        int256 currencyDelta = poolManager.currencyDelta(address(this), currency);
        if (currencyDelta > 0) {
            currency.take(poolManager, address(this), uint256(currencyDelta), false);
            _depositToVault(currency, uint256(currencyDelta));
        }
        if (currencyDelta < 0) {
            _withdrawFromVault(currency, uint256(-currencyDelta));
            currency.settle(poolManager, address(this), uint256(-currencyDelta), false);
        }
    }

    function _beforeAddLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, bytes calldata)
        internal
        override
        returns (bytes4)
    {
        beforeAddLiquidityCount[key.toId()]++;
        return BaseHook.beforeAddLiquidity.selector;
    }

    function _beforeRemoveLiquidity(address, PoolKey calldata key, ModifyLiquidityParams calldata, bytes calldata)
        internal
        override
        returns (bytes4)
    {
        beforeRemoveLiquidityCount[key.toId()]++;
        return BaseHook.beforeRemoveLiquidity.selector;
    }

    function _beforeInitialize(address, PoolKey calldata key, uint160) internal override returns (bytes4) {
        // Check if the pool key is already initialized
        if (address(_poolKey.hooks) != address(0)) revert AlreadyInitialized();

        // Store the pool key to be used in other functions
        _poolKey = key;
        return this.beforeInitialize.selector;
    }
}
