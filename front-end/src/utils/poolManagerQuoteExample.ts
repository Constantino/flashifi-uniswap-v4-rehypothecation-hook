import { createPublicClient, http, parseEther, formatEther, keccak256, encodePacked, encodeAbiParameters } from 'viem'
import { baseSepolia } from 'viem/chains'
import PoolManagerAbi from './contracts/PoolManager.abi.json'

// Example function to get quotes using the Pool Manager contract directly
export async function getPoolManagerQuoteExample() {
    // Create a public client for Base Sepolia
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    })

    // Pool Manager address
    const POOL_MANAGER_ADDRESS = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as const

    // Pool key from the user's request
    const poolKey = {
        currency0: '0x8bE63EBcA9A9c023247E7DD93283f38865664A44' as `0x${string}`,
        currency1: '0xb4BEEC36c585AC9b4c9C85955be87614C235BfA4' as `0x${string}`,
        fee: 300,
        tickSpacing: 60,
        hooks: '0xE35D0a4BF289646D93A18ef6dAbF4732304be0C0' as `0x${string}`
    }

    try {
        // Calculate pool ID using proper ABI encoding
        const poolId = keccak256(
            encodeAbiParameters(
                [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' }
                ],
                [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
            )
        )

        console.log('Pool Key:', poolKey)
        console.log('Pool ID:', poolId)

        // Read pool state using extsload
        // The pool state slot is calculated as keccak256(poolId, 6)
        const poolStateSlot = keccak256(encodePacked(['bytes32', 'uint256'], [poolId, 6n]))

        console.log('Pool State Slot:', poolStateSlot)

        const poolStateData = await publicClient.readContract({
            address: POOL_MANAGER_ADDRESS,
            abi: PoolManagerAbi.abi,
            functionName: 'extsload',
            args: [poolStateSlot]
        })

        console.log('Pool State Data:', poolStateData)

        if (poolStateData && poolStateData !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            // Parse pool state
            const data = BigInt(poolStateData)
            const sqrtPriceX96 = data & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')

            // Calculate price
            const Q96 = BigInt(2) ** BigInt(96)
            const price = (sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96)

            console.log('Q96:', Q96.toString())
            console.log('sqrtPriceX96 * sqrtPriceX96:', (sqrtPriceX96 * sqrtPriceX96).toString())
            console.log('Q96 * Q96:', (Q96 * Q96).toString())
            console.log('Price calculation:', price.toString())

            console.log('SqrtPriceX96:', sqrtPriceX96.toString())
            console.log('Price (Token1/Token0):', price.toString())

            // Calculate price with proper precision
            const priceWithPrecision = (sqrtPriceX96 * sqrtPriceX96 * (BigInt(10) ** BigInt(18))) / (Q96 * Q96)
            console.log('Price with 18 decimals:', priceWithPrecision.toString())
            console.log('Price formatted:', formatEther(priceWithPrecision))

            // Calculate inverse price
            const inversePrice = (Q96 * Q96 * (BigInt(10) ** BigInt(18))) / (sqrtPriceX96 * sqrtPriceX96)
            console.log('Inverse Price (Token0/Token1):', inversePrice.toString())
            console.log('Inverse Price formatted:', formatEther(inversePrice))

            // Calculate quotes for 1 token of each
            const token0Amount = parseEther('1')
            const token1Amount = parseEther('1')

            // Token0 to Token1 quote
            const token0ToToken1Output = (token0Amount * priceWithPrecision) / (BigInt(10) ** BigInt(18))

            // Token1 to Token0 quote
            const token1ToToken0Output = (token1Amount * (BigInt(10) ** BigInt(18))) / priceWithPrecision

            const quotes = {
                poolKey,
                poolId,
                currentPrice: formatEther(priceWithPrecision),
                inversePrice: formatEther(inversePrice),
                token0Quote: {
                    inputAmount: '1',
                    outputAmount: formatEther(token0ToToken1Output),
                    price: formatEther(priceWithPrecision),
                    direction: 'token0 -> token1'
                },
                token1Quote: {
                    inputAmount: '1',
                    outputAmount: formatEther(token1ToToken0Output),
                    price: formatEther(inversePrice),
                    direction: 'token1 -> token0'
                },
                sqrtPriceX96: sqrtPriceX96.toString(),
                priceInWei: price.toString()
            }

            console.log('Quotes:', JSON.stringify(quotes, null, 2))
            return quotes
        } else {
            console.log('Pool not initialized')
            return null
        }
    } catch (error) {
        console.error('Error getting quotes:', error)
        return null
    }
}

// Example function to read pool state directly
export async function readPoolStateExample() {
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    })

    const POOL_MANAGER_ADDRESS = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as const

    const poolKey = {
        currency0: '0x8bE63EBcA9A9c023247E7DD93283f38865664A44' as `0x${string}`,
        currency1: '0xb4BEEC36c585AC9b4c9C85955be87614C235BfA4' as `0x${string}`,
        fee: 300,
        tickSpacing: 60,
        hooks: '0xE35D0a4BF289646D93A18ef6dAbF4732304be0C0' as `0x${string}`
    }

    try {
        const poolId = keccak256(
            encodeAbiParameters(
                [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' }
                ],
                [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
            )
        )

        const poolStateSlot = keccak256(encodePacked(['bytes32', 'uint256'], [poolId, 6n]))

        const poolStateData = await publicClient.readContract({
            address: POOL_MANAGER_ADDRESS,
            abi: PoolManagerAbi.abi,
            functionName: 'extsload',
            args: [poolStateSlot]
        })

        console.log('Pool State Data:', poolStateData)
        return poolStateData
    } catch (error) {
        console.error('Error reading pool state:', error)
        return null
    }
}

// Example usage
if (typeof window === 'undefined') {
    // Only run in Node.js environment
    getPoolManagerQuoteExample().then(quotes => {
        if (quotes) {
            console.log('Pool Manager quote example completed successfully')
        }
    })

    readPoolStateExample().then(state => {
        if (state) {
            console.log('Pool state reading example completed successfully')
        }
    })
}
