import Navbar from './components/Navbar'
import { NetworkBackground } from './components/NetworkBackground'

function App() {
  return (
    <div className="relative min-h-screen text-gray-200">
      {/* Animated particle network background */}
      <NetworkBackground />

      {/* All content sits above the canvas */}
      <div className="relative z-10">
        <Navbar />
        <main className="flex flex-col items-center justify-center px-6 pt-24 pb-32 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white max-w-2xl leading-tight">
            Trustless Escrow for Remote Work
          </h1>
          <p className="mt-4 text-gray-400 text-lg sm:text-xl max-w-xl">
            Built on Stellar's Soroban smart contract platform
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button className="bg-cyan-400 text-navy-900 font-semibold px-8 py-3 rounded-lg text-base hover:bg-cyan-300 transition-colors">
              Create Agreement
            </button>
            <button className="border border-cyan-400 text-cyan-400 font-semibold px-8 py-3 rounded-lg text-base hover:bg-cyan-400/10 transition-colors">
              Check Status
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
