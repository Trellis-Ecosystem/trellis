import { useStellarStatus } from '../hooks/useStellarStatus'

export function NetworkStatus() {
  const { status, latency } = useStellarStatus()

  const config = {
    checking: {
      dot: 'bg-gray-500',
      pulse: '',
      label: 'Checking...',
      text: 'text-gray-500',
    },
    online: {
      dot: 'bg-emerald-400',
      pulse: 'animate-ping',
      label: 'Testnet Live',
      text: 'text-emerald-400',
    },
    degraded: {
      dot: 'bg-yellow-400',
      pulse: 'animate-ping',
      label: 'Degraded',
      text: 'text-yellow-400',
    },
    offline: {
      dot: 'bg-red-400',
      pulse: '',
      label: 'Offline',
      text: 'text-red-400',
    },
  }

  const { dot, pulse, label, text } = config[status]

  return (
    <div
      className="flex items-center gap-2 group cursor-default"
      title={latency ? `Latency: ${latency}ms` : 'Stellar Testnet RPC'}
    >
      {/* Animated dot */}
      <div className="relative flex items-center justify-center w-3 h-3">
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${dot} opacity-50 ${pulse}`}
        />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dot}`} />
      </div>

      {/* Label — hidden on small screens, visible on sm+ */}
      <span className={`hidden sm:block text-xs font-mono ${text} transition-colors`}>
        {label}
        {latency && status === 'online' && (
          <span className="ml-1 text-gray-600">
            {latency}ms
          </span>
        )}
      </span>
    </div>
  )
}
