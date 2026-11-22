import { useCallback, useEffect, useRef, useState } from 'react'
import { xdr } from '@stellar/stellar-sdk'
import { CONTRACT_ID, RPC_URL, getIndexerUrl } from '../lib/config'
import { hexToBytes } from '../lib/format'
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
  // Signals that the component has unmounted — used to suppress state updates.
  const unmountedRef = useRef(false)
  // True while events are being delivered by the indexer relay rather than
  // by direct RPC polling; decides which source `refetch` hits.
  const relayActiveRef = useRef(false)

  const fetchEvents = useCallback(
    async (signal: AbortSignal): Promise<boolean> => {
      if (!agreementId) return true // treat no-id as "success" (no-op)

      // Guard state updates for unmounted components
      if (!unmountedRef.current) {
        setIsLoading(true)
        setError(null)
      }

      // Combine the caller's signal with a per-request timeout signal.
      const timeoutId = setTimeout(() => {
        /* The fetch API will reject once the timeout AbortController fires. */
      }, FETCH_TIMEOUT_MS)
      const timeoutController = new AbortController()
      const timeoutHandle = setTimeout(
        () => timeoutController.abort(),
        FETCH_TIMEOUT_MS,
      )

      // Merge two abort signals: unmount signal + timeout signal.
      const mergedSignal = (() => {
        const ac = new AbortController()
        signal.addEventListener('abort', () => ac.abort(), { once: true })
        timeoutController.signal.addEventListener('abort', () => ac.abort(), {
          once: true,
        })
        return ac.signal
      })()

      clearTimeout(timeoutId)

      try {
        // Encode agreement_id topic filter. Events are published with topics
        // (symbol, agreement_id), so the first segment is a wildcard and the
        // agreement id is matched against topic 1.
        const idScVal = xdr.ScVal.scvBytes(hexToBytes(agreementId))
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
                topics: [['*', idTopic]],
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

        if (!unmountedRef.current) {
          setEvents(parsed)
          setIsLoading(false)
        }

        failureCount.current = 0
        return true
      } catch (err) {
        clearTimeout(timeoutHandle)

        // Abort errors (unmount or timeout) are not user-facing failures.
        if (
          signal.aborted ||
          (err instanceof Error && err.name === 'AbortError')
        ) {
          if (!unmountedRef.current) setIsLoading(false)
          return false
        }

        console.error('[useAgreementEvents] Failed to fetch:', err)

        if (!unmountedRef.current) {
          const message = err instanceof Error ? err.message : 'Failed to fetch events'
          setError(isRetentionWindowError(message) ? RETENTION_WINDOW_MESSAGE : message)
          setIsLoading(false)
        }

        failureCount.current += 1
        return false
      } finally {
        clearTimeout(timeoutHandle)
      }
    },
    [agreementId],
  )

  useEffect(() => {
    unmountedRef.current = false
    failureCount.current = 0

    const controller = new AbortController()
    let closeStream: (() => void) | null = null

    /**
     * Recursive polling: schedule the next poll only after the current fetch
     * resolves, preventing concurrent in-flight requests.  Back off linearly on
     * repeated failures (each failure adds one base interval, capped at max).
     */
    const schedule = (delayMs: number) => {
      timerRef.current = setTimeout(async () => {
        if (controller.signal.aborted) return
        await fetchEvents(controller.signal)
        if (!controller.signal.aborted) {
          const nextDelay = Math.min(
            BASE_POLL_INTERVAL_MS +
              failureCount.current * BASE_POLL_INTERVAL_MS,
            MAX_POLL_INTERVAL_MS,
          )
          schedule(nextDelay)
        }
      }, delayMs)
    }

    const startPolling = () => {
      relayActiveRef.current = false
      if (controller.signal.aborted) return
      // Fire immediately (0 ms delay), then recurse.
      schedule(0)
    }

    if (agreementId && getIndexerUrl()) {
      relayActiveRef.current = true
      setIsLoading(true)
      setError(null)
      closeStream = openIndexerStream(
        `/stream/events?agreementId=${encodeURIComponent(agreementId)}`,
        {
          snapshot: (data) => {
            if (unmountedRef.current) return
            setEvents(toAgreementEvents(eventsOf(data), agreementId))
            setIsLoading(false)
          },
          events: (data) => {
            if (unmountedRef.current) return
            const fresh = toAgreementEvents(eventsOf(data), agreementId)
            setEvents((prev) => mergeEvents(prev, fresh))
          },
        },
        startPolling,
      )
    } else {
      startPolling()
    }

    return () => {
      unmountedRef.current = true
      controller.abort()
      closeStream?.()
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [fetchEvents, agreementId])

  const refetch = useCallback(async () => {
    if (!agreementId) return

    if (relayActiveRef.current) {
      try {
        const indexed = await fetchIndexedEvents(agreementId)
        if (!unmountedRef.current) {
          setEvents(toAgreementEvents(indexed, agreementId))
          setError(null)
        }
      } catch (err) {
        if (!unmountedRef.current) {
          const message = err instanceof Error ? err.message : 'Failed to fetch events'
          setError(isRetentionWindowError(message) ? RETENTION_WINDOW_MESSAGE : message)
        }
      }
      return
    }

    const controller = new AbortController()
    await fetchEvents(controller.signal)
  }, [agreementId, fetchEvents])

  return { events, isLoading, error, refetch }
}

/** Extract the events array from an indexer payload (snapshot or delta). */
function eventsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && 'events' in data) {
    const events = (data as { events?: unknown }).events
    if (Array.isArray(events)) return events
  }
  return []
}

/** Merge freshly fetched events into the existing list, de-duplicating by id. */
function mergeEvents(prev: AgreementEvent[], fresh: AgreementEvent[]): AgreementEvent[] {
  const seen = new Set(prev.map((e) => e.id).filter((id): id is string => Boolean(id)))
  const additions = fresh.filter((e) => !e.id || !seen.has(e.id))
  return additions.length ? [...prev, ...additions] : prev
}

/**
 * Convert raw RPC/indexer event responses into typed AgreementEvent objects,
 * keeping only events that belong to the given agreement.
 */
function toAgreementEvents(rawEvents: unknown[], agreementId: string): AgreementEvent[] {
  const result: AgreementEvent[] = []

  for (const raw of rawEvents) {
    if (!isValidEventResponse(raw)) continue
    const event = raw as RawEventResponse

    const parsed = parseAgreementEvent(event, agreementId)
    if (parsed) result.push(parsed)
  }

  return result
}

/** Parse a single raw event into an AgreementEvent, or null if not relevant. */
function parseAgreementEvent(
  event: RawEventResponse,
  agreementId: string,
): AgreementEvent | null {
  const topics = event.topic ?? []
  if (topics.length < 2) return null

  // topic[1] is the agreement_id (topic[0] is the event symbol).
  const eventAgreementId = decodeScValString(topics[1])
  if (eventAgreementId && eventAgreementId !== agreementId) return null

  const type = decodeScValString(topics[0]) ?? 'unknown'

  return {
    id: event.id,
    type,
    ledger: event.ledger,
    txHash: event.txHash,
    timestamp: event.ledgerClosedAt ?? '',
    agreementId: eventAgreementId ?? agreementId,
  }
}

/** Best-effort decode of an ScVal topic into a string (hex for bytes). */
function decodeScValString(scVal: unknown): string | undefined {
  if (typeof scVal === 'string') return scVal
  return undefined
}
