import Navbar from './components/Navbar'
import { NetworkBackground } from './components/NetworkBackground'
import { ThemeProvider } from './context/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
        {/* Animated particle network background */}
        <NetworkBackground />

        {/* All content sits above the canvas */}
        <div className="relative z-10">
          <Navbar />
          <main className="flex flex-col items-center justify-center px-6 pt-24 pb-32 text-center">
            <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-900 transition-colors duration-200 dark:text-white sm:text-5xl">
              Trustless Escrow for Remote Work
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600 transition-colors duration-200 dark:text-gray-400 sm:text-xl">
              Built on Stellar's Soroban smart contract platform
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button className="rounded-lg bg-cyan-400 px-8 py-3 text-base font-semibold text-navy-900 transition-colors hover:bg-cyan-300">
                Create Agreement
              </button>
              <button className="rounded-lg border border-cyan-400 px-8 py-3 text-base font-semibold text-cyan-400 transition-colors hover:bg-cyan-400/10">
                Check Status
              </button>
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default App
