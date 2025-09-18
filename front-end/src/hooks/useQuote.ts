import { useState, useEffect } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import { parseEther, formatEther, keccak256, encodePacked } from 'viem'
import PoolManagerAbi from '../utils/contracts/PoolManager.abi.json'

export function useQuote() {
    const publicClient = usePublicClient()

    // Pool Manager address
    const POOL_MANAGER_ADDRESS = '0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408' as const

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
        const encoded = encodePacked(
            ['address', 'address', 'uint24', 'int24', 'address'],
            [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
        )
        return keccak256(encoded)
    }

    // Read pool state using extsload
    const readPoolState = async () => {
        if (!publicClient) return null

        try {
            setIsLoadingSlot0(true)

            const poolId = calculatePoolId(poolKey)

            // In Uniswap V4, pool state is stored in specific storage slots
            // The pool state slot is calculated as keccak256(poolId, POOL_STATE_SLOT)
            // POOL_STATE_SLOT is typically 0x0000000000000000000000000000000000000000000000000000000000000000
            const POOL_STATE_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000000'
            const poolStateSlot = keccak256(encodePacked(['bytes32', 'bytes32'], [poolId, POOL_STATE_SLOT]))

            // Read the pool state slot
            const poolStateData = await publicClient.readContract({
                address: POOL_MANAGER_ADDRESS,
                abi: PoolManagerAbi.abi,
                functionName: 'extsload',
                args: [poolStateSlot]
            })

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
        return price
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
        const inversePriceFormatted = formatEther((BigInt(10) ** BigInt(36)) / currentPrice)

        return {
            poolKey,
            currentPrice: priceFormatted,
            inversePrice: inversePriceFormatted,
            token0Quote: token0Amount ? calculateQuote(token0Amount, true) : null,
            token1Quote: token1Amount ? calculateQuote(token1Amount, false) : null
        }
    }

    return {
        poolKey,
        slot0Data,
        isLoadingSlot0,
        poolInitialized,
        calculateQuote,
        getQuote,
        refetchSlot0
    }
}
