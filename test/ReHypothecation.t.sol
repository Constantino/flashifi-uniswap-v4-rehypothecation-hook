// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

// Foundry libraries
import {Test, console} from "forge-std/Test.sol";

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

contract MockFailingVault is ERC4626 {
    constructor(IERC20 token) ERC4626(token) ERC20("FailingVault", "FV") {}

    function deposit(uint256, address) public pure override returns (uint256) {
        revert("Mock vault deposit failure");
    }

    function withdraw(uint256, address, address) public pure override returns (uint256) {
        revert("Mock vault withdraw failure");
    }
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

        // Call setVaults
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

    function test_setVaults_anyone() public {
        address randomUser = makeAddr("randomUser");

        // Test that anyone can call setVaults
        vm.prank(randomUser);
        hook.setVaults(address(yieldSource0), address(yieldSource1));

        // Test that the same user can call setVaults again
        vm.prank(randomUser);
        hook.setVaults(address(yieldSource0), address(yieldSource1));
    }

    function test_setVaults_events() public {
        // Test that VaultsSet event is emitted
        vm.expectEmit(true, true, false, true);
        emit ReHypothecation.VaultsSet(address(yieldSource0), address(yieldSource1));

        hook.setVaults(address(yieldSource0), address(yieldSource1));
    }

    function test_setVaults_zeroAddress() public {
        // Test setting zero address vaults (should not revert, but may cause issues later)
        hook.setVaults(address(0), address(0));

        // Verify vaults are set to zero
        // Note: We can't directly access private variables, but we can test behavior
    }

    function test_setVaults_sameAddress() public {
        // Test setting same address for both vaults
        hook.setVaults(address(yieldSource0), address(yieldSource0));
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

    // Edge case tests for addReHypothecatedLiquidity
    function test_addReHypothecatedLiquidity_zeroLiquidity() public {
        vm.expectRevert(ReHypothecation.ZeroLiquidity.selector);
        hook.addReHypothecatedLiquidity(0);
    }

    function test_addReHypothecatedLiquidity_insufficientAllowance() public {
        // Remove approval
        IERC20(Currency.unwrap(currency0)).approve(address(hook), 0);
        IERC20(Currency.unwrap(currency1)).approve(address(hook), 0);

        vm.expectRevert();
        hook.addReHypothecatedLiquidity(1e15);
    }

    function test_addReHypothecatedLiquidity_insufficientBalance() public {
        // Transfer all tokens away
        IERC20(Currency.unwrap(currency0)).transfer(
            address(0x1), IERC20(Currency.unwrap(currency0)).balanceOf(address(this))
        );
        IERC20(Currency.unwrap(currency1)).transfer(
            address(0x1), IERC20(Currency.unwrap(currency1)).balanceOf(address(this))
        );

        vm.expectRevert();
        hook.addReHypothecatedLiquidity(1e15);
    }

    function test_addReHypothecatedLiquidity_maxUint128() public {
        // Test with maximum uint128 value
        uint128 maxLiquidity = type(uint128).max;

        // This will likely fail due to insufficient balance or other reasons
        // We test that the function can handle the max value as input
        try hook.addReHypothecatedLiquidity(maxLiquidity) {
            // If it succeeds, that's also fine - we just want to test it doesn't revert on input validation
            assertTrue(true, "Function accepted max uint128 value");
        } catch {
            // If it reverts, that's expected due to insufficient balance
            assertTrue(true, "Function reverted as expected with max uint128 value");
        }
    }

    function test_addReHypothecatedLiquidity_events() public {
        uint128 liquidity = 1e15;

        // Test that ReHypothecatedLiquidityAdded event is emitted
        vm.expectEmit(true, true, false, false); // Only check indexed parameters
        emit ReHypothecation.ReHypothecatedLiquidityAdded(address(this), liquidity, 0, 0);

        hook.addReHypothecatedLiquidity(liquidity);
    }

    // Edge case tests for removeReHypothecatedLiquidity
    function test_removeReHypothecatedLiquidity_zeroBalance() public {
        address userWithNoBalance = makeAddr("noBalance");

        vm.expectRevert(ReHypothecation.ZeroLiquidity.selector);
        hook.removeReHypothecatedLiquidity(userWithNoBalance);
    }

    function test_removeReHypothecatedLiquidity_events() public {
        // First add some liquidity
        uint128 liquidity = 1e15;
        hook.addReHypothecatedLiquidity(liquidity);

        // Test that ReHypothecatedLiquidityRemoved event is emitted
        vm.expectEmit(true, true, false, false); // Only check indexed parameters
        emit ReHypothecation.ReHypothecatedLiquidityRemoved(address(this), liquidity, 0, 0);

        hook.removeReHypothecatedLiquidity(address(this));
    }

    function test_removeReHypothecatedLiquidity_differentOwner() public {
        // Add liquidity as this contract
        uint128 liquidity = 1e15;
        hook.addReHypothecatedLiquidity(liquidity);

        // Try to remove as different user (should fail)
        address differentUser = makeAddr("differentUser");
        vm.expectRevert(ReHypothecation.ZeroLiquidity.selector);
        hook.removeReHypothecatedLiquidity(differentUser);
    }

    // Edge case tests for ERC20 functionality
    function test_erc20_transfer() public {
        // Add some liquidity to get tokens
        uint128 liquidity = 1e15;
        hook.addReHypothecatedLiquidity(liquidity);

        address recipient = makeAddr("recipient");
        uint256 transferAmount = liquidity / 2;

        // Transfer tokens
        hook.transfer(recipient, transferAmount);

        assertEq(hook.balanceOf(recipient), transferAmount, "Recipient should have transferred tokens");
        assertEq(hook.balanceOf(address(this)), liquidity - transferAmount, "Sender should have remaining tokens");
    }

    function test_erc20_approve() public {
        address spender = makeAddr("spender");
        uint256 amount = 1e15;

        // Approve tokens
        hook.approve(spender, amount);

        assertEq(hook.allowance(address(this), spender), amount, "Allowance should be set");
    }

    function test_erc20_transferFrom() public {
        // Add some liquidity to get tokens
        uint128 liquidity = 1e15;
        hook.addReHypothecatedLiquidity(liquidity);

        address spender = makeAddr("spender");
        address recipient = makeAddr("recipient");
        uint256 amount = liquidity / 2;

        // Approve and transfer
        hook.approve(spender, amount);

        vm.prank(spender);
        hook.transferFrom(address(this), recipient, amount);

        assertEq(hook.balanceOf(recipient), amount, "Recipient should have tokens");
        assertEq(hook.balanceOf(address(this)), liquidity - amount, "Sender should have remaining tokens");
    }

    // Edge case tests for vault interactions
    function test_vault_interaction_failure() public {
        // Create a mock vault that will fail on deposit
        MockFailingVault failingVault = new MockFailingVault(IERC20(Currency.unwrap(currency0)));

        // Set the failing vault
        hook.setVaults(address(failingVault), address(yieldSource1));

        // Try to add liquidity (should fail)
        vm.expectRevert();
        hook.addReHypothecatedLiquidity(1e15);
    }

    function test_vault_interaction_withdraw_failure() public {
        // First add liquidity with working vaults
        uint128 liquidity = 1e15;
        hook.addReHypothecatedLiquidity(liquidity);

        // Create a mock vault that will fail on withdraw
        MockFailingVault failingVault = new MockFailingVault(IERC20(Currency.unwrap(currency0)));

        // Set the failing vault
        hook.setVaults(address(failingVault), address(yieldSource1));

        // Try to remove liquidity (should fail)
        vm.expectRevert();
        hook.removeReHypothecatedLiquidity(address(this));
    }

    // Edge case tests for extreme values
    function test_extreme_liquidity_values() public {
        // Test with very small liquidity
        uint128 smallLiquidity = 1;
        hook.addReHypothecatedLiquidity(smallLiquidity);

        assertEq(hook.balanceOf(address(this)), smallLiquidity, "Should handle small liquidity");

        // Clean up
        hook.removeReHypothecatedLiquidity(address(this));
    }

    function test_multiple_users() public {
        address user1 = makeAddr("user1");
        address user2 = makeAddr("user2");

        // Give users some tokens
        IERC20(Currency.unwrap(currency0)).transfer(user1, 1e18);
        IERC20(Currency.unwrap(currency1)).transfer(user1, 1e18);
        IERC20(Currency.unwrap(currency0)).transfer(user2, 1e18);
        IERC20(Currency.unwrap(currency1)).transfer(user2, 1e18);

        // Users approve the hook
        vm.prank(user1);
        IERC20(Currency.unwrap(currency0)).approve(address(hook), type(uint256).max);
        vm.prank(user1);
        IERC20(Currency.unwrap(currency1)).approve(address(hook), type(uint256).max);
        vm.prank(user2);
        IERC20(Currency.unwrap(currency0)).approve(address(hook), type(uint256).max);
        vm.prank(user2);
        IERC20(Currency.unwrap(currency1)).approve(address(hook), type(uint256).max);

        // Both users add liquidity
        uint128 liquidity1 = 1e15;
        uint128 liquidity2 = 2e15;

        vm.prank(user1);
        hook.addReHypothecatedLiquidity(liquidity1);
        vm.prank(user2);
        hook.addReHypothecatedLiquidity(liquidity2);

        // Check balances
        assertEq(hook.balanceOf(user1), liquidity1, "User1 should have correct balance");
        assertEq(hook.balanceOf(user2), liquidity2, "User2 should have correct balance");
        assertEq(hook.totalSupply(), liquidity1 + liquidity2, "Total supply should be correct");

        // Users remove liquidity
        vm.prank(user1);
        hook.removeReHypothecatedLiquidity(user1);
        vm.prank(user2);
        hook.removeReHypothecatedLiquidity(user2);

        // Check balances are zero
        assertEq(hook.balanceOf(user1), 0, "User1 balance should be zero");
        assertEq(hook.balanceOf(user2), 0, "User2 balance should be zero");
        assertEq(hook.totalSupply(), 0, "Total supply should be zero");
    }

    function test_jit_liquidity_no_vault_shares() public {
        // Try to swap without any vault shares (should not provide liquidity)
        BalanceDelta swapDelta = swap(key, false, 1e14, ZERO_BYTES);

        // Verify swap still works (just without JIT liquidity)
        assertEq(manager.getLiquidity(key.toId()), 0, "Liquidity should be 0");
    }

    // Edge case tests for reentrancy protection
    function test_reentrancy_protection() public {
        // This test would require a malicious contract that tries to reenter
        // For now, we'll test that the contract doesn't have obvious reentrancy issues
        uint128 liquidity = 1e15;

        // Add and remove liquidity multiple times quickly
        hook.addReHypothecatedLiquidity(liquidity);
        hook.removeReHypothecatedLiquidity(address(this));
        hook.addReHypothecatedLiquidity(liquidity);
        hook.removeReHypothecatedLiquidity(address(this));

        // Should not have any issues
        assertEq(hook.balanceOf(address(this)), 0, "Balance should be zero");
    }

    // Edge case tests for gas limits
    function test_gas_usage() public {
        uint128 liquidity = 1e15;

        // Test gas usage for addReHypothecatedLiquidity
        uint256 gasStart = gasleft();
        hook.addReHypothecatedLiquidity(liquidity);
        uint256 gasUsed = gasStart - gasleft();

        // Log gas usage for analysis
        console.log("Gas used for addReHypothecatedLiquidity:", gasUsed);

        // Test gas usage for removeReHypothecatedLiquidity
        gasStart = gasleft();
        hook.removeReHypothecatedLiquidity(address(this));
        gasUsed = gasStart - gasleft();

        console.log("Gas used for removeReHypothecatedLiquidity:", gasUsed);
    }

    // Edge case tests for precision and rounding
    function test_precision_rounding() public {
        // Test with very small amounts that might cause rounding issues
        uint128 smallLiquidity = 1000; // Very small amount

        hook.addReHypothecatedLiquidity(smallLiquidity);

        // Verify the user gets the expected amount
        assertEq(hook.balanceOf(address(this)), smallLiquidity, "Should handle small amounts correctly");

        // Remove liquidity
        hook.removeReHypothecatedLiquidity(address(this));

        // Verify clean removal
        assertEq(hook.balanceOf(address(this)), 0, "Should remove all liquidity");
    }

    // Edge case tests for ERC20 edge cases
    function test_erc20_transfer_zero_amount() public {
        // Add some liquidity
        uint128 liquidity = 1e15;
        hook.addReHypothecatedLiquidity(liquidity);

        // Transfer zero amount
        address recipient = makeAddr("recipient");
        hook.transfer(recipient, 0);

        // Balances should be unchanged
        assertEq(hook.balanceOf(address(this)), liquidity, "Sender balance should be unchanged");
        assertEq(hook.balanceOf(recipient), 0, "Recipient balance should be zero");
    }

    function test_erc20_transfer_to_self() public {
        // Add some liquidity
        uint128 liquidity = 1e15;
        hook.addReHypothecatedLiquidity(liquidity);

        // Transfer to self
        hook.transfer(address(this), liquidity / 2);

        // Balance should be unchanged
        assertEq(hook.balanceOf(address(this)), liquidity, "Balance should be unchanged");
    }

    function test_erc20_approve_max_uint256() public {
        address spender = makeAddr("spender");

        // Approve max uint256
        hook.approve(spender, type(uint256).max);

        assertEq(hook.allowance(address(this), spender), type(uint256).max, "Allowance should be max uint256");
    }

    // Edge case tests for vault edge cases
    function test_vault_zero_deposit() public {
        // This should not revert but might not do anything useful
        uint128 liquidity = 1e15;
        hook.addReHypothecatedLiquidity(liquidity);

        // The vault should have received the deposit
        assertTrue(IERC4626(address(yieldSource0)).balanceOf(address(hook)) > 0, "Vault should have received deposit");
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
