import { useWriteContract, useWaitForTransactionReceipt, useSimulateContract, useAccount, useReadContract, usePublicClient } from 'wagmi'
import { contracts } from '../config/contracts'
import { parseEther, formatEther } from 'viem'

export function useReHypothecation() {
    const { address, chain } = useAccount()
    const publicClient = usePublicClient()
    const { writeContract, data: hash, isPending, error } = useWriteContract()
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    })

    // Check if contract exists by trying to read from it
    const { data: contractCode, error: contractError } = useReadContract({
        address: contracts.reHypothecationHook.address,
        abi: contracts.reHypothecationHook.abi,
        functionName: 'addReHypothecatedLiquidity',
        args: [parseEther('0.001')],
        query: {
            enabled: false, // We'll enable it manually
        }
    })

    // Simulate the contract call first
    const { data: simulationData, error: simulationError } = useSimulateContract({
        address: contracts.reHypothecationHook.address,
        abi: contracts.reHypothecationHook.abi,
        functionName: 'addReHypothecatedLiquidity',
        args: [parseEther('0.001')], // Use a small amount for simulation
        query: {
            enabled: false, // We'll enable it manually
        }
    })

    const setVaults = async () => {
        try {
            // Generate two random addresses for testing
            const randomAddress1 = `0x${Math.random().toString(16).substr(2, 40).padStart(40, '0')}`
            const randomAddress2 = `0x${Math.random().toString(16).substr(2, 40).padStart(40, '0')}`

            console.log('=== SET VAULTS DEBUG INFO ===')
            console.log('Wallet Address:', address)
            console.log('Current Chain:', chain?.name, chain?.id)
            console.log('Contract Address:', contracts.reHypothecationHook.address)
            console.log('Vault 0 Address:', randomAddress1)
            console.log('Vault 1 Address:', randomAddress2)
            console.log('==========================')

            // Check if we're on the right network
            if (!chain) {
                throw new Error('Please connect to a network')
            }

            // Check if we're on Base Sepolia
            if (chain.id !== 84532) {
                throw new Error(`Please switch to Base Sepolia network (Chain ID: 84532). Current network: ${chain.name} (ID: ${chain.id})`)
            }

            // Check if contract exists by getting bytecode
            try {
                const bytecode = await publicClient?.getBytecode({
                    address: contracts.reHypothecationHook.address
                })
                console.log('Contract bytecode length:', bytecode?.length || 0)

                if (!bytecode || bytecode === '0x') {
                    throw new Error(`No contract found at address ${contracts.reHypothecationHook.address} on ${chain.name}`)
                }
            } catch (bytecodeError) {
                console.error('Bytecode check failed:', bytecodeError)
                throw new Error(`Contract not found at address ${contracts.reHypothecationHook.address} on ${chain.name}. Please verify the contract address and network.`)
            }

            // Try to simulate the setVaults function
            try {
                console.log('Simulating setVaults function...')
                const simulation = await publicClient?.simulateContract({
                    address: contracts.reHypothecationHook.address,
                    abi: contracts.reHypothecationHook.abi,
                    functionName: 'setVaults',
                    args: [randomAddress1, randomAddress2],
                    account: address,
                })
                console.log('setVaults simulation successful:', simulation)
            } catch (simError) {
                console.error('setVaults simulation failed:', simError)
                throw new Error(`setVaults simulation failed: ${simError.message}`)
            }

            console.log('Calling setVaults with addresses:', randomAddress1, randomAddress2)

            // Call the setVaults function
            writeContract({
                address: contracts.reHypothecationHook.address,
                abi: contracts.reHypothecationHook.abi,
                functionName: 'setVaults',
                args: [randomAddress1, randomAddress2],
                gas: 300000n,
            })
        } catch (err) {
            console.error('Error in setVaults:', err)
            throw err
        }
    }

    const addReHypothecatedLiquidityWithValue = async (liquidity: string) => {
        try {
            const liquidityAmount = parseEther(liquidity)

            console.log('Attempting to add rehypothecated liquidity:', {
                liquidity: liquidity,
                liquidityAmount: liquidityAmount.toString(),
                liquidityAmountFormatted: formatEther(liquidityAmount),
                contractAddress: contracts.reHypothecationHook.address
            })

            writeContract({
                address: contracts.reHypothecationHook.address,
                abi: contracts.reHypothecationHook.abi,
                functionName: 'addReHypothecatedLiquidity',
                args: [liquidityAmount],
                // No value parameter - liquidity is only a contract parameter, not payable
            })
        } catch (err) {
            console.error('Error in addReHypothecatedLiquidityWithValue:', err)
            throw err
        }
    }

    return {
        setVaults,
        addReHypothecatedLiquidityWithValue,
        hash,
        isPending,
        isConfirming,
        isSuccess,
        error,
        simulationError,
        contractError,
        chain,
    }
}
