import { useCallback, useEffect, useState } from 'react'
import { Account, Contract, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk'
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../lib/config'

// Soroban RPC requires a signed-looking source account even for a read-only
// simulation; this well-known all-zero-signature address never needs a real
// key since the transaction is simulated, never submitted.
const READ_ONLY_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

export type ReadStatus = 'idle' | 'loading' | 'success' | 'error'

interface UseContractReadResult<T> {
  data: T | null
  status: ReadStatus
  error: string | null
  refetch: () => void
}

/**
 * Hook to read data from a Soroban contract using RPC simulation.
 * Does not require wallet connection — read-only queries.
 */
export function useContractRead<T = unknown>(
  method: string,
  args: xdr.ScVal[],
  enabled = true,
): UseContractReadResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<ReadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()

    void (async () => {
      try {
        setStatus('loading')
        setError(null)

        const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') })
        const contract = new Contract(CONTRACT_ID)

        const tx = new TransactionBuilder(new Account(READ_ONLY_SOURCE, '0'), {
          fee: '100',
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(contract.call(method, ...args))
          .setTimeout(30)
          .build()

        const simulated = await server.simulateTransaction(tx)

        if (controller.signal.aborted) return

        if (rpc.Api.isSimulationError(simulated)) {
          throw new Error(simulated.error)
        }

        if (!simulated.result) {
          throw new Error('No result from simulation')
        }

        const resultValue = simulated.result.retval

        setData(resultValue as T)
        setStatus('success')
      } catch (err) {
        if (controller.signal.aborted) return

        const message = err instanceof Error ? err.message : 'Failed to read contract'
        console.error(`[useContractRead] ${method} failed:`, err)
        setError(message)
        setStatus('error')
      }
    })()

    return () => controller.abort()
  }, [method, args, enabled, refetchTrigger])

  return { data, status, error, refetch }
}
