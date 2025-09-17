// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IPoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

import {Script} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {ReHypothecation} from "../src/ReHypothecation.sol";
import {StdConstants} from "forge-std/StdConstants.sol";

// Simple mock ERC20 token with mint function
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ERC4626Mock is ERC4626 {
    constructor(IERC20 token, string memory name, string memory symbol) ERC4626(token) ERC20(name, symbol) {}
}

/**
 * Adds liquidity to a pool to allow for router and quoter testing.
 *
 * forge script script/deployment/MockTokenUniswapPool.s.sol:MockTokenUniswapPool --rpc-url="https://sepolia.base.org/" --broadcast --legacy --chain 84532
 */
contract MockTokenUniswapPool is Script {
    // Mock tokens for testing
    MockERC20 internal token0;
    MockERC20 internal token1;

    IERC4626 internal vault0;
    IERC4626 internal vault1;

    uint24 constant FEE = 3_00;
    int24 constant TICK_SPACING = 60;
    ReHypothecation internal hook;

    // Addresses
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408; // Base Sepolia PoolManager
    address constant POSITION_MANAGER = 0x4B2C77d209D3405F41a037Ec6c77F7F5b8e2ca80; // Base Sepolia PositionManager

    // Amount of liquidity to add
    uint160 constant SQRTPRICEX96 = 4039859466863342444871680;

    function run() public {
        vm.startBroadcast();

        // Deploy a new hook instance for this test
        deployHook();

        // Deploy mock tokens
        token0 = new MockERC20("Token00", "T00");
        token1 = new MockERC20("Token01", "T01");

        vault0 = IERC4626(new ERC4626Mock(IERC20(token0), "Vault0", "V0"));
        vault1 = IERC4626(new ERC4626Mock(IERC20(token1), "Vault1", "V1"));

        // Mint tokens to the deployer
        token0.mint(msg.sender, 1000 ether);
        token1.mint(msg.sender, 1000 ether);

        // Create the modify liquidity test contract
        PoolModifyLiquidityTest modifyLiquidityTest = new PoolModifyLiquidityTest(IPoolManager(POOL_MANAGER));

        // Approve the tokens to be used
        token0.approve(address(modifyLiquidityTest), type(uint256).max);
        token1.approve(address(modifyLiquidityTest), type(uint256).max);

        // User approves the hook contract to spend their tokens
        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);

        // Set the vault addresses for the hook
        hook.setVaults(address(vault0), address(vault1));

        // Define out PoolKey - ensure currencies are in correct order (smaller address first)
        address token0Addr = address(token0);
        address token1Addr = address(token1);

        // Swap if token0 address is larger than token1 address
        if (token0Addr > token1Addr) {
            (token0Addr, token1Addr) = (token1Addr, token0Addr);
        }

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0Addr),
            currency1: Currency.wrap(token1Addr),
            fee: FEE,
            hooks: IHooks(address(hook)),
            tickSpacing: TICK_SPACING
        });

        // First initialize the pool
        IPoolManager(POOL_MANAGER).initialize(poolKey, SQRTPRICEX96);

        // Add liquidity
        modifyLiquidityTest.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: TickMath.minUsableTick(TICK_SPACING),
                tickUpper: TickMath.maxUsableTick(TICK_SPACING),
                liquidityDelta: 0.000001 ether,
                salt: ""
            }),
            Constants.ZERO_BYTES
        );

        vm.stopBroadcast();
    }

    function deployHook() internal {
        // Hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(IPoolManager(POOL_MANAGER));

        (address hookAddr, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(ReHypothecation).creationCode, constructorArgs);

        vm.label(hookAddr, "HookAddress");

        // Deploy the hook using CREATE2
        hook = new ReHypothecation{salt: salt}(IPoolManager(POOL_MANAGER));
        vm.label(address(hook), "ReHypothecation");

        require(address(hook) == hookAddr, "DeployHookScript: Hook Address Mismatch");
    }
}
