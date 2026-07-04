import { useState, useEffect } from 'react'
import { RPC_URL } from '../lib/config'

interface ContractStats {
  agreementsCreated: number
  milestoneFunded: number
  usdcSecured: number
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID as string

async function fetchEvents(topic: string): Promise<number> {
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getEvents',
        params: [
          {
            startLedger: 1,
            filters: [
              {
                type: 'contract',
                contractIds: [CONTRACT_ID],
                topics: [[topic]],
              },
            ],
            pagination: { limit: 200 },
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    })

    const data = await response.json()
    return data?.result?.events?.length ?? 0
  } catch {
    return 0
  }
}

export function useContractStats(refreshInterval = 30000): ContractStats {
  const [stats, setStats] = useState<ContractStats>({
    agreementsCreated: 0,
    milestoneFunded: 0,
    usdcSecured: 0,
    isLoading: true,
    error: null,
    lastUpdated: null,
  })

  async function fetchStats() {
    try {
      const [created, funded] = await Promise.all([
        fetchEvents('AAAADwAAAAdjcmVhdGVk'),
        fetchEvents('AAAADwAAAAZsb2NrZWQ='),
      ])

      const estimatedUsdc = funded * 1000

      setStats({
        agreementsCreated: created,
        milestoneFunded: funded,
        usdcSecured: estimatedUsdc,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (err) {
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: 'Could not fetch stats',
      }))
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  return stats
}
