export const ReHypothecationHookAbi = [
    {
        "type": "constructor",
        "inputs": [
            {
                "name": "_poolManager",
                "type": "address",
                "internalType": "contract IPoolManager"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addReHypothecatedLiquidity",
        "inputs": [
            {
                "name": "liquidity",
                "type": "uint128",
                "internalType": "uint128"
            }
        ],
        "outputs": [
            {
                "name": "delta",
                "type": "int256",
                "internalType": "BalanceDelta"
            }
        ],
        "stateMutability": "payable"
    }
] as const
