import { keccak256, encodePacked, encodeAbiParameters } from 'viem'

// Test function to verify pool ID calculation
export function testPoolIdCalculation() {
    const poolKey = {
        currency0: '0x8bE63EBcA9A9c023247E7DD93283f38865664A44' as `0x${string}`,
        currency1: '0xb4BEEC36c585AC9b4c9C85955be87614C235BfA4' as `0x${string}`,
        fee: 300,
        tickSpacing: 60,
        hooks: '0xE35D0a4BF289646D93A18ef6dAbF4732304be0C0' as `0x${string}`
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
        currency0: '0x8bE63EBcA9A9c023247E7DD93283f38865664A44' as `0x${string}`,
        currency1: '0xb4BEEC36c585AC9b4c9C85955be87614C235BfA4' as `0x${string}`,
        fee: 300,
        tickSpacing: 60,
        hooks: '0xE35D0a4BF289646D93A18ef6dAbF4732304be0C0' as `0x${string}`
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
