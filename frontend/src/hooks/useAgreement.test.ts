import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nativeToScVal, rpc } from '@stellar/stellar-sdk'
import { useAgreement } from './useAgreement'

describe('useAgreement', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with loading state', () => {
    const { result } = renderHook(() => useAgreement(null))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.agreement).toBeNull()
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
  it('clears the previous agreement when the next ID fails to load', async () => {
    const simulate = vi.spyOn(rpc.Server.prototype, 'simulateTransaction')
    simulate.mockResolvedValueOnce({
      result: { retval: nativeToScVal({ milestones: [] }) },
    } as Awaited<ReturnType<typeof simulate>>)
    simulate.mockRejectedValue(new Error('Agreement not found'))

    const firstId = 'a'.repeat(64)
    const { result, rerender } = renderHook(({ id }) => useAgreement(id), {
      initialProps: { id: firstId },
    })
    await waitFor(() => expect(result.current.agreement?.agreement_id).toBe(firstId))

    rerender({ id: 'b'.repeat(64) })
    expect(result.current.agreement).toBeNull()
    await waitFor(() => expect(result.current.error).toBe('Agreement not found'))
    expect(result.current.agreement).toBeNull()
  })

})
