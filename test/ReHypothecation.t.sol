// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

// Foundry libraries
import {Test} from "forge-std/Test.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {BalanceDelta, toBalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Position} from "@uniswap/v4-core/src/libraries/Position.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {FixedPoint128} from "@uniswap/v4-core/src/libraries/FixedPoint128.sol";

import {ReHypothecation} from "../src/ReHypothecation.sol";

contract ERC4626Mock is ERC4626 {
    constructor(IERC20 token, string memory name, string memory symbol) ERC4626(token) ERC20(name, symbol) {}
}

contract ReHypothecationTest is Test, Deployers {
    // Use the libraries
    using StateLibrary for IPoolManager;

    ReHypothecation hook;

    uint24 fee = 1000; // 0.1%

    IERC4626 yieldSource0;
    IERC4626 yieldSource1;

    int24 tickLower;
    int24 tickUpper;

    PoolKey noHookKey;

    function setUp() public {
        // Deploy v4 core contracts
        deployFreshManagerAndRouters();
        // Deploy two test tokens
        deployMintAndApprove2Currencies();

        yieldSource0 = IERC4626(new ERC4626Mock(IERC20(Currency.unwrap(currency0)), "Yield Source 0", "Y0"));
        yieldSource1 = IERC4626(new ERC4626Mock(IERC20(Currency.unwrap(currency1)), "Yield Source 1", "Y1"));

        hook = ReHypothecation(
            address(uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG))
        );

        deployCodeTo("ReHypothecation.sol:ReHypothecation", abi.encode(manager), address(hook));

        (key,) = initPool(currency0, currency1, IHooks(address(hook)), fee, SQRT_PRICE_1_1);
        (noHookKey,) = initPool(currency0, currency1, IHooks(address(0)), fee, SQRT_PRICE_1_1);

        // Call setVaults as the owner (the deployer)
        vm.prank(address(this));
        hook.setVaults(address(yieldSource0), address(yieldSource1));

        IERC20(Currency.unwrap(currency0)).approve(address(hook), type(uint256).max);
        IERC20(Currency.unwrap(currency1)).approve(address(hook), type(uint256).max);

        vm.label(Currency.unwrap(currency0), "currency0");
        vm.label(Currency.unwrap(currency1), "currency1");
    }

    function test_already_initialized_reverts() public {
        vm.expectRevert();
        initPool(currency0, currency1, IHooks(address(hook)), fee, SQRT_PRICE_1_1);
    }

    function test_setVaults_onlyOwner() public {
        address nonOwner = makeAddr("nonOwner");

        // Test that non-owner cannot call setVaults
        vm.prank(nonOwner);
        vm.expectRevert();
        hook.setVaults(address(yieldSource0), address(yieldSource1));

        // Test that owner can call setVaults
        vm.prank(address(this));
        hook.setVaults(address(yieldSource0), address(yieldSource1));
    }

    function test_full_cycle() public {
        uint128 liquidity = 1e15;
        BalanceDelta delta = hook.addReHypothecatedLiquidity(liquidity);

        assertEq(
            IERC4626(address(yieldSource0)).balanceOf(address(hook)),
            uint256(liquidity),
            "YieldSource0 balance should be the same as the liquidity"
        );
        assertEq(
            IERC4626(address(yieldSource1)).balanceOf(address(hook)),
            uint256(liquidity),
            "YieldSource1 balance should be the same as the liquidity"
        );

        assertEq(manager.getLiquidity(key.toId()), 0, "Liquidity should be 0");

        assertEq(hook.balanceOf(address(this)), liquidity, "Hook balance should be the same as the liquidity");

        // add rehypothecated liquidity should be equal to modifyPoolLiquidity with a pool with the same state
        BalanceDelta expectedDelta =
            modifyPoolLiquidity(noHookKey, hook.getTickLower(), hook.getTickUpper(), int256(uint256(liquidity)), 0);
        assertEq(delta.amount0(), expectedDelta.amount0(), "Delta amount0 should be equal");
        assertEq(delta.amount1(), expectedDelta.amount1(), "Delta amount1 should be equal");

        BalanceDelta swapDelta = swap(key, false, 1e14, ZERO_BYTES);
        BalanceDelta noHookSwapDelta = swap(noHookKey, false, 1e14, ZERO_BYTES);

        assertEq(swapDelta.amount0(), noHookSwapDelta.amount0(), "Swap amount0 should be equal");
        assertEq(swapDelta.amount1(), noHookSwapDelta.amount1(), "Swap amount1 should be equal");
        assertEq(manager.getLiquidity(key.toId()), 0, "Liquidity should be 0");

        assertEq(IERC20(Currency.unwrap(currency0)).balanceOf(address(hook)), 0, "Currency0 balance should be 0");
        assertEq(IERC20(Currency.unwrap(currency1)).balanceOf(address(hook)), 0, "Currency1 balance should be 0");

        assertApproxEqAbs(
            IERC4626(address(yieldSource0)).balanceOf(address(hook)),
            uint256(liquidity - uint128(swapDelta.amount0())),
            2,
            "YieldSource0 balance should go to user"
        );
        assertApproxEqAbs(
            IERC4626(address(yieldSource1)).balanceOf(address(hook)),
            uint256(uint128(int128(liquidity) - swapDelta.amount1())),
            2,
            "YieldSource1 balance should go to user"
        );

        delta = hook.removeReHypothecatedLiquidity(address(this));

        expectedDelta =
            modifyPoolLiquidity(noHookKey, hook.getTickLower(), hook.getTickUpper(), int256(-int128(liquidity)), 0);

        assertEq(delta.amount0(), expectedDelta.amount0(), "Delta amount0 should be equal");
        assertEq(delta.amount1(), expectedDelta.amount1(), "Delta amount1 should be equal");

        assertEq(manager.getLiquidity(key.toId()), 0, "Liquidity should be 0");

        assertEq(IERC20(Currency.unwrap(currency0)).balanceOf(address(hook)), 0, "Currency0 balance should be 0");
        assertEq(IERC20(Currency.unwrap(currency1)).balanceOf(address(hook)), 0, "Currency1 balance should be 0");

        assertEq(IERC4626(address(yieldSource0)).balanceOf(address(hook)), 0, "YieldSource0 balance should be 0");
        assertEq(IERC4626(address(yieldSource1)).balanceOf(address(hook)), 0, "YieldSource1 balance should be 0");

        assertEq(hook.balanceOf(address(this)), 0, "Hook balance should be 0");
    }

    // @dev Modify the liquidity of a given position.
    function modifyPoolLiquidity(
        PoolKey memory poolKey,
        int24 tickLower_,
        int24 tickUpper_,
        int256 liquidity,
        bytes32 salt
    ) internal returns (BalanceDelta) {
        ModifyLiquidityParams memory modifyLiquidityParams =
            ModifyLiquidityParams({tickLower: tickLower_, tickUpper: tickUpper_, liquidityDelta: liquidity, salt: salt});
        return modifyLiquidityRouter.modifyLiquidity(poolKey, modifyLiquidityParams, "");
    }
}
