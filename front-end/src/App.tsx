import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { WagmiWrapper } from './providers/WagmiProvider'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Features from './pages/Features'

function App() {
    return (
        <WagmiWrapper>
            <Router>
                <div className="min-h-screen bg-gray-50">
                    <Header />
                    <main>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/features" element={<Features />} />
                        </Routes>
                    </main>
                    <Footer />
                </div>
            </Router>
        </WagmiWrapper>
    )
}

export default App
