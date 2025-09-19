# FlashiFi ReHypothecation Hook

**A Uniswap v4 Hook for ReHypothecated Liquidity Provision 🦄**

The ReHypothecation Hook enables liquidity providers to deposit their assets into yield-generating vaults (ERC4626) while simultaneously providing Just-in-Time (JIT) liquidity to Uniswap v4 pools. This creates a novel mechanism where idle liquidity earns yield while being available for trading.

## Overview

The ReHypothecation Hook implements a sophisticated liquidity management system that:

- **Deposits user assets into yield-generating vaults** (ERC4626 compliant) for continuous yield generation
- **Provides JIT liquidity** to Uniswap v4 pools during swaps using vault assets
- **Automatically manages liquidity** by adding it before swaps and removing it after
- **Mints ERC20 FFRH shares** representing the user's rehypothecated liquidity position
- **Uses full-range liquidity** (min to max tick) for maximum price coverage
- **Supports multiple users** with proportional share-based asset management
- **Public vault configuration** allowing anyone to set vault addresses

## Architecture

### Core Components

1. **ReHypothecation Contract** (`src/ReHypothecation.sol`)
   - Inherits from `BaseHook` and `ERC20` (not `Ownable`)
   - Manages vault interactions and JIT liquidity provision
   - Implements Uniswap v4 hook callbacks for automated liquidity management
   - Uses full-range liquidity provision (min to max tick)

2. **Vault Integration**
   - Supports any ERC4626 compliant yield vault
   - Public `setVaults()` function (anyone can configure vaults)
   - Vault addresses mapped per currency (currency0 → vault0, currency1 → vault1)
   - Automatic asset deposits/withdrawals during liquidity operations

3. **Hook Callbacks**
   - `beforeInitialize`: Stores pool configuration and validates single initialization
   - `beforeSwap`: Calculates and provides JIT liquidity from vault assets
   - `afterSwap`: Removes all hook-owned liquidity and returns assets to vaults

### Key Features

- **Just-in-Time Liquidity**: Automatically provides liquidity during swaps using vault assets
- **Yield Generation**: Assets earn yield in ERC4626 vaults when not actively trading
- **ERC20 Shares**: Users receive transferable `FFRH` shares representing their position
- **Gas Efficient**: Only provides liquidity when needed for swaps, then immediately removes it
- **Full-Range Liquidity**: Uses complete price range (min to max tick) for maximum coverage
- **Public Vault Configuration**: Anyone can set vault addresses (no owner restrictions)
- **Automatic Asset Management**: Seamlessly moves assets between vaults and pool

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
   # Deploy with full test setup (recommended for testing)
   forge script script/00_CorrectedSwapTest.s.sol:CorrectedSwapTest --rpc-url <RPC_URL> --broadcast --legacy
   
   # Or use simple swap script with existing contracts
   forge script script/01_SimpleSwapOnly.s.sol:SimpleSwapOnly --rpc-url <RPC_URL> --broadcast --legacy
   ```

### Adding ReHypothecated Liquidity

```solidity
// First, set vault addresses (anyone can call this)
hook.setVaults(vault0Address, vault1Address);

// Approve tokens for the hook contract
token0.approve(address(hook), amount0);
token1.approve(address(hook), amount1);

// Add liquidity to the hook (returns BalanceDelta)
uint128 liquidity = 1e15; // Amount of liquidity to provide
BalanceDelta delta = hook.addReHypothecatedLiquidity(liquidity);

// User receives ERC20 FFRH shares representing their position
uint256 shares = hook.balanceOf(user);
```

### Removing ReHypothecated Liquidity

```solidity
// Remove all liquidity for a specific user (returns BalanceDelta)
BalanceDelta delta = hook.removeReHypothecatedLiquidity(user);

// User receives their proportional share of vault assets
// Assets are automatically withdrawn from vaults and transferred to user
```

### Hook Configuration

```solidity
// Get vault address for a specific currency
address vault0 = hook.getVaultAddress(currency0);
address vault1 = hook.getVaultAddress(currency1);

