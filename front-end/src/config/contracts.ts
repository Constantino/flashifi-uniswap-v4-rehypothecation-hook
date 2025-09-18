import ReHypothecationHookAbi from '../utils/contracts/ReHypothecationHook.abi.json'

// Contract addresses for different networks
export const REHYPOTHECATION_HOOK_ADDRESSES = {
    // Mainnet
    1: '0x203B76693AE741460C55018bd84f6859188d60C0',
    // Sepolia testnet
    11155111: '0x203B76693AE741460C55018bd84f6859188d60C0',
    // Arbitrum
    42161: '0x203B76693AE741460C55018bd84f6859188d60C0',
    // Polygon
    137: '0x203B76693AE741460C55018bd84f6859188d60C0',
    // Base Sepolia testnet (where contract is actually deployed)
    84532: '0x801121a59b55c913bddbba5ff2dbe16cf943e0c0',
} as const

export const REHYPOTHECATION_HOOK_ADDRESS = '0x801121a59b55c913bddbba5ff2dbe16cf943e0c0' as const

export const contracts = {
    reHypothecationHook: {
        address: REHYPOTHECATION_HOOK_ADDRESS,
        abi: ReHypothecationHookAbi.abi,
    },
} as const