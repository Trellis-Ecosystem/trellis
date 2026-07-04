import { NetworkStatus } from './NetworkStatus'

function Navbar() {
  return (
    <nav className="bg-[#0A0E17] border-b border-navy-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-cyan-400 text-xl font-bold tracking-tight">Trellis</span>
        <span className="hidden sm:inline text-gray-500 text-sm">Trustless Milestone Escrow</span>
        <NetworkStatus />
      </div>
      <button className="bg-cyan-400 text-navy-900 font-semibold px-5 py-2 rounded-lg text-sm hover:bg-cyan-300 transition-colors">
        Connect Wallet
      </button>
    </nav>
  )
}

export default Navbar
