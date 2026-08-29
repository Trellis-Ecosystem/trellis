import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { CONTRACT_ID } from '../lib/config'
import { ACTIVE_NETWORK, explorerBaseUrl, networkLabel } from '../lib/explorer'
import { ExplorerLink } from './ExplorerLink'
import WalletConnect from './WalletConnect'
import { WalletErrorBoundary } from './WalletErrorBoundary'
import MoonIcon from './icons/MoonIcon'
import SunIcon from './icons/SunIcon'

function Navbar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="bg-navy-900 dark:bg-navy-900 light:bg-white border-b border-navy-700 dark:border-navy-700 light:border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <span className="text-cyan-400 text-xl font-bold tracking-tight">Trellis</span>
          <span className="hidden sm:inline text-gray-500 dark:text-gray-500 light:text-gray-600 text-sm">Trustless Milestone Escrow</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-4 ml-4">
          <Link 
            to="/" 
            className={`text-sm font-medium transition-colors ${
              location.pathname === '/' 
                ? 'text-cyan-400' 
                : 'text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-cyan-400'
            }`}
          >
            Home
          </Link>
          <Link 
            to="/create" 
            className={`text-sm font-medium transition-colors ${
              location.pathname === '/create' 
                ? 'text-cyan-400' 
                : 'text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-cyan-400'
            }`}
          >
            Create Agreement
          </Link>
          <Link 
            to="/status" 
            className={`text-sm font-medium transition-colors ${
              location.pathname.startsWith('/status') || location.pathname.startsWith('/agreement')
                ? 'text-cyan-400' 
                : 'text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-cyan-400'
            }`}
          >
            Check Status
          </Link>
          <Link 
            to="/history" 
            className={`text-sm font-medium transition-colors ${
              location.pathname === '/history'
                ? 'text-cyan-400'
                : 'text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-cyan-400'
            }`}
          >
            History
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <a
          href={explorerBaseUrl()}
          target="_blank"
          rel="noopener noreferrer"
          title={`Browse the Stellar ${networkLabel()} on Stellar Expert`}
          aria-label={`Network status: ${networkLabel(ACTIVE_NETWORK)} — view on Stellar Expert`}
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 px-3 py-1 text-xs font-medium text-cyan-400 transition-colors hover:border-cyan-400/60 hover:bg-cyan-400/10"
        >
          <span
            className="h-1.5 w-1.5 rounded-full bg-cyan-400"
            aria-hidden="true"
            title={`Connected to ${networkLabel(ACTIVE_NETWORK)}`}
          />
          <span className="sr-only sm:hidden">{networkLabel(ACTIVE_NETWORK)}</span>
          <span className="hidden sm:inline">{networkLabel(ACTIVE_NETWORK)}</span>
        </a>
        <ExplorerLink
          type="contract"
          value={CONTRACT_ID}
          className="hidden md:inline-flex text-xs"
        />
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          className="p-2 rounded-lg border border-navy-700 dark:border-navy-700 light:border-gray-300 text-gray-400 dark:text-gray-400 light:text-gray-600 hover:bg-navy-800 dark:hover:bg-navy-800 light:hover:bg-gray-100 transition-all"
        >
          {theme === 'light' ? (
            <MoonIcon className="w-5 h-5" />
          ) : (
            <SunIcon className="w-5 h-5" />
          )}
        </button>
        <WalletErrorBoundary>
          <WalletConnect />
        </WalletErrorBoundary>
      </div>
    </nav>
  );
}

export default Navbar;
