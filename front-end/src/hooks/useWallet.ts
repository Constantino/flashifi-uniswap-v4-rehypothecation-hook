import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function useWallet() {
    const { address, isConnected, chain } = useAccount()
    const { connect, connectors, isPending } = useConnect()
    const { disconnect } = useDisconnect()

    const connectWallet = () => {
        if (connectors.length > 0) {
            connect({ connector: connectors[0] })
        }
    }

    const formatAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    return {
        address,
        isConnected,
        chain,
        connectWallet,
        disconnect,
        formatAddress,
        isPending,
        connectors
    }
}
