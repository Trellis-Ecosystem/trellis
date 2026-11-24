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

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useAgreement', () => {
  it.each([null, 'invalid-id'])('skips the RPC call for %s', (id) => {
    const simulate = vi.spyOn(rpc.Server.prototype, 'simulateTransaction')
    const { result } = renderHook(() => useAgreement(id))

    expect(result.current).toMatchObject({ agreement: null, isLoading: false, isError: false })
    expect(simulate).not.toHaveBeenCalled()
  })

  it('surfaces a contract error after one attempt', async () => {
    vi.useFakeTimers()
    const simulate = vi.spyOn(rpc.Server.prototype, 'simulateTransaction').mockResolvedValue({
      _parsed: true, id: '1', latestLedger: 1, events: [], error: 'Agreement does not exist',
    })
    const { result } = renderHook(() => useAgreement(agreementId))

    await act(async () => {})
    expect(result.current).toMatchObject({
      isError: true, isLoading: false, errorKind: 'contract', error: 'Agreement does not exist',
    })
    await act(() => vi.advanceTimersByTimeAsync(6000))
    expect(simulate).toHaveBeenCalledTimes(1)
  })

  it('retries RPC failures with backoff and surfaces the error after three retries', async () => {
    vi.useFakeTimers()
    const simulate = vi.spyOn(rpc.Server.prototype, 'simulateTransaction')
      .mockRejectedValue(new Error('RPC timed out'))
    const { result } = renderHook(() => useAgreement(agreementId))

    await act(async () => {})
    expect(result.current).toMatchObject({ isLoading: true, isError: false })
    for (const delay of [1000, 2000, 3000]) {
      await act(() => vi.advanceTimersByTimeAsync(delay))
    }
    expect(simulate).toHaveBeenCalledTimes(4)
    expect(result.current).toMatchObject({
      isError: true, isLoading: false, errorKind: 'rpc', error: 'RPC timed out',
    })
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
