import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useAgreementEvents } from './useAgreementEvents'

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
})
