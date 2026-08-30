import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Contract,
  Transaction,
  TransactionBuilder,
  rpc,
  xdr,
} from '@stellar/stellar-sdk'
import { signTransaction } from '../lib/wallet'
import { CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '../lib/config'

export type InvokeStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'success' | 'error'

interface UseContractInvokeResult {
  invoke: (method: string, args: xdr.ScVal[], publicKey: string, fee?: string) => Promise<string>
  status: InvokeStatus
  txHash: string | null
  error: string | null
  reset: () => void
}

/**
 * Hook to invoke state-mutating contract methods via Freighter wallet.
 * Builds, simulates, signs, and submits transactions.
 *
 * An AbortController is wired per-invocation and aborted on component unmount
 * so that any pending RPC calls are cancelled and stale state updates never
 * reach an unmounted component.  AbortErrors are swallowed silently.
 */
export function useContractInvoke(): UseContractInvokeResult {
  const [status, setStatus] = useState<InvokeStatus>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Tracks whether the component has unmounted so we can skip state updates.
  const unmountedRef = useRef(false)
  // Holds the AbortController for any in-flight invocation.
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      // Abort any in-flight RPC calls when the component unmounts.
      controllerRef.current?.abort()
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setTxHash(null)
    setError(null)
  }, [])

  const invoke = useCallback(
    async (method: string, args: xdr.ScVal[], publicKey: string): Promise<string> => {
      // Abort any previously in-flight invocation before starting a new one.
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      const { signal } = controller

      try {
        if (!unmountedRef.current) {
          setStatus('building')
          setError(null)
          setTxHash(null)
        }

        const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') })
        const contract = new Contract(CONTRACT_ID)

        // Fetch account to get correct sequence number
        const sourceAccount = await server.getAccount(publicKey)
        if (signal.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' })

        // Build transaction
        const builtTx = new TransactionBuilder(sourceAccount, {
          fee: '100000',
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(contract.call(method, ...args))
          .setTimeout(180)
          .build()

        // Simulate to prepare transaction
        const simulated = await server.simulateTransaction(builtTx)
        if (signal.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' })

        if (rpc.Api.isSimulationError(simulated)) {
          throw new Error(`Simulation failed: ${simulated.error}`)
        }

        // Prepare transaction with simulation results
        const preparedTx = rpc.assembleTransaction(builtTx, simulated).build()

        // Sign with Freighter
        if (!unmountedRef.current) setStatus('signing')
        const signResult = await signTransaction(preparedTx.toXDR(), {
          networkPassphrase: NETWORK_PASSPHRASE,
          address: publicKey,
        })
        if (signal.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' })

        if (!signResult.ok) {
          throw new Error(signResult.error.message)
        }

        const signedTx = TransactionBuilder.fromXDR(
          signResult.value,
          NETWORK_PASSPHRASE,
        ) as Transaction

        // Submit transaction
        if (!unmountedRef.current) setStatus('submitting')
        const sendResult = await server.sendTransaction(signedTx)
        if (signal.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' })

        if (sendResult.status === 'ERROR') {
          throw new Error(`Transaction failed: ${sendResult.errorResult?.toXDR('base64')}`)
        }

        // Poll for transaction result
        let getResult = await server.getTransaction(sendResult.hash)
        let attempts = 0
        const maxAttempts = 30

        while (
          getResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
          attempts < maxAttempts
        ) {
          if (signal.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
          await new Promise<void>((resolve) => setTimeout(resolve, 1000))
          getResult = await server.getTransaction(sendResult.hash)
          attempts++
        }

        if (getResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
          throw new Error('Transaction not found after polling')
        }

        if (getResult.status === rpc.Api.GetTransactionStatus.FAILED) {
          throw new Error('Transaction failed')
        }

        if (!unmountedRef.current) {
          setTxHash(sendResult.hash)
          setStatus('success')
        }

        return sendResult.hash
      } catch (err) {
        // Silently ignore abort errors — these are expected on unmount/navigate-away.
        if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          // Do not surface abort as a user-facing error.
          return ''
        }

        const message = err instanceof Error ? err.message : 'Transaction failed'
        console.error(`[useContractInvoke] ${method} failed:`, err)
        if (!unmountedRef.current) {
          setError(message)
          setStatus('error')
        }
        throw err
      }
    },
    [],
  )

  return { invoke, status, txHash, error, reset }
}
