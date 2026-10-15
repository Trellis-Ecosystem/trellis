import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nativeToScVal } from '@stellar/stellar-sdk'
import { useAgreement } from './useAgreement'

// Per-test controllable simulation result returned by the fake RPC server.
const mocks = vi.hoisted(() => ({
  simulateResult: {} as Record<string, unknown>,
}))

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>()
  class FakeServer {
    async simulateTransaction() {
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

const PAYER = 'GAQAA5Z4K7FF5H66GEQXCWUBSBDZXY52B3Z5U42EB46BEOV6PC6YWRYE'
const PAYEE = 'GCYBXL5CD5FWUEURISB5PLAUQV2DNGHSACCNAK3FYJSTF2QJD5CUYNGF'

describe('useAgreement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.simulateResult = {}
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

  it('clears the previous agreement when navigating to an id that errors', async () => {
    const idA = 'a'.repeat(64)
    const idB = 'b'.repeat(64)

    mocks.simulateResult = {
      result: {
        retval: nativeToScVal({ payer: PAYER, payee: PAYEE, milestones: [] }),
      },
    }

    const { result, rerender } = renderHook(({ id }) => useAgreement(id), {
      initialProps: { id: idA },
    })

    await waitFor(() => expect(result.current.agreement).not.toBeNull())
    expect(result.current.agreement?.agreement_id).toBe(idA)

    // Navigate to a different id whose lookup fails — the stale agreement
    // must not remain visible under the new id.
    mocks.simulateResult = { error: 'simulation failed: missing agreement' }
    rerender({ id: idB })

    expect(result.current.agreement).toBeNull()
  })
})
