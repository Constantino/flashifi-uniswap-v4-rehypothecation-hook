// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IPoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {Script, console} from "forge-std/Script.sol";

/**
 * Simple swap-only script that uses already deployed contracts.
 *
 * Usage:
 * forge script script/01_SimpleSwapOnly.s.sol --rpc-url https://base-sepolia.g.alchemy.com/v2/your_api_key --broadcast --tc SimpleSwapOnly
 *
 * Make sure to update the contract addresses below with your deployed addresses.
 */
contract SimpleSwapOnly is Script {
    // Contract addresses - UPDATE THESE WITH YOUR DEPLOYED ADDRESSES
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408; // Base Sepolia PoolManager
    address constant HOOK_ADDRESS = 0xfD6A5e131EB3E022A354783A0768799EaDf020C0; // UPDATE: Your deployed hook address
    address constant TOKEN0_ADDRESS = 0x527d20Fc27D03c33Eb9909079b0AB1C844Fb375E; // UPDATE: Your token0 address
    address constant TOKEN1_ADDRESS = 0xDBd54F088b97CD4af1deE26a6CB14CD89499cE1e; // UPDATE: Your token1 address

    // Pool configuration - UPDATE THESE TO MATCH YOUR POOL
    uint24 constant FEE = 3_00;
    int24 constant TICK_SPACING = 60;

    // Swap configuration
    uint256 constant SWAP_AMOUNT = 100000000000000000000000; // Amount to swap (in wei)
    bool constant ZERO_FOR_ONE = true; // true = Token0 -> Token1, false = Token1 -> Token0

    function run() public {
        // Get private key from .env file
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        console.log("Using deployer address:", deployer);

        vm.startBroadcast(privateKey);

        console.log("=== Simple Swap Only Script ===");
        console.log("Using existing deployed contracts...");

        // Validate addresses
        require(HOOK_ADDRESS != address(0), "Hook address not set");
        require(TOKEN0_ADDRESS != address(0), "Token0 address not set");
        require(TOKEN1_ADDRESS != address(0), "Token1 address not set");

        // Get token contracts
        IERC20 token0 = IERC20(TOKEN0_ADDRESS);
        IERC20 token1 = IERC20(TOKEN1_ADDRESS);

        // Create swap test contract
        PoolSwapTest swapTest = new PoolSwapTest(IPoolManager(POOL_MANAGER));

        // Approve tokens for swapping
        token0.approve(address(swapTest), type(uint256).max);
        token1.approve(address(swapTest), type(uint256).max);

        // Create pool key
        PoolKey memory poolKey = createPoolKey();

        // Check balances before swap
        uint256 balance0Before = token0.balanceOf(deployer);
        uint256 balance1Before = token1.balanceOf(deployer);
        console.log("Before swap - Token0:", balance0Before, "Token1:", balance1Before);

        // Create swap parameters
        SwapParams memory swapParams = SwapParams({
            zeroForOne: ZERO_FOR_ONE,
            amountSpecified: int256(SWAP_AMOUNT),
            sqrtPriceLimitX96: TickMath.getSqrtPriceAtTick(-887220) // Minimum price limit
        });

        console.log("Executing swap...");
        console.log("Swap amount:", SWAP_AMOUNT);
        console.log("Direction:", ZERO_FOR_ONE ? "Token0 -> Token1" : "Token1 -> Token0");

        try swapTest.swap(
            poolKey, swapParams, PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}), ""
        ) returns (BalanceDelta delta) {
            console.log("SUCCESS: Swap succeeded!");
            console.log("Delta amount0:", delta.amount0());
            console.log("Delta amount1:", delta.amount1());

            // Check balances after swap
            uint256 balance0After = token0.balanceOf(deployer);
            uint256 balance1After = token1.balanceOf(deployer);
            console.log("After swap - Token0:", balance0After, "Token1:", balance1After);

            console.log("Token0 change:", int256(balance0After) - int256(balance0Before));
            console.log("Token1 change:", int256(balance1After) - int256(balance1Before));

            console.log("SUCCESS: Swap completed with ReHypothecation hook!");
        } catch Error(string memory reason) {
            console.log("ERROR: Swap failed with reason:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("ERROR: Swap failed with low-level data:");
            console.logBytes(lowLevelData);
        }

        vm.stopBroadcast();
    }

    function createPoolKey() internal view returns (PoolKey memory) {
        // Ensure currencies are in correct order (smaller address first)
        address token0Addr = TOKEN0_ADDRESS;
        address token1Addr = TOKEN1_ADDRESS;

        if (token0Addr > token1Addr) {
            (token0Addr, token1Addr) = (token1Addr, token0Addr);
        }

        return PoolKey({
            currency0: Currency.wrap(token0Addr),
            currency1: Currency.wrap(token1Addr),
            fee: FEE,
            hooks: IHooks(HOOK_ADDRESS),
            tickSpacing: TICK_SPACING
        });
    }
}
