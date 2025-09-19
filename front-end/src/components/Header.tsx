import React from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'

const Header: React.FC = () => {
    const { address, isConnected, connectWallet, disconnect, formatAddress, isPending } = useWallet()

    return (
        <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-6">
                    <div className="flex items-center">
                        <img
                            src="/flashifi_logo.png"
                            alt="Flashifi Logo"
                            className="h-8 w-8 mr-3"
                        />
                        <h1 className="text-2xl font-bold text-gray-900">FlashiFi</h1>
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            V4 Hook
                        </span>
                    </div>
                    <nav className="hidden md:flex space-x-8">
                        <Link to="/" className="text-gray-500 hover:text-gray-900">Home</Link>
                        <Link to="/features" className="text-gray-500 hover:text-gray-900">App</Link>
                        <a href="https://github.com/Constantino/flashifi-uniswap-v4-rehypothecation-hook" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-900">GitHub</a>
                    </nav>
                    <div className="flex items-center space-x-4">
                        {isConnected ? (
                            <div className="flex items-center space-x-3">
                                <div className="text-sm text-gray-600">
                                    {address && formatAddress(address)}
                                </div>
                                <button
                                    onClick={() => disconnect()}
                                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={connectWallet}
                                disabled={isPending}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? 'Connecting...' : 'Connect Wallet'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Header
