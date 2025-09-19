import { createPublicClient, http, keccak256, encodePacked, encodeAbiParameters } from 'viem'
import { baseSepolia } from 'viem/chains'
import PoolManagerAbi from './contracts/PoolManager.abi.json'

// Test different methods to read pool state
export async function testPoolStateReading() {
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http('https://sepolia.base.org')
    })

    const POOL_MANAGER_ADDRESS = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as const

    const poolKey = {
        currency0: '0x527d20fc27d03c33eb9909079b0ab1c844fb375e' as `0x${string}`,
        currency1: '0xdbd54f088b97cd4af1dee26a6cb14cd89499ce1e' as `0x${string}`,
        fee: 300,
        tickSpacing: 60,
        hooks: '0xfd6a5e131eb3e022a354783a0768799eadf020c0' as `0x${string}`
    }

    // Calculate pool ID using correct method
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

    console.log('Pool ID:', poolId)

    // Known values from the transaction
    const expectedSqrtPriceX96 = '4039859466863342444871680'
    const expectedTick = -197688

    console.log('Expected sqrtPriceX96:', expectedSqrtPriceX96)
    console.log('Expected tick:', expectedTick)

    // Try different storage slot calculations
    const POOL_STATE_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000000'

    // Method 1: keccak256(poolId, POOL_STATE_SLOT)
    const slot1 = keccak256(encodePacked(['bytes32', 'bytes32'], [poolId, POOL_STATE_SLOT]))

    // Method 2: keccak256(POOL_STATE_SLOT, poolId)
    const slot2 = keccak256(encodePacked(['bytes32', 'bytes32'], [POOL_STATE_SLOT, poolId]))

    // Method 3: Direct hash of poolId
    const slot3 = keccak256(poolId)

    // Method 4: Try different slot numbers
    const slot4 = keccak256(encodePacked(['bytes32', 'uint256'], [poolId, 0n]))
    const slot5 = keccak256(encodePacked(['bytes32', 'uint256'], [poolId, 1n]))

    console.log('Slot 1 (poolId, POOL_STATE_SLOT):', slot1)
    console.log('Slot 2 (POOL_STATE_SLOT, poolId):', slot2)
    console.log('Slot 3 (poolId only):', slot3)
    console.log('Slot 4 (poolId, 0):', slot4)
    console.log('Slot 5 (poolId, 1):', slot5)

    // Try reading each slot
    const slots = [
        { name: 'Slot 1', slot: slot1 },
        { name: 'Slot 2', slot: slot2 },
        { name: 'Slot 3', slot: slot3 },
        { name: 'Slot 4', slot: slot4 },
        { name: 'Slot 5', slot: slot5 }
    ]

    for (const { name, slot } of slots) {
        try {
            // Try extsload first
            let data
            try {
                data = await publicClient.readContract({
                    address: POOL_MANAGER_ADDRESS,
                    abi: PoolManagerAbi.abi,
                    functionName: 'extsload',
                    args: [slot]
                })
            } catch (error) {
                // Try direct storage read
                data = await publicClient.getStorageAt({
                    address: POOL_MANAGER_ADDRESS,
                    slot: slot
                })
            }

            console.log(`${name} data:`, data)

            if (data && data !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const dataBigInt = BigInt(data)
                console.log(`${name} BigInt:`, dataBigInt.toString())

                // Try to extract sqrtPriceX96 (first 160 bits)
                const sqrtPriceX96 = dataBigInt & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
                console.log(`${name} sqrtPriceX96:`, sqrtPriceX96.toString())

                if (sqrtPriceX96.toString() === expectedSqrtPriceX96) {
                    console.log(`✅ Found correct data in ${name}!`)
                    return { slot, data, sqrtPriceX96 }
                }
            }
        } catch (error) {
            console.log(`${name} error:`, error.message)
        }
    }

    // If no slot worked, let's try to find the correct slot by searching
    console.log('\nSearching for the correct slot...')

    // Try a range of slots around the calculated ones
    for (let i = 0; i < 10; i++) {
        const testSlot = keccak256(encodePacked(['bytes32', 'uint256'], [poolId, BigInt(i)]))
        try {
            const data = await publicClient.getStorageAt({
                address: POOL_MANAGER_ADDRESS,
                slot: testSlot
            })

            if (data && data !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const dataBigInt = BigInt(data)
                const sqrtPriceX96 = dataBigInt & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')

                console.log(`Slot ${i} (${testSlot}):`, data)
                console.log(`  sqrtPriceX96:`, sqrtPriceX96.toString())

                if (sqrtPriceX96.toString() === expectedSqrtPriceX96) {
                    console.log(`✅ Found correct data in slot ${i}!`)
                    return { slot: testSlot, data, sqrtPriceX96 }
                }
            }
        } catch (error) {
            // Ignore errors for this search
        }
    }

    console.log('❌ Could not find the correct pool state slot')
    return null
}

// Run the test
if (typeof window === 'undefined') {
    testPoolStateReading().then(result => {
        if (result) {
            console.log('✅ Pool state reading test completed successfully')
        } else {
            console.log('❌ Pool state reading test failed')
        }
    })
}
