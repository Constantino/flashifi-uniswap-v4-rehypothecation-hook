import React, { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { useReHypothecation } from '../hooks/useReHypothecation'
import { parseEther, maxUint256 } from 'viem'
import { useWriteContract, useReadContract } from 'wagmi'
import { contracts } from '../config/contracts'

const Features: React.FC = () => {
    const { isConnected, address } = useWallet()
    const { addReHypothecatedLiquidityWithValue, isPending, isConfirming, isSuccess, error, contractError, chain } = useReHypothecation()
    const { writeContract: writeContractForApproval } = useWriteContract()
    const [liquidityAmount, setLiquidityAmount] = useState('')
    const [needsApproval, setNeedsApproval] = useState(false)
    const [tokenAddress, setTokenAddress] = useState('')
    const [isMinting, setIsMinting] = useState(false)
    const [isApprovalsExpanded, setIsApprovalsExpanded] = useState(false)

    // Token addresses for approval
    const TOKEN_ADDRESSES = {
        token1: '0x8be63ebca9a9c023247e7dd93283f38865664a44',
        token2: '0xb4beec36c585ac9b4c9c85955be87614c235bfa4'
    } as const

    // FlashiFi shares contract address
    const FLASHIFI_SHARES_ADDRESS = '0xe35d0a4bf289646d93a18ef6dabf4732304be0c0' as const

    // Addresses that need token approval
    const APPROVAL_ADDRESSES = {
        hook: contracts.reHypothecationHook.address
    } as const

    const [approvalStates, setApprovalStates] = useState({
        token1: {
            hookApproved: false,
            isApproving: false
        },
        token2: {
            hookApproved: false,
            isApproving: false
        }
    })

    // Check approval status for token 1 - Hook address
    const { data: allowance1Hook, refetch: refetchAllowance1Hook } = useReadContract({
        address: TOKEN_ADDRESSES.token1 as `0x${string}`,
        abi: [
            {
                "constant": true,
                "inputs": [
                    { "name": "_owner", "type": "address" },
                    { "name": "_spender", "type": "address" }
                ],
                "name": "allowance",
                "outputs": [{ "name": "", "type": "uint256" }],
                "type": "function"
            }
        ],
        functionName: 'allowance',
        args: [address as `0x${string}`, APPROVAL_ADDRESSES.hook],
        query: {
            enabled: !!address && isConnected
        }
    })


    // Check approval status for token 2 - Hook address
    const { data: allowance2Hook, refetch: refetchAllowance2Hook } = useReadContract({
        address: TOKEN_ADDRESSES.token2 as `0x${string}`,
        abi: [
            {
                "constant": true,
                "inputs": [
                    { "name": "_owner", "type": "address" },
                    { "name": "_spender", "type": "address" }
                ],
                "name": "allowance",
                "outputs": [{ "name": "", "type": "uint256" }],
                "type": "function"
            }
        ],
        functionName: 'allowance',
        args: [address as `0x${string}`, APPROVAL_ADDRESSES.hook],
        query: {
            enabled: !!address && isConnected
        }
    })

    // Get FlashiFi shares balance
    const { data: flashifiSharesBalance, refetch: refetchFlashifiSharesBalance, isLoading: isLoadingFlashifiShares } = useReadContract({
        address: FLASHIFI_SHARES_ADDRESS as `0x${string}`,
        abi: [
            {
                "constant": true,
                "inputs": [
                    { "name": "_owner", "type": "address" }
                ],
                "name": "balanceOf",
                "outputs": [{ "name": "", "type": "uint256" }],
                "type": "function"
            }
        ],
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address && isConnected
        }
    })

    // Get Token 1 balance
    const { data: token1Balance, refetch: refetchToken1Balance } = useReadContract({
        address: TOKEN_ADDRESSES.token1 as `0x${string}`,
        abi: [
            {
                "constant": true,
                "inputs": [
                    { "name": "_owner", "type": "address" }
                ],
                "name": "balanceOf",
                "outputs": [{ "name": "", "type": "uint256" }],
                "type": "function"
            }
        ],
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address && isConnected
        }
    })

    // Get Token 2 balance
    const { data: token2Balance, refetch: refetchToken2Balance } = useReadContract({
        address: TOKEN_ADDRESSES.token2 as `0x${string}`,
        abi: [
            {
                "constant": true,
                "inputs": [
                    { "name": "_owner", "type": "address" }
                ],
                "name": "balanceOf",
                "outputs": [{ "name": "", "type": "uint256" }],
                "type": "function"
            }
        ],
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address && isConnected
        }
    })


    // Update approval states when allowance data changes
    useEffect(() => {
        if (allowance1Hook !== undefined && allowance1Hook !== null && typeof allowance1Hook === 'bigint') {
            setApprovalStates(prev => ({
                ...prev,
                token1: { ...prev.token1, hookApproved: allowance1Hook > 0n }
            }))
        }
    }, [allowance1Hook])


    useEffect(() => {
        if (allowance2Hook !== undefined && allowance2Hook !== null && typeof allowance2Hook === 'bigint') {
            setApprovalStates(prev => ({
                ...prev,
                token2: { ...prev.token2, hookApproved: allowance2Hook > 0n }
            }))
        }
    }, [allowance2Hook])




    const approveToken = async (tokenAddress: string, spenderAddress: string, amount: bigint = maxUint256) => {
        try {
            // Standard ERC20 approve function
            writeContractForApproval({
                address: tokenAddress as `0x${string}`,
                abi: [
                    {
                        "constant": false,
                        "inputs": [
                            { "name": "_spender", "type": "address" },
                            { "name": "_value", "type": "uint256" }
                        ],
                        "name": "approve",
                        "outputs": [{ "name": "", "type": "bool" }],
                        "type": "function"
                    }
                ],
                functionName: 'approve',
                args: [spenderAddress as `0x${string}`, amount],
            })
        } catch (err) {
            console.error('Error in approveToken:', err)
            throw err
        }
    }

    const handleApproveToken1 = async () => {
        if (!isConnected) {
            alert('Please connect your wallet first')
            return
        }

        try {
            setApprovalStates(prev => ({
                ...prev,
                token1: { ...prev.token1, isApproving: true }
            }))


            // Approve to hook address
            await approveToken(TOKEN_ADDRESSES.token1, APPROVAL_ADDRESSES.hook, maxUint256)

            // Refetch allowance after approval
            setTimeout(() => {
                refetchAllowance1Hook()
            }, 2000)

        } catch (err) {
            console.error('Error approving token 1:', err)
        } finally {
            setApprovalStates(prev => ({
                ...prev,
                token1: { ...prev.token1, isApproving: false }
            }))
        }
    }

    const handleApproveToken2 = async () => {
        if (!isConnected) {
            alert('Please connect your wallet first')
            return
        }

        try {
            setApprovalStates(prev => ({
                ...prev,
                token2: { ...prev.token2, isApproving: true }
            }))


            // Approve to hook address
            await approveToken(TOKEN_ADDRESSES.token2, APPROVAL_ADDRESSES.hook, maxUint256)

            // Refetch allowance after approval
            setTimeout(() => {
                refetchAllowance2Hook()
            }, 2000)

        } catch (err) {
            console.error('Error approving token 2:', err)
        } finally {
            setApprovalStates(prev => ({
                ...prev,
                token2: { ...prev.token2, isApproving: false }
            }))
        }
    }

    const handleApprove = async () => {
        if (!tokenAddress) {
            alert('Please enter the token address')
            return
        }

        try {
            const amount = parseEther(liquidityAmount || '1') // Approve the amount or 1 ETH
            await approveToken(tokenAddress, contracts.reHypothecationHook.address, amount)
            setNeedsApproval(false)
        } catch (err) {
            console.error('Error approving token:', err)
        }
    }

    const handleAddLiquidity = async () => {
        if (!isConnected) {
            alert('Please connect your wallet first')
            return
        }

        if (!liquidityAmount) {
            alert('Please enter the liquidity amount')
            return
        }

        // Check if we're on the right network first
        if (chain?.id !== 84532) {
            alert('Please switch to Base Sepolia network (Chain ID: 84532) first')
            return
        }

        // Check if both tokens are approved to hook address
        if (!approvalStates.token1.hookApproved || !approvalStates.token2.hookApproved) {
            alert('Please approve both tokens to the hook address before adding liquidity.')
            return
        }

        try {
            await addReHypothecatedLiquidityWithValue(liquidityAmount)
        } catch (err) {
            console.error('Error adding liquidity:', err)
        }
    }

    const handleMintTokens = async () => {
        if (!isConnected) {
            alert('Please connect your wallet first')
            return
        }

        // Check if we're on the right network first
        if (chain?.id !== 84532) {
            alert('Please switch to Base Sepolia network (Chain ID: 84532) first')
            return
        }

        try {
            setIsMinting(true)

            // Mint Token 1
            await writeContractForApproval({
                address: TOKEN_ADDRESSES.token1 as `0x${string}`,
                abi: [
                    {
                        "constant": false,
                        "inputs": [
                            { "name": "_to", "type": "address" },
                            { "name": "_amount", "type": "uint256" }
                        ],
                        "name": "mint",
                        "outputs": [{ "name": "", "type": "bool" }],
                        "type": "function"
                    }
                ],
                functionName: 'mint',
                args: [address as `0x${string}`, parseEther('1000')],
            })

            // Mint Token 2
            await writeContractForApproval({
                address: TOKEN_ADDRESSES.token2 as `0x${string}`,
                abi: [
                    {
                        "constant": false,
                        "inputs": [
                            { "name": "_to", "type": "address" },
                            { "name": "_amount", "type": "uint256" }
                        ],
                        "name": "mint",
                        "outputs": [{ "name": "", "type": "bool" }],
                        "type": "function"
                    }
                ],
                functionName: 'mint',
                args: [address as `0x${string}`, parseEther('1000')],
            })

        } catch (err) {
            console.error('Error minting tokens:', err)
        } finally {
            setIsMinting(false)
        }
    }

    const isLoading = isPending || isConfirming || isMinting

    return (
        <div className="min-h-screen bg-gray-50 py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-8">
                        ReHypothecation Hook
                    </h1>

                    <div className="max-w-4xl mx-auto">

                        <div className="mb-6">
                            <p className="text-sm text-gray-600 mb-4">
                                Add liquidity to the rehypothecation hook. The liquidity amount is passed as a contract parameter.
                            </p>

                            {/* Mint Tokens Button */}
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h3 className="text-sm font-medium text-green-800 mb-3">Get Test Tokens</h3>
                                <p className="text-xs text-green-600 mb-4">
                                    Mint 1000 units of both test tokens to your connected address for testing purposes.
                                </p>
                                <button
                                    onClick={handleMintTokens}
                                    disabled={!isConnected || isMinting}
                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isMinting ? 'Minting Tokens...' : 'Mint 1000 units of both test tokens'}
                                </button>
                            </div>

                            {/* Token Balances - Horizontal Layout */}
                            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* FlashiFi Shares Balance Section */}
                                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                    <h3 className="text-sm font-medium text-purple-800 mb-3">FlashiFi Shares</h3>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-purple-600 mb-1">Current Balance</p>
                                            <p className="text-lg font-semibold text-purple-900">
                                                {(() => {
                                                    console.log('Flashifi Shares Debug:', {
                                                        isLoading: isLoadingFlashifiShares,
                                                        balance: flashifiSharesBalance,
                                                        address: address,
                                                        isConnected: isConnected
                                                    });
                                                    return isLoadingFlashifiShares
                                                        ? 'Loading...'
                                                        : flashifiSharesBalance !== undefined && flashifiSharesBalance !== null
                                                            ? (Number(flashifiSharesBalance) / 1e18).toFixed(6)
                                                            : '0.000000';
                                                })()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => refetchFlashifiSharesBalance()}
                                            disabled={!isConnected}
                                            className="w-full px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Refresh
                                        </button>
                                        <p className="text-xs text-purple-600 break-all">
                                            <span className="font-mono">{FLASHIFI_SHARES_ADDRESS.slice(0, 6)}...{FLASHIFI_SHARES_ADDRESS.slice(-4)}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Token 1 Balance Section */}
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h3 className="text-sm font-medium text-blue-800 mb-3">Token 1</h3>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-blue-600 mb-1">Current Balance</p>
                                            <p className="text-lg font-semibold text-blue-900">
                                                {token1Balance !== undefined && token1Balance !== null
                                                    ? (Number(token1Balance) / 1e18).toFixed(6)
                                                    : 'Loading...'
                                                }
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => refetchToken1Balance()}
                                            disabled={!isConnected}
                                            className="w-full px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Refresh
                                        </button>
                                        <p className="text-xs text-blue-600 break-all">
                                            <span className="font-mono">{TOKEN_ADDRESSES.token1.slice(0, 6)}...{TOKEN_ADDRESSES.token1.slice(-4)}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Token 2 Balance Section */}
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                    <h3 className="text-sm font-medium text-orange-800 mb-3">Token 2</h3>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-orange-600 mb-1">Current Balance</p>
                                            <p className="text-lg font-semibold text-orange-900">
                                                {token2Balance !== undefined && token2Balance !== null
                                                    ? (Number(token2Balance) / 1e18).toFixed(6)
                                                    : 'Loading...'
                                                }
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => refetchToken2Balance()}
                                            disabled={!isConnected}
                                            className="w-full px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Refresh
                                        </button>
                                        <p className="text-xs text-orange-600 break-all">
                                            <span className="font-mono">{TOKEN_ADDRESSES.token2.slice(0, 6)}...{TOKEN_ADDRESSES.token2.slice(-4)}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label htmlFor="liquidityAmount" className="block text-sm font-medium text-gray-700 mb-2">
                                    Liquidity Amount to deposit (in units of FlashiFi Shares)
                                </label>
                                <input
                                    id="liquidityAmount"
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={liquidityAmount}
                                    onChange={(e) => setLiquidityAmount(e.target.value)}
                                    placeholder="0.001"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isLoading}
                                />
                            </div>

                            {/* Token Approval Section - Dropdown */}
                            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg">
                                <button
                                    onClick={() => setIsApprovalsExpanded(!isApprovalsExpanded)}
                                    className="w-full p-4 text-left flex items-center justify-between hover:bg-blue-100 transition-colors"
                                >
                                    <div className="flex items-center space-x-2">
                                        <h3 className="text-sm font-medium text-blue-800">Token Approvals Required</h3>
                                        <span className="text-green-600 text-sm">✓</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-blue-600">
                                            {approvalStates.token1.hookApproved && approvalStates.token2.hookApproved
                                                ? 'All Approved'
                                                : 'Action Required'
                                            }
                                        </span>
                                        <svg
                                            className={`w-4 h-4 text-blue-600 transition-transform ${isApprovalsExpanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </button>

                                {isApprovalsExpanded && (
                                    <div className="px-4 pb-4 space-y-4">
                                        <p className="text-xs text-blue-600">
                                            Before adding liquidity, you need to approve both tokens for the hook to spend them.
                                        </p>

                                        {/* Token 1 Approval */}
                                        <div className="p-3 bg-white rounded border">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700">Token 1</p>
                                                    <p className="text-xs text-gray-500 font-mono">{TOKEN_ADDRESSES.token1}</p>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {approvalStates.token1.hookApproved ? (
                                                        <span className="text-green-600 text-sm font-medium">✓ Approved</span>
                                                    ) : (
                                                        <button
                                                            onClick={handleApproveToken1}
                                                            disabled={!isConnected || approvalStates.token1.isApproving || isLoading}
                                                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {approvalStates.token1.isApproving ? 'Approving...' : 'Approve'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">Hook Address:</span>
                                                    <span className={approvalStates.token1.hookApproved ? 'text-green-600' : 'text-red-500'}>
                                                        {approvalStates.token1.hookApproved ? '✓ Approved' : '✗ Not Approved'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Token 2 Approval */}
                                        <div className="p-3 bg-white rounded border">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700">Token 2</p>
                                                    <p className="text-xs text-gray-500 font-mono">{TOKEN_ADDRESSES.token2}</p>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {approvalStates.token2.hookApproved ? (
                                                        <span className="text-green-600 text-sm font-medium">✓ Approved</span>
                                                    ) : (
                                                        <button
                                                            onClick={handleApproveToken2}
                                                            disabled={!isConnected || approvalStates.token2.isApproving || isLoading}
                                                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {approvalStates.token2.isApproving ? 'Approving...' : 'Approve'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">Hook Address:</span>
                                                    <span className={approvalStates.token2.hookApproved ? 'text-green-600' : 'text-red-500'}>
                                                        {approvalStates.token2.hookApproved ? '✓ Approved' : '✗ Not Approved'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-xs text-blue-600">
                                            <p>Hook Address: <span className="font-mono">{APPROVAL_ADDRESSES.hook}</span></p>
                                            <p className="mt-1">Both tokens will be approved for maximum amount (type(uint256).max) to the hook address</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>



                        {needsApproval && (
                            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                <h3 className="text-sm font-medium text-orange-800 mb-3">Token Approval Required</h3>
                                <div className="mb-3">
                                    <label htmlFor="tokenAddress" className="block text-sm font-medium text-orange-700 mb-2">
                                        Token Address (ERC20)
                                    </label>
                                    <input
                                        id="tokenAddress"
                                        type="text"
                                        value={tokenAddress}
                                        onChange={(e) => setTokenAddress(e.target.value)}
                                        placeholder="0x..."
                                        className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        disabled={isLoading}
                                    />
                                </div>
                                <button
                                    onClick={handleApprove}
                                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                                    disabled={!tokenAddress || isLoading}
                                >
                                    Approve Token
                                </button>
                                <p className="text-xs text-orange-600 mt-2">
                                    The contract needs permission to spend your tokens. Enter the token address and click approve.
                                </p>
                            </div>
                        )}

                        <div className="mb-6">
                            <button
                                onClick={handleAddLiquidity}
                                className={`w-full px-8 py-4 text-lg font-semibold rounded-lg transition-colors ${isConnected && !isLoading && liquidityAmount &&
                                    approvalStates.token1.hookApproved && approvalStates.token2.hookApproved
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                    }`}
                                disabled={
                                    !isConnected ||
                                    isLoading ||
                                    !liquidityAmount ||
                                    (!approvalStates.token1.hookApproved || !approvalStates.token2.hookApproved)
                                }
                            >
                                {isLoading ? (
                                    isConfirming ? 'Confirming...' : 'Processing...'
                                ) : (
                                    !approvalStates.token1.hookApproved || !approvalStates.token2.hookApproved
                                        ? 'Approve All Tokens First'
                                        : 'Add Liquidity'
                                )}
                            </button>

                            {(!approvalStates.token1.hookApproved || !approvalStates.token2.hookApproved) && (
                                <p className="text-xs text-red-600 mt-2 text-center">
                                    Both tokens must be approved to the hook address before adding liquidity
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                                <p className="font-medium">Transaction Failed</p>
                                <p className="text-sm">{error.message}</p>
                            </div>
                        )}

                        {contractError && (
                            <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
                                <p className="font-medium">Contract Issue</p>
                                <p className="text-sm">Contract not found or not accessible on {chain?.name || 'current network'}</p>
                                <p className="text-xs mt-1">Please verify the contract address and network</p>
                            </div>
                        )}

                        {isSuccess && (
                            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                                <p className="font-medium">Success!</p>
                                <p className="text-sm">
                                    Liquidity added successfully!
                                </p>
                            </div>
                        )}

                        <div className="text-sm text-gray-600">
                            <p>Hook Contract: {contracts.reHypothecationHook.address}</p>
                            <p className="mt-2 text-xs text-gray-500">
                                Current Network: {chain?.name || 'Unknown'} (ID: {chain?.id || 'N/A'})
                            </p>
                            <p className="mt-1 text-xs text-blue-500">
                                Required Network: Base Sepolia (ID: 84532)
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Debug: Check browser console for detailed transaction logs
                            </p>
                            {chain?.id !== 84532 && (
                                <p className="mt-1 text-xs text-red-500">
                                    ⚠️ Please switch to Base Sepolia network to interact with this contract
                                </p>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Features