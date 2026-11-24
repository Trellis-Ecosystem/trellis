import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
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
  'trls_ttle',
  'trls_ddln',
  'trls_expd',
]

const mockEvents = TRLS_SYMBOLS.map((symbol, index) => ({
  id: String(index),
  type: symbol,
  timestamp: '2024-01-01T00:00:00Z',
  data: {},
}))

vi.mock('../lib/contractClient', () => ({
  getAgreementEvents: vi.fn(() => Promise.resolve(mockEvents)),
}))

describe('useAgreementEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('continues polling after a manual refetch', async () => {
    vi.useFakeTimers()
    const request = vi.fn(async (_url: string, options: RequestInit) => {
      const { method } = JSON.parse(options.body as string)
      return Response.json({ result: method === 'getLatestLedger' ? { sequence: 1000 } : { events: [] } })
    })
    vi.stubGlobal('fetch', request)
    const { result, unmount } = renderHook(() => useAgreementEvents('a'.repeat(64)))
    const eventRequests = () => request.mock.calls.filter(
      ([, options]) => JSON.parse(options.body as string).method === 'getEvents',
    )

    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(eventRequests()).toHaveLength(1)
    await act(async () => result.current.refetch())
    expect(eventRequests()).toHaveLength(2)
    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(eventRequests()).toHaveLength(3)
    unmount()
    expect(eventRequests()[2][1].signal?.aborted).toBe(true)
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
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('refetch')
  })

  it('initializes with boolean loading state', () => {
    const { result } = renderHook(() => useAgreementEvents(null))

    expect(typeof result.current.isLoading).toBe('boolean')
    expect(result.current.error).toBeNull()
  })

  it('maps every trls_* topic to a known event type', async () => {
    const { result } = renderHook(() => useAgreementEvents('agreement-1'))

    await vi.waitFor(() => {
      expect(result.current.events).toHaveLength(TRLS_SYMBOLS.length)
    })

    for (const event of result.current.events) {
      expect(event.type).not.toBe('unknown')
    }
  })
})
