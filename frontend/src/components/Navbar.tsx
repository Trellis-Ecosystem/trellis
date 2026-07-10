import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="flex items-center justify-between border-b border-navy-700 bg-[#0A0E17] px-6 py-4">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3" aria-label="Go to Trellis home">
          <span className="text-xl font-bold tracking-tight text-cyan-400">Trellis</span>
          <span className="hidden text-sm text-gray-500 sm:inline">Trustless Milestone Escrow</span>
        </Link>
        <div className="hidden items-center gap-4 text-sm text-gray-400 md:flex">
          <Link to="/create" className="transition-colors hover:text-cyan-400">
            Create
          </Link>
          <Link to="/status" className="transition-colors hover:text-cyan-400">
            Status
          </Link>
        </div>
      </div>
      <button className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-cyan-300">
        Connect Wallet
      </button>
    </nav>
  )
}

export default Navbar