// Get tick range (always full range)
int24 tickLower = hook.getTickLower(); // minUsableTick
int24 tickUpper = hook.getTickUpper(); // maxUsableTick
```

## Testing

The test suite (`test/ReHypothecation.t.sol`) includes comprehensive coverage with 25+ test functions:

### Core Functionality Tests
- ✅ **Full cycle test**: Complete add → swap → remove liquidity flow
- ✅ **JIT liquidity provision**: Automatic liquidity provision during swaps
- ✅ **Vault integration**: ERC4626 vault deposits and withdrawals
- ✅ **ERC20 share mechanics**: Transfer, approve, transferFrom functionality
- ✅ **Pool initialization**: Single initialization validation and pool key storage

### Edge Case Tests
- ✅ **Zero liquidity handling**: Proper validation and error messages
- ✅ **Insufficient balance/allowance**: Graceful failure handling
- ✅ **Vault interaction failures**: Mock failing vaults for error testing
- ✅ **Multiple user management**: Concurrent user operations
- ✅ **Reentrancy protection**: Multiple rapid operations
- ✅ **Gas usage optimization**: Gas consumption measurement and logging
- ✅ **Extreme values**: Max uint128, very small amounts
- ✅ **Precision and rounding**: Small amount handling and accuracy

### ERC20 Functionality Tests
- ✅ **Transfer operations**: Standard ERC20 transfer functionality
- ✅ **Approval system**: Allowance management and transferFrom
- ✅ **Zero amount transfers**: Edge case handling
- ✅ **Self transfers**: Transfer to same address
- ✅ **Max approval**: Type(uint256).max allowance

### Security and Access Control Tests
- ✅ **Public vault configuration**: Anyone can set vault addresses
- ✅ **Input validation**: Proper parameter validation
- ✅ **Pool key validation**: Currency and configuration checks
- ✅ **Vault address mapping**: Correct currency-to-vault mapping

Run specific test categories:
```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test test_full_cycle
```

## Deployment Scripts

The project includes two deployment scripts:

### 1. CorrectedSwapTest Script (`script/00_CorrectedSwapTest.s.sol`)

**Full deployment and testing script that:**
1. **Hook Deployment**: Creates a properly flagged hook contract using HookMiner
2. **Mock Token Creation**: Deploys test ERC20 tokens with mint functionality
3. **Vault Setup**: Creates ERC4626 mock vaults for both currencies
4. **Pool Initialization**: Sets up the Uniswap v4 pool with correct configuration
5. **Liquidity Provision**: Adds initial liquidity to the pool
6. **Swap Testing**: Executes a test swap to verify JIT liquidity provision

### 2. SimpleSwapOnly Script (`script/01_SimpleSwapOnly.s.sol`)

**Lightweight script for testing with existing contracts:**
- Uses pre-deployed hook and token addresses
- Executes swap operations to test JIT liquidity
- Minimal setup for quick testing

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

// Base Sepolia addresses
address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
```

## Events

The hook emits several events for tracking operations:

- `VaultsSet(address indexed vault0, address indexed vault1)`: Vault addresses configured
- `ReHypothecatedLiquidityAdded(address indexed user, uint128 indexed liquidity, uint256 amount0, uint256 amount1)`: User adds liquidity
- `ReHypothecatedLiquidityRemoved(address indexed owner, uint128 indexed sharesAmount, uint256 amount0, uint256 amount1)`: User removes liquidity
- `PoolInitialized(address indexed currency0, address indexed currency1, uint24 indexed fee, int24 tickSpacing)`: Pool configuration stored
- `LiquidityProvided(bytes32 indexed poolId, uint128 indexed liquidity, uint256 amount0, uint256 amount1)`: JIT liquidity added during swap
- `LiquidityRemoved(bytes32 indexed poolId, uint128 indexed liquidity, uint256 amount0, uint256 amount1)`: JIT liquidity removed after swap

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
forge script script/00_CorrectedSwapTest.s.sol:CorrectedSwapTest --rpc-url http://localhost:8545 --broadcast --legacy
```

## Security Considerations

- **Public Vault Configuration**: Anyone can set vault addresses (no owner restrictions)
- **Input Validation**: All inputs are validated before processing (zero liquidity, invalid currencies)
- **Single Pool Initialization**: Pool can only be initialized once per hook instance
- **Precision Handling**: Careful handling of rounding and precision issues with FullMath
- **Vault Integration**: Robust error handling for vault interactions with proper revert handling
- **ERC20 Compliance**: Full ERC20 standard implementation with proper transfer mechanics
- **Hook Permissions**: Properly configured hook permissions for Uniswap v4 integration

## Additional Resources

- [Uniswap v4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [ERC4626 Vault Standard](https://eips.ethereum.org/EIPS/eip-4626)
- [Uniswap v4 Core](https://github.com/uniswap/v4-core)
- [Uniswap v4 Periphery](https://github.com/uniswap/v4-periphery)
