import { useCallback, useEffect, useState } from 'react'
import { xdr } from '@stellar/stellar-sdk'
import { CONTRACT_ID, RPC_URL } from '../lib/config'
import { hexToBytes } from '../lib/format'

export interface AgreementEvent {
  type: string
  ledger: number
  txHash: string
  timestamp: string
  agreementId: string
  milestoneId?: number
  amount?: string
  caller?: string
}

const POLL_INTERVAL_MS = 10000 // Poll every 10 seconds

/**
 * Fetch and parse contract events for a specific agreement.
 * Polls for new events periodically to show live timeline.
 */
export function useAgreementEvents(agreementId: string | null) {
  const [events, setEvents] = useState<AgreementEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async (signal: AbortSignal) => {
    if (!agreementId) return

    try {
      setIsLoading(true)
      setError(null)

      // Encode agreement_id topic filter
      const idBytes = hexToBytes(agreementId)
      // xdr.ScVal.scvBytes expects a Buffer; casting the Uint8Array is safe
      // because they share the same underlying ArrayBuffer layout and the
      // Stellar SDK only uses the byte data at runtime.
      const idScVal = xdr.ScVal.scvBytes(idBytes as unknown as Buffer)
      const idTopic = idScVal.toXDR('base64')

      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getEvents',
        params: {
          startLedger: 1,
          filters: [
            {
              type: 'contract',
              contractIds: [CONTRACT_ID],
              topics: [[idTopic]],
            },
          ],
          pagination: { limit: 100 },
        },
      }

      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })

      if (!response.ok) {
        throw new Error(`RPC HTTP ${response.status}`)
      }

      const json = await response.json()

      if (json.error) {
        throw new Error(json.error.message)
      }

      const rawEvents = json.result?.events || []

      const parsed: AgreementEvent[] = rawEvents.map((e: any) => {
        const eventType = parseEventType(e)
        const eventData = parseEventData(e)

        return {
          type: eventType,
          ledger: e.ledger || 0,
          txHash: e.txHash || '',
          timestamp: e.ledgerClosedAt || new Date().toISOString(),
          agreementId,
          ...eventData,
        }
      })

      // Sort by ledger descending (newest first)
      parsed.sort((a, b) => b.ledger - a.ledger)

      setEvents(parsed)
      setIsLoading(false)
    } catch (err) {
      if (signal.aborted) return

      console.error('[useAgreementEvents] Failed to fetch:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
      setIsLoading(false)
    }
  }, [agreementId])

  useEffect(() => {
    const controller = new AbortController()

    // Initial fetch
    void fetchEvents(controller.signal)

    // Poll for updates
    const interval = setInterval(() => {
      void fetchEvents(controller.signal)
    }, POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [fetchEvents])

  return { events, isLoading, error, refetch: () => fetchEvents(new AbortController().signal) }
}

function parseEventType(event: any): string {
  try {
    const topics = event.topic || []
    if (topics.length > 0) {
      const firstTopic = xdr.ScVal.fromXDR(topics[0], 'base64')
      if (firstTopic.switch().name === 'scvSymbol') {
        return firstTopic.sym().toString()
      }
    }
  } catch {
    // Fallback
  }
  return 'unknown'
}

function parseEventData(event: any): Partial<AgreementEvent> {
  try {
    const value = event.value?.xdr
    if (!value) return {}

    const scVal = xdr.ScVal.fromXDR(value, 'base64')
    
    // Parse common fields from event data structure
    // This is simplified - actual parsing depends on contract event schema
    return {}
  } catch {
    return {}
  }
}
