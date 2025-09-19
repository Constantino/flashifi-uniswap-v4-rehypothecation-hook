import React from 'react'

const Features: React.FC = () => {
    const features = [
        {
            title: 'Idle Capital Utilization',
            description: 'Put your idle liquidity to work by automatically depositing assets into ERC4626 yield-generating vaults',
            icon: '💰'
        },
        {
            title: 'Just-in-Time Liquidity',
            description: 'Provide liquidity exactly when needed for swaps, then return assets to vaults for continued yield generation',
            icon: '⚡'
        },
        {
            title: 'Rehypothecation Strategy',
            description: 'Rehypothecate your assets to earn yield while maintaining availability for Uniswap V4 trading',
            icon: '🔄'
        },
        {
            title: 'Uniswap V4 Integration',
            description: 'Seamlessly integrates with Uniswap V4 hooks to provide JIT liquidity during swaps',
            icon: '🦄'
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
