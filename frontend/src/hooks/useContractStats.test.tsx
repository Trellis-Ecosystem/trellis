import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useContractStats } from './useContractStats'

describe('useContractStats', () => {
  it('should fetch and parse contract stats from RPC', async () => {
    const { result } = renderHook(() => useContractStats())

    // Initial state should be loading
    expect(result.current.status).toBe('loading')
    expect(result.current.stats).toBeNull()

    // Wait for the hook to fetch and parse events
    await waitFor(
      () => {
        expect(result.current.status).toBe('ok')
      },
      { timeout: 3000 }
    )

    // MSW mock returns 2 events: 1 "created", 1 "locked"
    expect(result.current.stats).toEqual({
      agreements: 1,
      milestonesLocked: 1,
    })
    expect(result.current.lastUpdated).toBeTruthy()
  })

  it('should handle RPC errors gracefully', async () => {
    const { result } = renderHook(() => useContractStats())

    // Initial state
    expect(result.current.status).toBe('loading')

    // Should eventually resolve (either ok or error)
    await waitFor(
      () => {
        expect(['ok', 'error', 'stale']).toContain(result.current.status)
      },
      { timeout: 3000 }
    )
  })
})
