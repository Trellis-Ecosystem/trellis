import { useCallback, useEffect, useRef, useState } from 'react'
import { xdr } from '@stellar/stellar-sdk'
import { CONTRACT_ID, RPC_URL, getIndexerUrl } from '../lib/config'
import { fetchIndexedEvents, openIndexerStream } from '../lib/indexer'
import { getRecentStartLedger, isRetentionWindowError, RETENTION_WINDOW_MESSAGE } from '../lib/eventWindow'
import type { RawEventResponse } from '../lib/soroban'
import { isValidEventResponse } from '../lib/soroban'

export interface AgreementEvent {
  /** RPC event id — present for events from RPC or the indexer, used to de-duplicate. */
  id?: string
  type: string
  ledger: number
  txHash: string
  timestamp: string
  agreementId: string
  milestoneId?: number
  amount?: string
  caller?: string
  payer?: string
  payee?: string
  proofUri?: string
  refundedToPayer?: boolean
  cancelledBy?: string
}

const BASE_POLL_INTERVAL_MS = 10_000 // Base poll interval: 10 seconds
const MAX_POLL_INTERVAL_MS = 60_000  // Cap backoff at 60 seconds
const FETCH_TIMEOUT_MS = 30_000     // Per-request timeout: 30 seconds

const EVENT_TYPE_MAP: Record<string, string> = {
  trlls_crte: 'agreement_created',
  trlls_lckd: 'funds_locked',
  trlls_sbmt: 'work_submitted',
  trlls_rlsd: 'funds_released',
  trlls_dspt: 'dispute_raised',
  trlls_rslv: 'milestone_resolved',
  trlls_cncl: 'milestone_cancelled',
  trlls_ttle: 'ttl_extended',
}

/**
 * Fetch and parse contract events for a specific agreement.
 *
 * When VITE_INDEXER_URL is set, history and live updates come from the
 * indexer/relay over a single SSE stream (snapshot, then deltas) — no RPC
 * polling from the browser, and history survives the RPC node's retention
 * window. If the relay is unset or unreachable, falls back to the direct RPC
 * polling below.
 *
 * Direct polling uses a recursive setTimeout chain so the next poll only starts after the
 * current fetch completes, preventing concurrent request stacking.  Applies
 * linear backoff (capped at MAX_POLL_INTERVAL_MS) when a fetch fails so a
 * flaky network doesn't hammer the RPC endpoint.
 */
