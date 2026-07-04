import { useState, useEffect } from 'react'
import { RPC_URL } from '../lib/config'

type NetworkStatus = 'online' | 'degraded' | 'offline' | 'checking'

interface StellarStatus {
  status: NetworkStatus
  latency: number | null
  lastChecked: Date | null
}

export function useStellarStatus(intervalMs = 60000): StellarStatus {
  const [status, setStatus] = useState<StellarStatus>({
    status: 'checking',
    latency: null,
    lastChecked: null,
  })

  async function checkStatus() {
    const start = Date.now()
    try {
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
          params: [],
        }),
        signal: AbortSignal.timeout(5000),
      })

      const latency = Date.now() - start
      const data = await response.json()

      if (data?.result?.status === 'healthy') {
        setStatus({
          status: latency > 2000 ? 'degraded' : 'online',
          latency,
          lastChecked: new Date(),
        })
      } else {
        setStatus({
          status: 'degraded',
          latency,
          lastChecked: new Date(),
        })
      }
    } catch {
      setStatus({
        status: 'offline',
        latency: null,
        lastChecked: new Date(),
      })
    }
  }

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])

  return status
}
