import { useTheme } from '../context/useTheme'

function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur transition-colors duration-200 dark:border-navy-700 dark:bg-[#0A0E17]/90 dark:shadow-none">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-tight text-cyan-400">Trellis</span>
        <span className="hidden text-sm text-slate-500 transition-colors duration-200 dark:text-gray-500 sm:inline">
          Trustless Milestone Escrow
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          title={`Current theme: ${theme}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-900 transition-colors duration-200 hover:bg-slate-100 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-200 dark:hover:bg-navy-700"
        >
          <span aria-hidden="true">{isDark ? '🌙' : '☀️'}</span>
        </button>
        <button className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-navy-900 transition-colors hover:bg-cyan-300">
          Connect Wallet
        </button>
      </div>
    </nav>
  )
}

export default Navbar
