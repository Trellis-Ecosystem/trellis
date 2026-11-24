import { useCallback, useEffect, useMemo, useState } from 'react'
import { nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk'
import { useContractRead } from './useContractRead'
import { isValidHexAgreementId } from '../lib/agreementId'
import { hexToBytes } from '../lib/format'
import type { Agreement, RawAgreementResponse, RawMilestone } from '../lib/soroban'
import { isValidAgreementResponse, parseEscrowStatus, releasedAmountFor } from '../lib/soroban'

const MAX_RETRIES = 3

/**
 * Hook to fetch agreement data from the contract using get_agreement entrypoint.
 *
 * Returns a standardised { data, loading, error } shape alongside typed
 * helpers so consuming components can render skeleton loaders on `isLoading`
 * and surface error banners on `isError`.
 *
 * Retry logic: up to MAX_RETRIES automatic retries are attempted on RPC failure
 * before the error state is surfaced to the UI.  Retries use incremental back-
 * off (1 s, 2 s, 3 s).  The retry counter resets whenever the agreementId
 * changes or the consumer calls `refetch()`.
 */
export function useAgreement(agreementId: string | null) {
  const validId = agreementId && isValidHexAgreementId(agreementId) ? agreementId : null

  const args = useMemo(() => {
    if (!validId) return []
    return [nativeToScVal(hexToBytes(validId), { type: 'bytes' })]
  }, [validId])
  const [retries, setRetries] = useState({ args, count: 0 })
  const retryCount = retries.args === args ? retries.count : 0

  const { data, status, loading, error, errorKind, refetch: refetchRead } = useContractRead<xdr.ScVal>(
    'get_agreement',
    args,
    !!validId,
  )
  const willRetry = status === 'error' && errorKind === 'rpc' && retryCount < MAX_RETRIES

  useEffect(() => {
    if (!willRetry) return
    const timer = setTimeout(() => {
      setRetries({ args, count: retryCount + 1 })
      refetchRead()
    }, 1000 * (retryCount + 1))

    return () => clearTimeout(timer)
  }, [args, willRetry, retryCount, refetchRead])

  /**
   * Manually re-fetch and reset the retry counter so the user can try again
   * after the auto-retries have been exhausted.
   */
  const refetch = useCallback(() => {
    setRetries({ args, count: 0 })
    refetchRead()
  }, [args, refetchRead])

  const agreement = useMemo<Agreement | null>(() => {
    if (!data || !validId) return null

    try {
      // Parse the ScVal result into Agreement structure
      const native = scValToNative(data)

      // Validate the response structure
      if (!isValidAgreementResponse(native)) {
        console.error('[useAgreement] Invalid agreement response structure:', native)
        return null
      }

      const response = native as RawAgreementResponse
      const milestonesArray = response.milestones || []

      return {
        agreement_id: validId,
        payer: response.payer || '',
        payee: response.payee || '',
        token: response.token || '',
        dispute_resolver: response.dispute_resolver || '',
        milestones: milestonesArray.map((m: RawMilestone, index: number) => ({
          id: index,
          amount: typeof m.amount === 'string' ? m.amount : (m.amount?.toString() || '0'),
          status: parseEscrowStatus(m.status),
          proof_uri: m.proof_uri || '',
          released: releasedAmountFor(response.released_amounts, index),
        })),
      }
    } catch (err) {
      console.error('[useAgreement] Failed to parse agreement data:', err)
      return null
    }
  }, [data, validId])

  return {
    /** Parsed agreement or null while loading / on error. */
    agreement,
    /** True while the RPC call is in flight or waiting to retry. */
    isLoading: loading || willRetry,
    /** True when the last attempt ended in error and all retries are exhausted. */
    isError: status === 'error' && !willRetry,
    /** Human-readable error message, or null. */
    error,
    errorKind,
    /** Granular status string for consumers that need it. */
    status,
    /** Manually re-fetch and reset the retry counter. */
    refetch,
  }
}
