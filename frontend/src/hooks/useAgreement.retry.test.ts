import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useAgreement } from './useAgreement'

// Controllable RPC server: `simulateError` is thrown (transport failure),
// otherwise `simulateResult` is returned (simulation-level outcome).
const mocks = vi.hoisted(() => ({
  simulateResult: {} as Record<string, unknown>,
  simulateError: null as Error | null,
  calls: 0,
}))

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>()
  class FakeServer {
    async simulateTransaction() {
      mocks.calls += 1
      if (mocks.simulateError) throw mocks.simulateError
      return mocks.simulateResult
    }
  }
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: FakeServer,
    },
  }
})

describe('useAgreement retry behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.simulateResult = {}
    mocks.simulateError = null
    mocks.calls = 0
  })

  it('surfaces a contract simulation error after a single attempt', async () => {
    // A simulation-level error (missing agreement) can never succeed, so the
    // hook must not schedule the 1s/2s/3s auto-retries.
    mocks.simulateResult = { error: 'simulation failed: agreement missing' }

    const { result } = renderHook(() => useAgreement('a'.repeat(64)))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.errorKind).toBe('contract')
    expect(mocks.calls).toBe(1)
  })

  it('retries a network failure', async () => {
    mocks.simulateError = new TypeError('fetch failed')

    const { result } = renderHook(() => useAgreement('a'.repeat(64)))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.errorKind).toBe('network')
    // The first auto-retry fires after 1s — allow up to 3s real time.
    await waitFor(() => expect(mocks.calls).toBeGreaterThanOrEqual(2), {
      timeout: 3000,
    })
  })
})
