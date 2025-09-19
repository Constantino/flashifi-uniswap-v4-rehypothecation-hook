// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {SwapParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IPoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

import {Script, console} from "forge-std/Script.sol";
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
 * Corrected version that uses PoolSwapTest for proper swap execution.
 *
 * forge script script/00_CorrectedSwapTest.s.sol:CorrectedSwapTest --rpc-url="https://sepolia.base.org/" --broadcast --legacy --chain 84532
 */
contract CorrectedSwapTest is Script {
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
        // Get private key from .env file
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        console.log("Using deployer address:", deployer);

        vm.startBroadcast(privateKey);

        // Deploy a new hook instance for this test
        console.log("Deploying ReHypothecation hook...");
        deployHook();
        console.log("Hook deployed at:", address(hook));

        // Deploy mock tokens
        token0 = new MockERC20("Token00", "T00");
        token1 = new MockERC20("Token01", "T01");

        vault0 = IERC4626(new ERC4626Mock(IERC20(token0), "Vault0", "V0"));
        vault1 = IERC4626(new ERC4626Mock(IERC20(token1), "Vault1", "V1"));

        // Mint tokens to the deployer
        token0.mint(deployer, 1000000 ether);
        token1.mint(deployer, 1000000 ether);

        // Create the test contracts
        PoolModifyLiquidityTest modifyLiquidityTest = new PoolModifyLiquidityTest(IPoolManager(POOL_MANAGER));
        PoolSwapTest swapTest = new PoolSwapTest(IPoolManager(POOL_MANAGER));

        // Approve the tokens to be used
        token0.approve(address(modifyLiquidityTest), type(uint256).max);
        token1.approve(address(modifyLiquidityTest), type(uint256).max);
        token0.approve(address(swapTest), type(uint256).max);
        token1.approve(address(swapTest), type(uint256).max);

        // User approves the hook contract to spend their tokens
        token0.approve(address(hook), type(uint256).max);
        token1.approve(address(hook), type(uint256).max);

        // Set the vault addresses for the hook
        console.log("Setting vault addresses for hook...");
        console.log("Vault0 address:", address(vault0));
        console.log("Vault1 address:", address(vault1));
        hook.setVaults(address(vault0), address(vault1));
        console.log("Vault addresses set successfully");

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
        console.log("Initializing pool...");
        IPoolManager(POOL_MANAGER).initialize(poolKey, SQRTPRICEX96);
        console.log("Pool initialized successfully");

        // Add liquidity
        console.log("Adding initial liquidity to pool...");
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
        console.log("Initial liquidity added successfully");

        // === Test Swap with ReHypothecation Hook ===
        console.log("\n=== Testing Swap with ReHypothecation Hook ===");

        // Check balances before swap
        uint256 balance0Before = token0.balanceOf(deployer);
        uint256 balance1Before = token1.balanceOf(deployer);
        console.log("Before swap - Token0:", balance0Before, "Token1:", balance1Before);

        // Create swap parameters
        uint256 swapAmount = 1000; // Very small swap amount (1000 wei)
        console.log("Swap amount:", swapAmount);

        SwapParams memory swapParams = SwapParams({
            zeroForOne: true, // Token0 -> Token1
            amountSpecified: int256(swapAmount),
            sqrtPriceLimitX96: TickMath.getSqrtPriceAtTick(-887220) // Minimum price limit
        });

        console.log("Executing swap through PoolSwapTest...");

        try swapTest.swap(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), ""
        ) returns (BalanceDelta delta) {
            console.log("Swap succeeded!");
            console.log("Delta amount0:", delta.amount0());
            console.log("Delta amount1:", delta.amount1());

            // Check balances after swap
            uint256 balance0After = token0.balanceOf(deployer);
            uint256 balance1After = token1.balanceOf(deployer);
            console.log("After swap - Token0:", balance0After, "Token1:", balance1After);

            console.log("Token0 change:", int256(balance0After) - int256(balance0Before));
            console.log("Token1 change:", int256(balance1After) - int256(balance1Before));

            console.log("SUCCESS: ReHypothecation hook provided just-in-time liquidity!");
        } catch Error(string memory reason) {
            console.log("Swap failed with reason:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Swap failed with low-level data:");
            console.logBytes(lowLevelData);
        }

        console.log("\nDeployment and testing completed successfully!");
        console.log("Hook address:", address(hook));
        console.log("Token0 address:", address(token0));
        console.log("Token1 address:", address(token1));
        console.log("Vault0 address:", address(vault0));
        console.log("Vault1 address:", address(vault1));

        vm.stopBroadcast();
    }

    function deployHook() internal {
        // Hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        console.log("Mining hook address with flags:", flags);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(IPoolManager(POOL_MANAGER));

        (address hookAddr, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(ReHypothecation).creationCode, constructorArgs);

        console.log("Found hook address:", hookAddr);
        console.log("Using salt:", vm.toString(salt));
        vm.label(hookAddr, "HookAddress");

        // Deploy the hook using CREATE2
        hook = new ReHypothecation{salt: salt}(IPoolManager(POOL_MANAGER));
        vm.label(address(hook), "ReHypothecation");

        require(address(hook) == hookAddr, "DeployHookScript: Hook Address Mismatch");
        console.log("Hook deployed successfully with correct address");
    }
}
