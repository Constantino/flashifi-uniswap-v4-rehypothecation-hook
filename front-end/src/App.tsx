import React from 'react'
import { WagmiWrapper } from './providers/WagmiProvider'
import Header from './components/Header'
import Hero from './components/Hero'
import Features from './components/Features'
import Footer from './components/Footer'

function App() {
    return (
        <WagmiWrapper>
            <div className="min-h-screen bg-gray-50">
                <Header />
                <main>
                    <Hero />
                    <Features />
                </main>
                <Footer />
            </div>
        </WagmiWrapper>
    )
}

export default App
