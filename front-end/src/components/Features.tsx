import React from 'react'

const Features: React.FC = () => {
    const features = [
        {
            title: 'Advanced Rehypothecation',
            description: 'Deposit assets into ERC4626 yield vaults while maintaining full liquidity availability for Uniswap V4 trading through automated JIT provision',
            icon: '💰'
        },
        {
            title: 'Just-in-Time Liquidity',
            description: 'Automatically provides full-range liquidity during swaps using vault assets, then immediately removes it to return assets to yield-generating vaults',
            icon: '⚡'
        },
        {
            title: 'ERC20 Share System',
            description: 'Receive transferable FFRH tokens representing your rehypothecated position with proportional vault asset ownership',
            icon: '🔄'
        },
        {
            title: 'Uniswap V4 Hook Integration',
            description: 'Native Uniswap V4 hook implementation with beforeSwap/afterSwap callbacks for seamless JIT liquidity management',
            icon: '🦄'
        },
        {
            title: 'Multi-User Support',
            description: 'Support for multiple liquidity providers with proportional share-based asset management and individual withdrawal capabilities',
            icon: '👥'
        },
        {
            title: 'Public Configuration',
            description: 'Anyone can configure vault addresses for different yield strategies, enabling flexible and decentralized vault management',
            icon: '⚙️'
        }
    ]

    return (
        <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        Powerful Features
                    </h2>
                    <p className="text-xl text-gray-600">
                        Maximize capital efficiency through rehypothecation and just-in-time liquidity provision
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <div key={index} className="text-center p-6 rounded-lg hover:shadow-lg transition-shadow">
                            <div className="text-4xl mb-4">{feature.icon}</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                            <p className="text-gray-600">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default Features
