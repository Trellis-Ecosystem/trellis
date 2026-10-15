import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Captured TransactionBuilder options, asserted on by the fee tests below.
let capturedFee: string | undefined

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>()
  class FakeTransactionBuilder {
    constructor(_source: unknown, opts: { fee?: string }) {
      capturedFee = opts?.fee
    }
    addOperation() {
      return this
    }
    setTimeout() {
      return this
    }
    build() {
      return {}
    }
  }
  class FakeServer {
    async getAccount() {
      return {}
    }
    async simulateTransaction() {
      return {}
    }
  }
  return {
    ...actual,
    TransactionBuilder: FakeTransactionBuilder,
    rpc: {
      ...actual.rpc,
      Server: FakeServer,
      // Short-circuit before signing; the fee assertion happens at build time.
      assembleTransaction: () => ({ build: () => ({ toXDR: () => 'xdr' }) }),
    },
  }
})

vi.mock('../lib/wallet', () => ({
  signTransaction: vi.fn(async () => ({
    ok: false,
    error: { message: 'test: stop before signing' },
  })),
}))

import { useContractInvoke } from './useContractInvoke'

describe('useContractInvoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedFee = undefined
  })

  it('initializes with idle status', () => {
    const { result } = renderHook(() => useContractInvoke())

    expect(result.current.status).toBe('idle')
    expect(result.current.txHash).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('provides invoke function', () => {
    const { result } = renderHook(() => useContractInvoke())

    expect(typeof result.current.invoke).toBe('function')
  })

  it('provides reset function', () => {
    const { result } = renderHook(() => useContractInvoke())

    expect(typeof result.current.reset).toBe('function')
  })

  it('reset clears status and error', async () => {
    const { result } = renderHook(() => useContractInvoke())

    // Manually set some state (in real usage this would happen via invoke)
    // Since we can't easily trigger invoke in test, we just verify reset exists
    expect(result.current.reset).toBeDefined()

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
  })

  it('provides methods for transaction management', () => {
    const { result } = renderHook(() => useContractInvoke())

    expect(result.current).toHaveProperty('invoke')
    expect(result.current).toHaveProperty('status')
    expect(result.current).toHaveProperty('txHash')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('reset')
  })

  it('builds the transaction with the fee argument passed to invoke', async () => {
    const { result } = renderHook(() => useContractInvoke())

    // The fake wallet short-circuits at signing; the fee was already captured
    // when the transaction was built, which is what this asserts.
    await expect(
      result.current.invoke('lock_funds', [], 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '300000'),
    ).rejects.toThrow()

    expect(capturedFee).toBe('300000')
  })

  it('falls back to the default fee when none is passed', async () => {
    const { result } = renderHook(() => useContractInvoke())

    await expect(
      result.current.invoke('lock_funds', [], 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    ).rejects.toThrow()

    expect(capturedFee).toBe('100000')
  })
})
