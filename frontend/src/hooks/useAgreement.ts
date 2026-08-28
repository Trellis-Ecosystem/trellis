import { useMemo } from 'react'
import { nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk'
import { useContractRead } from './useContractRead'
import { hexToBytes } from '../lib/format'
import type { Agreement } from '../lib/soroban'

/**
 * Hook to fetch agreement data from the contract using get_agreement entrypoint.
 * Returns structured Agreement data or error state.
 */
export function useAgreement(agreementId: string | null) {
  const args = useMemo(() => {
    if (!agreementId) return []
    
    // Convert agreement ID (hex string) to ScVal bytes
    const idBytes = hexToBytes(agreementId)
    return [nativeToScVal(idBytes, { type: 'bytes' })]
  }, [agreementId])

  const { data, status, error, refetch } = useContractRead<xdr.ScVal>(
    'get_agreement',
    args,
    !!agreementId,
  )

  const agreement = useMemo<Agreement | null>(() => {
    if (!data) return null

    try {
      // Parse the ScVal result into Agreement structure
      const native = scValToNative(data)
      
      return {
        agreement_id: agreementId!,
        payer: native.payer || '',
        payee: native.payee || '',
        token: native.token || '',
        dispute_resolver: native.dispute_resolver || '',
        milestones: (native.milestones || []).map((m: any, index: number) => ({
          id: index,
          amount: m.amount?.toString() || '0',
          status: parseEscrowStatus(m.status),
          proof_uri: m.proof_uri || '',
        })),
      }
    } catch (err) {
      console.error('[useAgreement] Failed to parse agreement data:', err)
      return null
    }
  }, [data, agreementId])

  return {
    agreement,
    isLoading: status === 'loading',
    isError: status === 'error',
    error,
    refetch,
  }
}

function parseEscrowStatus(statusValue: any): Agreement['milestones'][0]['status'] {
  // Handle both string names and enum-like structures
  if (typeof statusValue === 'string') {
    return statusValue as any
  }
  
  if (typeof statusValue === 'object' && statusValue !== null) {
    const keys = Object.keys(statusValue)
    if (keys.length > 0) {
      return keys[0] as any
    }
  }

  return 'Pending'
}
