import { describe, expect, it } from 'vitest'
import { formatSendTransactionError } from './useContractInvoke'
import type { xdr } from '@stellar/stellar-sdk'

/**
 * formatSendTransactionError previously (#292) produced
 * "Transaction failed: undefined" whenever errorResult.toXDR() returned
 * undefined, even though errorResult itself was present. These tests cover
 * the fallback chain: XDR + code -> code only -> generic message.
 */
describe('formatSendTransactionError', () => {
  it('includes the error code and base64 XDR when both are available', () => {
    const errorResult = {
      result: () => ({ switch: () => ({ name: 'txFAILED' }) }),
      toXDR: () => 'AAAAAAAAAGT/////',
    } as unknown as xdr.TransactionResult

    expect(formatSendTransactionError(errorResult)).toBe(
      'Transaction failed: txFAILED (AAAAAAAAAGT/////)',
    )
  })

  it('falls back to the error code when toXDR returns undefined', () => {
    const errorResult = {
      result: () => ({ switch: () => ({ name: 'txBAD_SEQ' }) }),
      toXDR: () => undefined,
    } as unknown as xdr.TransactionResult

    expect(formatSendTransactionError(errorResult)).toBe('Transaction failed: txBAD_SEQ')
  })

  it('falls back to the error code when toXDR throws', () => {
    const errorResult = {
      result: () => ({ switch: () => ({ name: 'txINTERNAL_ERROR' }) }),
      toXDR: () => {
        throw new Error('malformed result')
      },
    } as unknown as xdr.TransactionResult

    expect(formatSendTransactionError(errorResult)).toBe('Transaction failed: txINTERNAL_ERROR')
  })

  it('falls back to a generic message when neither the code nor the XDR is available', () => {
    const errorResult = {
      result: () => {
        throw new Error('no result')
      },
      toXDR: () => undefined,
    } as unknown as xdr.TransactionResult

    expect(formatSendTransactionError(errorResult)).toBe('Transaction failed: unknown error')
  })

  it('falls back to a generic message when errorResult itself is missing', () => {
    expect(formatSendTransactionError(undefined)).toBe('Transaction failed: unknown error')
  })
})
