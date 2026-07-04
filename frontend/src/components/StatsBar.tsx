import { useContractStats } from '../hooks/useContractStats'
import { useCountUp } from '../hooks/useCountUp'
import { useScrollReveal } from '../hooks/useScrollReveal'

interface StatItemProps {
  value: number
  label: string
  prefix?: string
  suffix?: string
  enabled: boolean
}

function StatItem({ value, label, prefix = '', suffix = '', enabled }: StatItemProps) {
  const count = useCountUp({ end: value, duration: 2000, enabled })

  return (
    <div className="flex flex-col items-center gap-1 px-8">
      <div className="text-3xl sm:text-4xl font-bold text-white font-mono tracking-tight">
        {prefix}
        <span className="text-cyan-400">{count.toLocaleString()}</span>
        {suffix}
      </div>
      <div className="text-xs sm:text-sm text-gray-500 uppercase tracking-widest font-medium">
        {label}
      </div>
    </div>
  )
}

export function StatsBar() {
  const stats = useContractStats()
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3 })

  return (
    <div ref={ref} className="relative z-10 py-16 px-6">
      {/* Glowing divider line */}
      <div className="max-w-4xl mx-auto">
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mb-16" />

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-800">

          <StatItem
            value={stats.agreementsCreated}
            label="Agreements Created"
            enabled={isVisible && !stats.isLoading}
          />

          <StatItem
            value={stats.milestoneFunded}
            label="Milestones Funded"
            enabled={isVisible && !stats.isLoading}
          />

          <StatItem
            value={stats.usdcSecured}
            label="USDC Secured"
            suffix=" USDC"
            enabled={isVisible && !stats.isLoading}
          />
        </div>

        {/* Last updated + loading state */}
        <div className="text-center mt-8">
          {stats.isLoading ? (
            <span className="text-xs text-gray-600 font-mono animate-pulse">
              Fetching live data from Stellar testnet...
            </span>
          ) : stats.error ? (
            <span className="text-xs text-gray-700 font-mono">
              Live data temporarily unavailable
            </span>
          ) : stats.lastUpdated ? (
            <span className="text-xs text-gray-700 font-mono">
              Live · Stellar Testnet · Updated {stats.lastUpdated.toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mt-16" />
      </div>
    </div>
  )
}
