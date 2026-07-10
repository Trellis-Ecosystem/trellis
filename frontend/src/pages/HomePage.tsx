import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { NetworkBackground } from '../components/NetworkBackground'

export function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden text-gray-200">
      <NetworkBackground />

      <div className="relative z-10 min-h-screen bg-navy-900/20">
        <Navbar />
        <main className="flex flex-col items-center justify-center px-6 pt-24 pb-32 text-center">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Trustless Escrow for Remote Work
          </h1>
          <p className="mt-4 max-w-xl text-lg text-gray-400 sm:text-xl">
            Built on Stellar&apos;s Soroban smart contract platform
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/create"
              className="rounded-lg bg-cyan-400 px-8 py-3 text-base font-semibold text-navy-900 transition-colors hover:bg-cyan-300"
            >
              Create Agreement
            </Link>
            <Link
              to="/status"
              className="rounded-lg border border-cyan-400 px-8 py-3 text-base font-semibold text-cyan-400 transition-colors hover:bg-cyan-400/10"
            >
              Check Status
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}
