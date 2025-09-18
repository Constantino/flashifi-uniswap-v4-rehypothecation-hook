import { useState, useEffect } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { parseEther, formatEther, keccak256, encodePacked, encodeAbiParameters } from 'viem'
import PoolManagerAbi from '../utils/contracts/PoolManager.abi.json'

export function usePoolManagerQuote() {
    const publicClient = usePublicClient()

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

    // Pool state data
    const [slot0Data, setSlot0Data] = useState<[bigint, number, number, number] | null>(null)
    const [isLoadingSlot0, setIsLoadingSlot0] = useState(false)
    const [poolInitialized, setPoolInitialized] = useState(false)

    // Calculate pool ID from pool key
    const calculatePoolId = (key: typeof poolKey) => {
        // In Uniswap V4, pool ID is calculated as keccak256(abi.encode(key))
        // Use proper ABI encoding, not packed encoding
        const encoded = encodeAbiParameters(
            [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' }
            ],
            [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
        )
        const poolId = keccak256(encoded)
        console.log('Calculated Pool ID:', poolId)
        console.log('Expected Pool ID from transaction:', '0xB37841EDB256CDEFD7F0846A9E5C63C3AA4E56741308F01E59A108BF74C2AD33')
        return poolId
    }

    // Read pool state using extsload
    const readPoolState = async () => {
        if (!publicClient) return null

        try {
            setIsLoadingSlot0(true)

            const poolId = calculatePoolId(poolKey)
            console.log('Pool ID:', poolId)

            // In Uniswap V4, pool state is stored in specific storage slots
            // The pool state slot is calculated as keccak256(poolId, 6)
            // Slot 6 contains the pool state data
            const poolStateSlot = keccak256(encodePacked(['bytes32', 'uint256'], [poolId, 6n]))

            console.log('Pool State Slot:', poolStateSlot)

            // Try to read the pool state slot using extsload
            let poolStateData
            try {
                poolStateData = await publicClient.readContract({
                    address: POOL_MANAGER_ADDRESS,
                    abi: PoolManagerAbi.abi,
                    functionName: 'extsload',
                    args: [poolStateSlot]
                })
            } catch (error) {
                console.error('Error reading pool state with extsload:', error)
                // Try alternative method - direct storage read
                try {
                    poolStateData = await publicClient.getStorageAt({
                        address: POOL_MANAGER_ADDRESS,
                        slot: poolStateSlot
                    })
                    console.log('Fallback storage read successful')
                } catch (fallbackError) {
                    console.error('Fallback storage read also failed:', fallbackError)
                    throw error
                }
            }

            console.log('Pool State Data:', poolStateData)
            console.log('Pool State Data (BigInt):', BigInt(poolStateData).toString())

            if (poolStateData && poolStateData !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                // Parse the pool state data
                // The first 32 bytes contain sqrtPriceX96 (uint160), tick (int24), protocolFee (uint24), lpFee (uint24)
                const data = BigInt(poolStateData)

                // Extract sqrtPriceX96 (first 160 bits)
                const sqrtPriceX96 = data & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')

                // Extract tick (next 24 bits, signed)
                const tickRaw = (data >> BigInt(160)) & BigInt('0xFFFFFF')
                const tick = tickRaw > BigInt('0x7FFFFF') ? Number(tickRaw - BigInt('0x1000000')) : Number(tickRaw)

                // Extract protocolFee (next 24 bits)
                const protocolFee = Number((data >> BigInt(184)) & BigInt('0xFFFFFF'))

                // Extract lpFee (next 24 bits)
                const lpFee = Number((data >> BigInt(208)) & BigInt('0xFFFFFF'))

                console.log('Parsed Pool State:', {
                    sqrtPriceX96: sqrtPriceX96.toString(),
                    tick,
                    protocolFee,
                    lpFee
                })

                setSlot0Data([sqrtPriceX96, tick, protocolFee, lpFee])
                setPoolInitialized(true)
            } else {
                setPoolInitialized(false)
                setSlot0Data(null)
            }
        } catch (error) {
            console.error('Error reading pool state:', error)
            setPoolInitialized(false)
            setSlot0Data(null)
        } finally {
            setIsLoadingSlot0(false)
        }
    }

    // Load pool data on mount
    useEffect(() => {
        readPoolState()
    }, [publicClient])

    const refetchSlot0 = readPoolState

    // Calculate price from sqrtPriceX96
    const calculatePrice = (sqrtPriceX96: bigint) => {
        // Price = (sqrtPriceX96 / 2^96)^2
        // For token1 in terms of token0
        const Q96 = BigInt(2) ** BigInt(96)
        const price = (sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96)

        // Calculate price with proper precision (18 decimals)
        const priceWithPrecision = (sqrtPriceX96 * sqrtPriceX96 * (BigInt(10) ** BigInt(18))) / (Q96 * Q96)
        return priceWithPrecision
    }

    // Calculate quote for token amounts
    const calculateQuote = (inputAmount: string, isToken0ToToken1: boolean) => {
        if (!slot0Data) return null

        const [sqrtPriceX96] = slot0Data

        if (!sqrtPriceX96) return null

        const inputAmountWei = parseEther(inputAmount)
        const currentPrice = calculatePrice(sqrtPriceX96)

        if (isToken0ToToken1) {
            // Converting token0 to token1
            // output = input * price
            const outputAmount = (inputAmountWei * currentPrice) / (BigInt(10) ** BigInt(18))
            return {
                inputAmount: inputAmount,
                outputAmount: formatEther(outputAmount),
                price: formatEther(currentPrice),
                direction: 'token0 -> token1'
            }
        } else {
            // Converting token1 to token0
            // output = input / price
            const outputAmount = (inputAmountWei * (BigInt(10) ** BigInt(18))) / currentPrice
            return {
                inputAmount: inputAmount,
                outputAmount: formatEther(outputAmount),
                price: formatEther((BigInt(10) ** BigInt(36)) / currentPrice), // Inverse price
                direction: 'token1 -> token0'
            }
        }
    }

    // Calculate deltas for liquidity operations
    const calculateLiquidityDeltas = (liquidityAmount: string, tickLower: number = -887220, tickUpper: number = 887220) => {
        if (!slot0Data || !liquidityAmount || liquidityAmount === '0') {
            return null
        }

        const [sqrtPriceX96, currentTick] = slot0Data
        if (!sqrtPriceX96) return null

        const liquidityDelta = parseEther(liquidityAmount)
        const currentPrice = calculatePrice(sqrtPriceX96)

        // Calculate the amount of token0 and token1 needed for the given liquidity
        // This is a simplified calculation - in practice, you'd need to consider the tick range
        // and use the proper Uniswap V4 liquidity math

        // For a full-range position (tickLower = -887220, tickUpper = 887220)
        // The liquidity represents the square root of the product of token amounts
        // L = sqrt(x * y) where x is token0 amount and y is token1 amount

        // At current price: y = x * price
        // So: L = sqrt(x * x * price) = x * sqrt(price)
        // Therefore: x = L / sqrt(price), y = L * sqrt(price)

        const Q96 = BigInt(2) ** BigInt(96)
        const sqrtPrice = sqrtPriceX96

        // Calculate token amounts based on current price
        // This is a simplified calculation for demonstration
        const token0Amount = (liquidityDelta * Q96) / sqrtPrice
        const token1Amount = (liquidityDelta * sqrtPrice) / Q96

        return {
            liquidityDelta: formatEther(liquidityDelta),
            token0Delta: formatEther(token0Amount),
            token1Delta: formatEther(token1Amount),
            currentTick,
            tickLower,
            tickUpper,
            price: formatEther(currentPrice)
        }
    }

    const getQuote = async (token0Amount: string, token1Amount: string) => {
        if (!slot0Data) {
            console.error('Pool data not available')
            return null
        }

        const [sqrtPriceX96] = slot0Data

        if (!sqrtPriceX96) {
            console.error('Invalid pool data')
            return null
        }

        const currentPrice = calculatePrice(sqrtPriceX96)
        const priceFormatted = formatEther(currentPrice)

        // Calculate inverse price with proper precision
        const Q96 = BigInt(2) ** BigInt(96)
        const inversePrice = (Q96 * Q96 * (BigInt(10) ** BigInt(18))) / (sqrtPriceX96 * sqrtPriceX96)
        const inversePriceFormatted = formatEther(inversePrice)

        return {
            poolKey,
            poolId: calculatePoolId(poolKey),
            currentPrice: priceFormatted,
            inversePrice: inversePriceFormatted,
            token0Quote: token0Amount ? calculateQuote(token0Amount, true) : null,
            token1Quote: token1Amount ? calculateQuote(token1Amount, false) : null,
            // Additional pool information
            sqrtPriceX96: sqrtPriceX96.toString(),
            priceInWei: currentPrice.toString(),
            // Token addresses
            token0Address: poolKey.currency0,
            token1Address: poolKey.currency1,
            // Pool parameters
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hooks: poolKey.hooks
        }
    }

    return {
        poolKey,
        poolId: calculatePoolId(poolKey),
        slot0Data,
        isLoadingSlot0,
        poolInitialized,
        calculateQuote,
        calculateLiquidityDeltas,
        getQuote,
        refetchSlot0
    }
}
