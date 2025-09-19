import React from 'react'

const Footer: React.FC = () => {
    return (
        <footer className="bg-gray-900 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center">
                    <h3 className="text-2xl font-bold mb-4">FlashiFi</h3>
                    <p className="text-gray-400 mb-4">
                        Advanced rehypothecation strategies for Uniswap V4 liquidity providers.
                    </p>
                    <div className="flex justify-center space-x-4">
                        <a href="https://x.com/flashifi_xyz" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">X</a>
                        <a href="https://www.linkedin.com/company/flashifi/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">LinkedIn</a>
                        <a href="https://github.com/Constantino/flashifi-uniswap-v4-rehypothecation-hook" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">GitHub</a>
                    </div>
                </div>
                <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
                    <p>&copy; 2025 FlashiFi. All rights reserved.</p>
                </div>
            </div>
        </footer>
    )
}

export default Footer
