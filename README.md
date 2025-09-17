# FlashiFi ReHypothecation Hook

**A Uniswap v4 Hook for ReHypothecated Liquidity Provision 🦄**

The ReHypothecation Hook enables liquidity providers to deposit their assets into yield-generating vaults (ERC4626) while simultaneously providing Just-in-Time (JIT) liquidity to Uniswap v4 pools. This creates a novel mechanism where idle liquidity earns yield while being available for trading.

## Overview

The ReHypothecation Hook implements a sophisticated liquidity management system that:

- **Deposits user assets into yield-generating vaults** (ERC4626 compliant)
- **Provides JIT liquidity** to Uniswap v4 pools during swaps
- **Automatically manages liquidity** by adding it before swaps and removing it after
- **Mints ERC20 shares** representing the user's rehypothecated liquidity position
- **Generates additional yield** on idle liquidity through vault strategies

## Architecture

### Core Components

1. **ReHypothecation Contract** (`src/ReHypothecation.sol`)
   - Inherits from `BaseHook`, `ERC20`, and `Ownable`
   - Manages vault interactions and liquidity provision
   - Implements Uniswap v4 hook callbacks

2. **Vault Integration**
   - Supports any ERC4626 compliant yield vault
   - Configurable vault addresses per currency pair
   - Owner-controlled vault management

3. **Hook Callbacks**
   - `beforeInitialize`: Stores pool configuration
   - `beforeSwap`: Provides JIT liquidity from vault assets
   - `afterSwap`: Removes liquidity and returns assets to vaults

### Key Features

- **Just-in-Time Liquidity**: Automatically provides liquidity during swaps
- **Yield Generation**: Assets earn yield in vaults when not actively trading
- **ERC20 Shares**: Users receive transferable shares representing their position
- **Gas Efficient**: Only provides liquidity when needed for swaps
- **Configurable Vaults**: Owner can set different vault strategies per currency

## Usage

### Setup

1. **Install Dependencies**
   ```bash
   forge install
   ```

2. **Run Tests**
   ```bash
   forge test
   ```

3. **Deploy Hook**
   ```bash
   forge script script/04_MockTokenUniswapPool.s.sol:MockTokenUniswapPool --rpc-url <RPC_URL> --broadcast --legacy
   ```

### Adding ReHypothecated Liquidity

```solidity
// Add liquidity to the hook
uint128 liquidity = 1e15; // Amount of liquidity to provide
hook.addReHypothecatedLiquidity(liquidity);

// User receives ERC20 shares representing their position
uint256 shares = hook.balanceOf(user);
```

### Removing ReHypothecated Liquidity

```solidity
// Remove all liquidity for a user
hook.removeReHypothecatedLiquidity(user);

// User receives their proportional share of vault assets
```

## Testing

The test suite (`test/ReHypothecation.t.sol`) includes comprehensive coverage:

### Core Functionality Tests
- ✅ Full cycle: add → swap → remove liquidity
- ✅ JIT liquidity provision during swaps
- ✅ Vault integration and yield generation
- ✅ ERC20 share mechanics

### Edge Case Tests
- ✅ Zero liquidity handling
- ✅ Insufficient balance/allowance scenarios
- ✅ Vault interaction failures
- ✅ Multiple user management
- ✅ Reentrancy protection
- ✅ Gas usage optimization

### Security Tests
- ✅ Owner-only vault configuration
- ✅ Proper access controls
- ✅ Input validation
- ✅ Precision and rounding handling

Run specific test categories:
```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test test_full_cycle
```

## Deployment Script

The main deployment script (`script/04_MockTokenUniswapPool.s.sol`) demonstrates:

1. **Hook Deployment**: Creates a properly flagged hook contract
2. **Mock Token Creation**: Deploys test ERC20 tokens
3. **Vault Setup**: Creates ERC4626 mock vaults
4. **Pool Initialization**: Sets up the Uniswap v4 pool
5. **Liquidity Provision**: Adds initial liquidity to the pool

### Deployment Configuration

```solidity
// Hook flags for Uniswap v4
uint160 flags = uint160(
    Hooks.BEFORE_INITIALIZE_FLAG | 
    Hooks.BEFORE_SWAP_FLAG | 
    Hooks.AFTER_SWAP_FLAG
);

// Pool configuration
uint24 constant FEE = 3_00; // 0.3%
int24 constant TICK_SPACING = 60;
```

## Events

The hook emits several events for tracking:

- `VaultsSet`: Vault addresses configured
- `ReHypothecatedLiquidityAdded`: User adds liquidity
- `ReHypothecatedLiquidityRemoved`: User removes liquidity
- `PoolInitialized`: Pool configuration stored
- `LiquidityProvided`: JIT liquidity added during swap
- `LiquidityRemoved`: JIT liquidity removed after swap

## Requirements

- **Foundry** (stable version recommended)
- **Solidity** ^0.8.26
- **Uniswap v4** dependencies

## Local Development

For local testing and development:

```bash
# Start local anvil node
anvil --code-size-limit 40000

# Deploy to local network
forge script script/04_MockTokenUniswapPool.s.sol:MockTokenUniswapPool --rpc-url http://localhost:8545 --broadcast --legacy
```

## Security Considerations

- **Owner Controls**: Only the owner can configure vault addresses
- **Input Validation**: All inputs are validated before processing
- **Reentrancy Protection**: Functions are protected against reentrancy attacks
- **Precision Handling**: Careful handling of rounding and precision issues
- **Vault Integration**: Robust error handling for vault interactions

## Additional Resources

- [Uniswap v4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [ERC4626 Vault Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Uniswap v4 Core](https://github.com/uniswap/v4-core)
- [Uniswap v4 Periphery](https://github.com/uniswap/v4-periphery)
