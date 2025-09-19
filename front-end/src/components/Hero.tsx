import React from 'react'
import { Link } from 'react-router-dom'

const Hero: React.FC = () => {
    return (
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <div className="text-center">
                    <h1 className="text-4xl md:text-6xl font-bold mb-6">
                        Uniswap V4 Rehypothecation Hook
                    </h1>
                    <p className="text-xl md:text-2xl mb-8 text-blue-100">
                        Maximize capital efficiency through advanced rehypothecation strategies
                    </p>
                    <div className="flex justify-center">
                        <Link to="/features" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                            Get Started
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Hero