export function useAgreementEvents(agreementId: string | null) {
  const [events, setEvents] = useState<AgreementEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tracks consecutive failure count for backoff calculation.
  const failureCount = useRef(0)
  // Holds the scheduled timer handle so we can cancel it on unmount.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refetchRef = useRef<(() => void) | null>(null)

  const fetchEvents = useCallback(
    async (signal: AbortSignal) => {
      if (!agreementId || signal.aborted) return

      setIsLoading(true)
      setError(null)

      const timeoutController = new AbortController()
      const timeoutHandle = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS)
      const mergedSignal = AbortSignal.any([signal, timeoutController.signal])

      try {
        // Encode agreement_id topic filter
        const idBytes = Buffer.from(agreementId, 'hex')
        const idScVal = xdr.ScVal.scvBytes(idBytes)
        const idTopic = idScVal.toXDR('base64')

        const startLedger = await getRecentStartLedger(mergedSignal)

        const body = {
          jsonrpc: '2.0',
          id: 1,
          method: 'getEvents',
          params: {
            startLedger,
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
          signal: mergedSignal,
        })

        if (!response.ok) {
          throw new Error(`RPC HTTP ${response.status}`)
        }

        const json = await response.json()

        if (json.error) {
          throw new Error(json.error.message)
        }

        const rawEvents: unknown[] = json.result?.events || []
        const parsed = toAgreementEvents(rawEvents, agreementId)

        if (signal.aborted) return

        setEvents(parsed)
        setIsLoading(false)
        failureCount.current = 0
      } catch (err) {
        // Abort errors (unmount or timeout) are not user-facing failures.
        if (signal.aborted) return
        if (err instanceof Error && err.name === 'AbortError') {
          setIsLoading(false)
          return
        }

        console.error('[useAgreementEvents] Failed to fetch:', err)

        const message = err instanceof Error ? err.message : 'Failed to fetch events'
        setError(isRetentionWindowError(message) ? RETENTION_WINDOW_MESSAGE : message)
        setIsLoading(false)
        failureCount.current += 1
      } finally {
        clearTimeout(timeoutHandle)
      }
    },
    [agreementId],
  )

  useEffect(() => {
    failureCount.current = 0

    const controller = new AbortController()
    let closeStream: (() => void) | null = null

    let relayActive = false
    let polling = false

    const poll = async () => {
      if (controller.signal.aborted || polling) return
      polling = true
      await fetchEvents(controller.signal)
      polling = false
      if (controller.signal.aborted) return

      const nextDelay = Math.min(
        BASE_POLL_INTERVAL_MS * (1 + failureCount.current),
        MAX_POLL_INTERVAL_MS,
      )
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void poll()
      }, nextDelay)
    }

    const restartPolling = () => {
      relayActive = false
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      failureCount.current = 0
      void poll()
    }

    refetchRef.current = () => {
      if (controller.signal.aborted || !agreementId) return
      if (!relayActive) {
        restartPolling()
        return
      }

      setError(null)
      void fetchIndexedEvents(agreementId, controller.signal)
        .then((raw) => {
          if (!controller.signal.aborted) setEvents(toAgreementEvents(raw, agreementId))
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : 'Failed to fetch events')
          }
        })
    }

    if (agreementId && getIndexerUrl()) {
      relayActive = true
      setIsLoading(true)
      setError(null)
      closeStream = openIndexerStream(
        `/stream/events?agreementId=${encodeURIComponent(agreementId)}`,
        {
          snapshot: (data) => {
            if (controller.signal.aborted) return
            setEvents(toAgreementEvents(eventsOf(data), agreementId))
            setIsLoading(false)
          },
          events: (data) => {
            if (controller.signal.aborted) return
            const fresh = toAgreementEvents(eventsOf(data), agreementId)
            setEvents((prev) => mergeEvents(prev, fresh))
          },
        },
        restartPolling,
      )
    } else if (agreementId) {
      restartPolling()
    }

    return () => {
      refetchRef.current = null
      controller.abort()
      closeStream?.()
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [fetchEvents, agreementId])

  const refetch = useCallback(() => refetchRef.current?.(), [])

  return { events, isLoading, error, refetch }
}

/** Parses raw RPC-shaped events (from RPC or the indexer), newest first. */
function toAgreementEvents(rawEvents: unknown[], agreementId: string): AgreementEvent[] {
  const parsed: AgreementEvent[] = rawEvents
    .filter(isValidEventResponse)
    .map((e: RawEventResponse) => {
      const eventType = parseEventType(e)
      const id = (e as { id?: unknown }).id

      return {
        ...(typeof id === 'string' ? { id } : {}),
        type: eventType,
        ledger: e.ledger || 0,
        txHash: e.txHash || '',
        timestamp: e.ledgerClosedAt || new Date().toISOString(),
        agreementId,
      }
    })

  // Sort by ledger descending (newest first)
  parsed.sort((a, b) => b.ledger - a.ledger)
  return parsed
}

function eventsOf(data: unknown): unknown[] {
  const events = (data as { events?: unknown } | null)?.events
  return Array.isArray(events) ? events : []
}

/** Adds relay deltas to the list, skipping any event already present. */
function mergeEvents(prev: AgreementEvent[], fresh: AgreementEvent[]): AgreementEvent[] {
  const seen = new Set(prev.map((e) => e.id).filter(Boolean))
  const added = fresh.filter((e) => !e.id || !seen.has(e.id))
  if (added.length === 0) return prev
  return [...added, ...prev].sort((a, b) => b.ledger - a.ledger)
}

function parseEventType(event: RawEventResponse): string {
  try {
    const topics = event.topic || []
    if (topics.length > 0 && typeof topics[0] === 'string') {
      const firstTopic = xdr.ScVal.fromXDR(topics[0], 'base64')
      if (firstTopic.switch().name === 'scvSymbol') {
        const symbol = firstTopic.sym().toString()
        return EVENT_TYPE_MAP[symbol] ?? symbol
      }
    }
  } catch {
    // Fallback to unknown
  }
  return 'unknown'
}
