import { useCallback, useEffect, useRef, useState } from 'react'
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
 * Uses a recursive setTimeout chain so the next poll only starts after the
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

  const fetchEvents = useCallback(
    async (signal: AbortSignal): Promise<boolean> => {
      if (!agreementId) return true // treat no-id as "success" (no-op)

      setIsLoading(true)
      setError(null)

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
        // Encode agreement_id topic filter
        const idBytes = Buffer.from(agreementId, 'hex')
        const idScVal = xdr.ScVal.scvBytes(idBytes)
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
          signal: mergedSignal,
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
          setError(err instanceof Error ? err.message : 'Failed to fetch events')
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

    // Fire immediately (0 ms delay), then recurse.
    schedule(0)

    return () => {
      unmountedRef.current = true
      controller.abort()
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [fetchEvents])

  const refetch = useCallback(() => {
    // Cancel any pending timer and fire immediately.
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    failureCount.current = 0
    void fetchEvents(new AbortController().signal)
  }, [fetchEvents])

  return { events, isLoading, error, refetch }
}

function parseEventType(event: any): string {
  try {
    const topics = event.topic || []
    if (topics.length > 0) {
      const firstTopic = xdr.ScVal.fromXDR(topics[0], 'base64')
      if (firstTopic.switch().name === 'scvSymbol') {
        const symbol = firstTopic.sym().toString()
        // Map abbreviated symbols to human-readable names
        return EVENT_TYPE_MAP[symbol] || symbol
      }
    }
  } catch {
    // Fallback
  }
  return 'unknown'
}

/**
 * Map event type symbols to human-readable names.
 * Symbols are abbreviated to fit in 9 characters per contract/events.rs.
 */
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
 * Convert a Soroban Address ScVal to its string representation (account ID).
 */
function scValToAddress(scVal: any): string {
  try {
    if (scVal.switch().name === 'scvAddress') {
      const addr = scVal.address()
      if (addr.switch().name === 'accountId') {
        return addr.accountId().accountId().toString('hex')
      }
      if (addr.switch().name === 'contractId') {
        return addr.contractId().toString('hex')
      }
    }
  } catch {
    // Fallback
  }
  return ''
}

/**
 * Extract a u32 value from a Soroban ScVal.
 */
function scValToU32(scVal: any): number {
  try {
    if (scVal.switch().name === 'scvU32') {
      return scVal.u32().toNumber()
    }
  } catch {
    // Fallback
  }
  return 0
}

/**
 * Extract an i128 value from a Soroban ScVal.
 */
function scValToI128(scVal: any): string {
  try {
    if (scVal.switch().name === 'scvI128') {
      const hi = scVal.i128().hi().toNumber()
      const lo = scVal.i128().lo().toNumber()
      // Reconstruct the i128 as a bigint for accurate representation
      const value = BigInt(hi) * BigInt(Math.pow(2, 64)) + BigInt(lo)
      return value.toString()
    }
  } catch {
    // Fallback
  }
  return '0'
}

/**
 * Extract a boolean value from a Soroban ScVal.
 */
function scValToBool(scVal: any): boolean {
  try {
    if (scVal.switch().name === 'scvBool') {
      return scVal.b()
    }
  } catch {
    // Fallback
  }
  return false
}

/**
 * Extract a string value from a Soroban ScVal (Option<String>).
 */
function scValToOptionalString(scVal: any): string | undefined {
  try {
    if (scVal.switch().name === 'scvOption') {
      const optVal = scVal.opt()
      if (optVal === null) {
        return undefined
      }
      if (optVal.switch().name === 'scvString') {
        return optVal.str().toString()
      }
    }
  } catch {
    // Fallback
  }
  return undefined
}

/**
 * Parse event data payload based on the event type.
 * Event data is an XDR-encoded tuple with fields specific to each event type.
 *
 * Based on contract/events.rs schema:
 *   1. "trlls_crte" (agreement_created) → (payer: Address, payee: Address)
 *   2. "trlls_lckd" (funds_locked) → (milestone_id: u32, amount: i128)
 *   3. "trlls_sbmt" (work_submitted) → (milestone_id: u32, proof_uri: Option<String>)
 *   4. "trlls_rlsd" (funds_released) → (milestone_id: u32, amount: i128)
 *   5. "trlls_dspt" (dispute_raised) → (milestone_id: u32, caller: Address)
 *   6. "trlls_rslv" (milestone_resolved) → (milestone_id: u32, refunded_to_payer: bool)
 *   7. "trlls_cncl" (milestone_cancelled) → (milestone_id: u32, payer: Address, cancelled_by: Address)
 *   8. "trlls_ttle" (ttl_extended) → (caller: Address)
 */
function parseEventData(event: any): Partial<AgreementEvent> {
  try {
    const value = event.value?.xdr
    if (!value) return {}

    // Get the event type from topics
    const topics = event.topic || []
    let eventTypeSymbol = 'unknown'
    if (topics.length > 0) {
      try {
        const firstTopic = xdr.ScVal.fromXDR(topics[0], 'base64')
        if (firstTopic.switch().name === 'scvSymbol') {
          eventTypeSymbol = firstTopic.sym().toString()
        }
      } catch {
        // Ignore
      }
    }

    const scVal = xdr.ScVal.fromXDR(value, 'base64')

    // Event data is always a tuple; extract elements
    if (scVal.switch().name !== 'scvVec') {
      return {}
    }

    const elements = scVal.vec() || []

    // Parse based on event type
    switch (eventTypeSymbol) {
      case 'trlls_crte': // agreement_created (payer, payee)
        return {
          payer: scValToAddress(elements[0]),
          payee: scValToAddress(elements[1]),
        }

      case 'trlls_lckd': // funds_locked (milestone_id, amount)
        return {
          milestoneId: scValToU32(elements[0]),
          amount: scValToI128(elements[1]),
        }

      case 'trlls_sbmt': // work_submitted (milestone_id, proof_uri)
        return {
          milestoneId: scValToU32(elements[0]),
          proofUri: scValToOptionalString(elements[1]),
        }

      case 'trlls_rlsd': // funds_released (milestone_id, amount)
        return {
          milestoneId: scValToU32(elements[0]),
          amount: scValToI128(elements[1]),
        }

      case 'trlls_dspt': // dispute_raised (milestone_id, caller)
        return {
          milestoneId: scValToU32(elements[0]),
          caller: scValToAddress(elements[1]),
        }

      case 'trlls_rslv': // milestone_resolved (milestone_id, refunded_to_payer)
        return {
          milestoneId: scValToU32(elements[0]),
          refundedToPayer: scValToBool(elements[1]),
        }

      case 'trlls_cncl': // milestone_cancelled (milestone_id, payer, cancelled_by)
        return {
          milestoneId: scValToU32(elements[0]),
          payer: scValToAddress(elements[1]),
          cancelledBy: scValToAddress(elements[2]),
        }

      case 'trlls_ttle': // ttl_extended (caller)
        return {
          caller: scValToAddress(elements[0]),
        }

      default:
        return {}
    }
  } catch (err) {
    console.warn('[useAgreementEvents] Failed to parse event data:', err)
    return {}
  }
}
