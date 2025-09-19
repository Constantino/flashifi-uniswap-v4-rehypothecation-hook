import { keccak256, encodePacked, encodeAbiParameters } from 'viem'

// Test function to verify pool ID calculation
export function testPoolIdCalculation() {
    const poolKey = {
        currency0: '0x527d20fc27d03c33eb9909079b0ab1c844fb375e' as `0x${string}`,
        currency1: '0xdbd54f088b97cd4af1dee26a6cb14cd89499ce1e' as `0x${string}`,
        fee: 300,
        tickSpacing: 60,
        hooks: '0xfd6a5e131eb3e022a354783a0768799eadf020c0' as `0x${string}`
    }

    // Expected pool ID from the transaction
    const expectedPoolId = '0xB37841EDB256CDEFD7F0846A9E5C63C3AA4E56741308F01E59A108BF74C2AD33'

    // Calculate pool ID
    const encoded = encodePacked(
        ['address', 'address', 'uint24', 'int24', 'address'],
        [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    )
    const calculatedPoolId = keccak256(encoded)

    console.log('Pool Key:', poolKey)
    console.log('Encoded:', encoded)
    console.log('Calculated Pool ID:', calculatedPoolId)
    console.log('Expected Pool ID:', expectedPoolId)
    console.log('Match:', calculatedPoolId.toLowerCase() === expectedPoolId.toLowerCase())

    return {
        poolKey,
        encoded,
        calculatedPoolId,
        expectedPoolId,
        match: calculatedPoolId.toLowerCase() === expectedPoolId.toLowerCase()
    }
}

// Test different encoding methods
export function testAlternativeEncodings() {
    const poolKey = {
        currency0: '0x527d20fc27d03c33eb9909079b0ab1c844fb375e' as `0x${string}`,
        currency1: '0xdbd54f088b97cd4af1dee26a6cb14cd89499ce1e' as `0x${string}`,
        fee: 300,
        tickSpacing: 60,
        hooks: '0xfd6a5e131eb3e022a354783a0768799eadf020c0' as `0x${string}`
    }

    const expectedPoolId = '0xB37841EDB256CDEFD7F0846A9E5C63C3AA4E56741308F01E59A108BF74C2AD33'

    // Method 1: encodePacked
    const method1 = keccak256(
        encodePacked(
            ['address', 'address', 'uint24', 'int24', 'address'],
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        )
    )

    // Method 2: Try different order
    const method2 = keccak256(
        encodePacked(
            ['address', 'address', 'uint24', 'int24', 'address'],
            [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
        )
    )

    // Method 3: Try with encodeAbiParameters (proper ABI encoding)
    const method3 = keccak256(
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

    // Method 4: Try with tuple encoding
    const method4 = keccak256(
        encodeAbiParameters(
            [{
                name: 'key', type: 'tuple', components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' }
                ]
            }],
            [[poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]]
        )
    )

    console.log('Method 1 (encodePacked):', method1)
    console.log('Method 2 (same):', method2)
    console.log('Method 3 (encodeAbiParameters):', method3)
    console.log('Method 4 (tuple encoding):', method4)
    console.log('Expected:', expectedPoolId)
    console.log('Method 1 match:', method1.toLowerCase() === expectedPoolId.toLowerCase())
    console.log('Method 3 match:', method3.toLowerCase() === expectedPoolId.toLowerCase())
    console.log('Method 4 match:', method4.toLowerCase() === expectedPoolId.toLowerCase())

    return {
        method1,
        method2,
        method3,
        method4,
        expectedPoolId,
        match: method1.toLowerCase() === expectedPoolId.toLowerCase() ||
            method3.toLowerCase() === expectedPoolId.toLowerCase() ||
            method4.toLowerCase() === expectedPoolId.toLowerCase()
    }
}

// Run the test
if (typeof window === 'undefined') {
    console.log('Testing Pool ID Calculation...')
    testPoolIdCalculation()
    console.log('\nTesting Alternative Encodings...')
    testAlternativeEncodings()
}
