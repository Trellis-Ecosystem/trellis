import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { xdr } from '@stellar/stellar-sdk'
import { useAgreementEvents } from './useAgreementEvents'

const TRLS_SYMBOLS = [
  'trls_crte',
  'trls_lckd',
  'trls_sbmt',
  'trls_rlsd',
  'trls_dspt',
  'trls_rslv',
  'trls_cncl',
  'trls_prtl',
  'trls_cmpl',
  'trls_ddln',
  'trls_expd',
  'trls_ttle',
]

describe('useAgreementEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes with empty events', () => {
    const { result } = renderHook(() => useAgreementEvents(null))

    expect(result.current.events).toEqual([])
  })

  it('provides loading state', () => {
    const { result } = renderHook(() => useAgreementEvents(null))

    expect(typeof result.current.isLoading).toBe('boolean')
  })

  it('provides error state', () => {
    const { result } = renderHook(() => useAgreementEvents(null))

    expect(result.current).toHaveProperty('isError')
    expect(result.current).toHaveProperty('error')
  })

  it('returns empty events when agreement ID is null', () => {
    const { result } = renderHook(() => useAgreementEvents(null))

    expect(result.current.events).toEqual([])
  })

  it('provides refetch function for events', () => {
    const { result } = renderHook(() => useAgreementEvents(null))

    expect(typeof result.current.refetch).toBe('function')
  })

  it('provides all required event fetching properties', () => {
    const { result } = renderHook(() => useAgreementEvents(null))

    expect(result.current).toHaveProperty('events')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('isError')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('refetch')
  })

  it('initializes with boolean loading state', () => {
    const { result } = renderHook(() => useAgreementEvents(null))

    expect(typeof result.current.isLoading).toBe('boolean')
    expect(typeof result.current.isError).toBe('boolean')
  })

  it('maps every trls_* topic symbol to a named event type', async () => {
    const events = TRLS_SYMBOLS.map((symbol, i) => ({
      ledger: 500_000 + i,
      txHash: `hash${i}`,
      ledgerClosedAt: new Date().toISOString(),
      type: 'contract',
      topic: [xdr.ScVal.scvSymbol(symbol).toXDR('base64')],
      value: { xdr: xdr.ScVal.scvVoid().toXDR('base64') },
    }))

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { body?: string }) => {
        const body = JSON.parse(init?.body ?? '{}') as { method?: string }
        if (body.method === 'getLatestLedger') {
          return {
            ok: true,
            json: async () => ({ result: { sequence: 600_000 } }),
          } as Response
        }
        if (body.method === 'getEvents') {
          return {
            ok: true,
            json: async () => ({ result: { events } }),
          } as Response
        }
        throw new Error(`unexpected RPC method ${body.method}`)
      }),
    )

    const { result } = renderHook(() => useAgreementEvents('a'.repeat(64)))

    await waitFor(() => expect(result.current.events).toHaveLength(TRLS_SYMBOLS.length))

    const types = result.current.events.map((e) => e.type)
    expect(types).toEqual(
      expect.arrayContaining([
        'created',
        'locked',
        'work_submitted',
        'released',
        'disputed',
        'resolved',
        'cancelled',
        'partially_released',
        'completed',
        'deadline_set',
        'expired',
        'ttl_extended',
      ]),
    )
    expect(types).not.toContain('unknown')
  })
})
