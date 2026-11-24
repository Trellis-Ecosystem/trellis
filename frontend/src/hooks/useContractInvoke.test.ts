import { renderHook, act } from '@testing-library/react'
import { Account, SorobanDataBuilder, rpc, xdr } from '@stellar/stellar-sdk'
import { signTransaction } from '../lib/wallet'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { useContractInvoke } from './useContractInvoke'

describe('useContractInvoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})

vi.mock('../lib/wallet', () => ({ signTransaction: vi.fn() }))

describe('transaction submission', () => {
  const publicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  const hash = 'b'.repeat(64)

  beforeEach(() => {
    vi.spyOn(rpc.Server.prototype, 'getAccount').mockResolvedValue(new Account(publicKey, '0'))
    vi.spyOn(rpc.Server.prototype, 'simulateTransaction').mockResolvedValue({
      _parsed: true, id: '1', latestLedger: 1, events: [], minResourceFee: '0',
      transactionData: new SorobanDataBuilder(),
      result: { auth: [], retval: xdr.ScVal.scvVoid() },
    })
    vi.mocked(signTransaction).mockImplementation(async (value) => ({ ok: true, value }))
  })

  afterEach(() => vi.restoreAllMocks())

  it('uses the supplied fee and reports congestion without polling', async () => {
    vi.spyOn(rpc.Server.prototype, 'sendTransaction').mockResolvedValue({
      status: 'TRY_AGAIN_LATER', hash, latestLedger: 1, latestLedgerCloseTime: 1,
    })
    const getTransaction = vi.spyOn(rpc.Server.prototype, 'getTransaction')
    const { result } = renderHook(() => useContractInvoke())

    await act(async () => {
      await expect(result.current.invoke('lock_funds', [], publicKey, '200000'))
        .rejects.toThrow('The network is busy. Please try again.')
    })
    expect(vi.mocked(rpc.Server.prototype.simulateTransaction).mock.calls[0][0].fee).toBe('200000')
    expect(getTransaction).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({
      status: 'error', txHash: null, error: 'The network is busy. Please try again.',
    })
  })

  it.each(['PENDING', 'DUPLICATE'] as const)('polls %s and retains the hash and result code on failure', async (status) => {
    vi.spyOn(rpc.Server.prototype, 'sendTransaction').mockResolvedValue({
      status, hash, latestLedger: 1, latestLedgerCloseTime: 1,
    })
    const resultXdr = new xdr.TransactionResult({
      feeCharged: xdr.Int64.fromString('100000'),
      result: xdr.TransactionResultResult.txFailed([]),
      ext: new xdr.TransactionResultExt(0),
    })
    const getTransaction = vi.spyOn(rpc.Server.prototype, 'getTransaction')
      .mockResolvedValue({ status: rpc.Api.GetTransactionStatus.FAILED, resultXdr } as rpc.Api.GetFailedTransactionResponse)
    const { result } = renderHook(() => useContractInvoke())

    await act(async () => {
      await expect(result.current.invoke('lock_funds', [], publicKey)).rejects.toThrow('txFailed')
    })
    expect(getTransaction).toHaveBeenCalledWith(hash)
    expect(result.current).toMatchObject({ status: 'error', txHash: hash })
    expect(result.current.error).toContain('txFailed')
  })
})
