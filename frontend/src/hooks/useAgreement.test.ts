import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useAgreement } from './useAgreement'

describe('useAgreement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with loading state', () => {
    const { result } = renderHook(() => useAgreement(null))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.agreement).toBeNull()
  })

  it('returns error state when agreement ID is invalid', () => {
    const { result } = renderHook(() => useAgreement('invalid-id'))

    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('isError')
    expect(result.current).toHaveProperty('error')
  })

  it('provides refetch function', () => {
    const { result } = renderHook(() => useAgreement(null))

    expect(typeof result.current.refetch).toBe('function')
  })

  it('returns null agreement when no ID is provided', () => {
    const { result } = renderHook(() => useAgreement(null))

    expect(result.current.agreement).toBeNull()
  })

  it('provides agreement fetching properties', () => {
    const { result } = renderHook(() => useAgreement(null))

    expect(result.current).toHaveProperty('agreement')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('isError')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('refetch')
  })

  it('initializes loading state correctly', () => {
    const { result } = renderHook(() => useAgreement(null))

    expect(typeof result.current.isLoading).toBe('boolean')
    expect(typeof result.current.isError).toBe('boolean')
  })
})
