import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useAgreementEvents } from './useAgreementEvents'

const rpcCalls = vi.hoisted(() => ({ getEvents: 0 }))

function stubRpc() {
  rpcCalls.getEvents = 0
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
        rpcCalls.getEvents += 1
        return {
          ok: true,
          json: async () => ({ result: { events: [] } }),
        } as Response
      }
      throw new Error(`unexpected RPC method ${body.method}`)
    }),
  )
}

describe('useAgreementEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
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

  it('keeps polling after a manual refetch', async () => {
    stubRpc()
    vi.useFakeTimers()

    const { result } = renderHook(() => useAgreementEvents('a'.repeat(64)))

    // The initial schedule(0) fires immediately.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(rpcCalls.getEvents).toBe(1)

    // Manual refetch: one immediate call plus the polling chain resumes.
    await act(async () => {
      result.current.refetch()
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(rpcCalls.getEvents).toBe(2)

    // If the chain were broken, advancing past the 10s base interval would
    // produce no further requests.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(rpcCalls.getEvents).toBe(3)
  })
})
