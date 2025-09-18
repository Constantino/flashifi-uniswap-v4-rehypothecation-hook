import { createConfig, http } from 'wagmi'
import { mainnet, sepolia, arbitrum, polygon, baseSepolia } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet, metaMask } from 'wagmi/connectors'

// Get projectId from https://cloud.walletconnect.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID'

export const config = createConfig({
    chains: [mainnet, sepolia, arbitrum, polygon, baseSepolia],
    connectors: [
        metaMask(),
        injected(),
        walletConnect({ projectId }),
        coinbaseWallet({ appName: 'Flashifi' }),
    ],
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
        [arbitrum.id]: http(),
        [polygon.id]: http(),
        [baseSepolia.id]: http('https://sepolia.base.org'),
    },
})

declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}
