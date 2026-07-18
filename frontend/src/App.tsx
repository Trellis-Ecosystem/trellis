import { useState } from 'react'
import Navbar from './components/Navbar'
import { NetworkBackground } from './components/NetworkBackground'
import { TypingText } from './components/TypingText'
import { HowItWorks } from './components/HowItWorks'
import { StatsBar } from './components/StatsBar'

function App() {
  const [headingComplete, setHeadingComplete] = useState(false)
  const [subheadingComplete, setSubheadingComplete] = useState(false)

  return (
    <div className="relative min-h-screen text-gray-200">
      <NetworkBackground />
      <div className="relative z-10">
        <Navbar />
        <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white max-w-2xl leading-tight min-h-[4rem]">
            <TypingText
              text="Trustless Escrow for Remote Work"
              speed={45}
              delay={400}
              onComplete={() => setHeadingComplete(true)}
            />
          </h1>

          <div
            className="mt-4 transition-all duration-700"
            style={{
              opacity: headingComplete ? 1 : 0,
              transform: headingComplete ? 'translateY(0)' : 'translateY(12px)',
            }}
          >
            <TypingText
              text="Built on Stellar's Soroban smart contract platform"
              speed={30}
              delay={headingComplete ? 200 : 99999}
              className="text-gray-400 text-lg sm:text-xl"
              showCursor={false}
              onComplete={() => setSubheadingComplete(true)}
            />
          </div>

          <div
            className="mt-10 flex flex-col sm:flex-row gap-4 transition-all duration-700"
            style={{
              opacity: subheadingComplete ? 1 : 0,
              transform: subheadingComplete ? 'translateY(0)' : 'translateY(16px)',
            }}
          >
            <button className="bg-cyan-400 text-navy-900 font-semibold px-8 py-3 rounded-lg text-base hover:bg-cyan-300 transition-colors">
              Create Agreement
            </button>
            <button className="border border-cyan-400 text-cyan-400 font-semibold px-8 py-3 rounded-lg text-base hover:bg-cyan-400/10 transition-colors">
              Check Status
            </button>
          </div>

        </main>
        <StatsBar />
        <HowItWorks />
      </div>
    </div>
  )
}

export default App
