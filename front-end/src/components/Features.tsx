import React from 'react'

const Features: React.FC = () => {
    const features = [
        {
            title: 'Capital Efficiency',
            description: 'Maximize your liquidity by rehypothecating assets across multiple protocols',
            icon: '💰'
        },
        {
            title: 'Risk Management',
            description: 'Advanced risk assessment and automated position management',
            icon: '🛡️'
        },
        {
            title: 'Yield Optimization',
            description: 'Automatically find and execute the best yield opportunities',
            icon: '📈'
        },
        {
            title: 'Gas Optimization',
            description: 'Minimize transaction costs with efficient batching and routing',
            icon: '⚡'
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
                        Built for the future of DeFi with Uniswap V4
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
