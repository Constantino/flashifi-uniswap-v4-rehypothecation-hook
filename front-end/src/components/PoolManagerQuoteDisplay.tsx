import React, { useState, useEffect } from 'react'
import { usePoolManagerQuote } from '../hooks/usePoolManagerQuote'

const PoolManagerQuoteDisplay: React.FC = () => {
    const {
        getQuote,
        poolInitialized,
        isLoadingSlot0,
        poolId,
        poolKey
    } = usePoolManagerQuote()

    const [quotes, setQuotes] = useState<any>(null)
    const [token0Amount, setToken0Amount] = useState('1')
    const [token1Amount, setToken1Amount] = useState('1')

    const handleGetQuotes = async () => {
        const result = await getQuote(token0Amount, token1Amount)
        setQuotes(result)
    }

    useEffect(() => {
        if (poolInitialized) {
            handleGetQuotes()
        }
    }, [poolInitialized])

    if (isLoadingSlot0) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">Loading Pool Data...</h2>
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        )
    }

    if (!poolInitialized) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4 text-red-600">Pool Not Initialized</h2>
                <p className="text-gray-600">The pool data could not be loaded. Please check the network and contract addresses.</p>
            </div>
        )
    }

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">Pool Manager Quote Information</h2>

            {/* Contract Information */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Pool Details</h3>
                <p className="text-sm text-gray-600">
                    <strong>Pool Manager:</strong>
                    <a
                        href={`https://sepolia.basescan.org/address/0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-1"
                    >
                        0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408
                    </a>
                </p>
                <p className="text-sm text-gray-600">
                    <strong>Pool ID:</strong>
                    <span className="font-mono text-xs">{poolId}</span>
                </p>
                <p className="text-sm text-gray-600">
                    <strong>Token0:</strong>
                    <a
                        href={`https://sepolia.basescan.org/address/${poolKey.currency0}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-1"
                    >
                        {poolKey.currency0}
                    </a>
                </p>
                <p className="text-sm text-gray-600">
                    <strong>Token1:</strong>
                    <a
                        href={`https://sepolia.basescan.org/address/${poolKey.currency1}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-1"
                    >
                        {poolKey.currency1}
                    </a>
                </p>
                <p className="text-sm text-gray-600">
                    <strong>Fee:</strong> {poolKey.fee} (0.3%) | <strong>Tick Spacing:</strong> {poolKey.tickSpacing}
                </p>
                <p className="text-sm text-gray-600">
                    <strong>Hooks:</strong>
                    <a
                        href={`https://sepolia.basescan.org/address/${poolKey.hooks}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline ml-1"
                    >
                        {poolKey.hooks}
                    </a>
                </p>
            </div>

            {/* Quote Inputs */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Get Quotes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Token0 Amount
                        </label>
                        <input
                            type="number"
                            value={token0Amount}
                            onChange={(e) => setToken0Amount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter amount"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Token1 Amount
                        </label>
                        <input
                            type="number"
                            value={token1Amount}
                            onChange={(e) => setToken1Amount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter amount"
                        />
                    </div>
                </div>
                <button
                    onClick={handleGetQuotes}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Get Quotes
                </button>
            </div>

            {/* Quote Results */}
            {quotes && (
                <div className="mb-6 p-4 bg-green-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-green-800">Current Quotes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-white rounded border">
                            <h4 className="font-medium text-gray-800 mb-2">Token0 → Token1</h4>
                            <p className="text-sm text-gray-600">
                                <strong>Input:</strong> {quotes.token0Quote?.inputAmount} Token0
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Output:</strong> {quotes.token0Quote?.outputAmount} Token1
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Price:</strong> {quotes.token0Quote?.price} Token1 per Token0
                            </p>
                        </div>
                        <div className="p-3 bg-white rounded border">
                            <h4 className="font-medium text-gray-800 mb-2">Token1 → Token0</h4>
                            <p className="text-sm text-gray-600">
                                <strong>Input:</strong> {quotes.token1Quote?.inputAmount} Token1
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Output:</strong> {quotes.token1Quote?.outputAmount} Token0
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Price:</strong> {quotes.token1Quote?.price} Token0 per Token1
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-white rounded border">
                        <h4 className="font-medium text-gray-800 mb-2">Pool Information</h4>
                        <p className="text-sm text-gray-600">
                            <strong>Current Price (Token1/Token0):</strong> {quotes.currentPrice}
                        </p>
                        <p className="text-sm text-gray-600">
                            <strong>Inverse Price (Token0/Token1):</strong> {quotes.inversePrice}
                        </p>
                        <p className="text-sm text-gray-600">
                            <strong>SqrtPriceX96:</strong> {quotes.sqrtPriceX96}
                        </p>
                        <p className="text-sm text-gray-600">
                            <strong>Price in Wei:</strong> {quotes.priceInWei}
                        </p>
                    </div>
                </div>
            )}

            {/* Pool Key Information */}
            <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-2 text-blue-800">Pool Key Structure</h3>
                <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Pool Key:</strong> {JSON.stringify(poolKey, null, 2)}</p>
                    <p><strong>Pool ID (keccak256 of pool key):</strong> {poolId}</p>
                </div>
            </div>
        </div>
    )
}

export default PoolManagerQuoteDisplay
