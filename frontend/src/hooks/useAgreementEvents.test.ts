import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
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
