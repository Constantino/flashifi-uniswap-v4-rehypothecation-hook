# Pool Manager Quote Implementation

This implementation uses the Pool Manager contract at `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` to get quotes for token1 and token2.

## Pool Details

- **Pool Manager**: `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`
- **Token0**: `0x8bE63EBcA9A9c023247E7DD93283f38865664A44`
- **Token1**: `0xb4BEEC36c585AC9b4c9C85955be87614C235BfA4`
- **Fee**: 300 (0.3%)
- **Tick Spacing**: 60
- **Hooks**: `0xE35D0a4BF289646D93A18ef6dAbF4732304be0C0`

## Pool Key Structure

```typescript
const poolKey = {
    currency0: '0x8bE63EBcA9A9c023247E7DD93283f38865664A44',
    currency1: '0xb4BEEC36c585AC9b4c9C85955be87614C235BfA4',
    fee: 300,
    tickSpacing: 60,
    hooks: '0xE35D0a4BF289646D93A18ef6dAbF4732304be0C0'
}
```

## Pool ID Calculation

The Pool ID is calculated as:
```typescript
const poolId = keccak256(
    encodePacked(
        ['address', 'address', 'uint24', 'int24', 'address'],
        [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    )
)
```

## Usage

### 1. React Hook

```typescript
import { usePoolManagerQuote } from '../hooks/usePoolManagerQuote'

function MyComponent() {
    const { 
        getQuote, 
        poolInitialized, 
        isLoadingSlot0,
        poolId,
        poolKey 
    } = usePoolManagerQuote()

    const handleGetQuotes = async () => {
        const quotes = await getQuote('1', '1') // 1 token0, 1 token1
        console.log(quotes)
    }

    return (
        <div>
            <button onClick={handleGetQuotes}>Get Quotes</button>
        </div>
    )
}
```

### 2. Component Usage

```typescript
import PoolManagerQuoteDisplay from '../components/PoolManagerQuoteDisplay'

function MyPage() {
    return (
        <div>
            <h1>Pool Quotes</h1>
            <PoolManagerQuoteDisplay />
        </div>
    )
}
```

### 3. Direct Contract Interaction

```typescript
import { getPoolManagerQuoteExample } from '../utils/poolManagerQuoteExample'

// Get quotes
const quotes = await getPoolManagerQuoteExample()
console.log(quotes)
```

## How It Works

1. **Pool State Reading**: Uses the `extsload` function to read the pool state from storage
2. **Price Calculation**: Extracts `sqrtPriceX96` from the pool state and calculates the current price
3. **Quote Calculation**: Calculates exchange rates between token0 and token1 based on the current price

## Pool State Structure

The pool state is stored as a 256-bit value containing:
- **sqrtPriceX96** (160 bits): Square root of the price multiplied by 2^96
- **tick** (24 bits): Current tick
- **protocolFee** (24 bits): Protocol fee
- **lpFee** (24 bits): LP fee

## Quote Response Format

```typescript
interface QuoteResponse {
    poolKey: {
        currency0: string
        currency1: string
        fee: number
        tickSpacing: number
        hooks: string
    }
    poolId: string
    currentPrice: string // Token1 per Token0
    inversePrice: string // Token0 per Token1
    token0Quote: {
        inputAmount: string
        outputAmount: string
        price: string
        direction: string
    }
    token1Quote: {
        inputAmount: string
        outputAmount: string
        price: string
        direction: string
    }
    sqrtPriceX96: string
    priceInWei: string
}
```

## Error Handling

The implementation handles:
- Network connectivity issues
- Pool not initialized
- Invalid pool data
- Contract read failures

## Network Requirements

- **Network**: Base Sepolia Testnet (Chain ID: 84532)
- **RPC URL**: https://sepolia.base.org
- **Block Explorer**: https://sepolia.basescan.org

## Files

- `src/hooks/usePoolManagerQuote.ts` - React hook implementation
- `src/components/PoolManagerQuoteDisplay.tsx` - UI component
- `src/utils/poolManagerQuoteExample.ts` - Direct contract interaction examples
- `src/pages/Features.tsx` - Integration example
