import { useState } from 'react'
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
  invoke: (method: string, args: xdr.ScVal[], publicKey: string) => Promise<string>
  status: InvokeStatus
  txHash: string | null
  error: string | null
  reset: () => void
}

/**
 * Hook to invoke state-mutating contract methods via Freighter wallet.
 * Builds, simulates, signs, and submits transactions.
 */
export function useContractInvoke(): UseContractInvokeResult {
  const [status, setStatus] = useState<InvokeStatus>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStatus('idle')
    setTxHash(null)
    setError(null)
  }

  const invoke = async (
    method: string,
    args: xdr.ScVal[],
    publicKey: string,
  ): Promise<string> => {
    try {
      setStatus('building')
      setError(null)
      setTxHash(null)

      const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') })
      const contract = new Contract(CONTRACT_ID)

      // Fetch account to get correct sequence number
      const sourceAccount = await server.getAccount(publicKey)

      // Build transaction
      const builtTx = new TransactionBuilder(sourceAccount, {
        fee: '100000',
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(method, ...args))
        .setTimeout(180)
        .build()

      // Simulate + assemble in one step; throws on simulation error.
      const preparedTx = await server.prepareTransaction(builtTx)

      // Sign with Freighter
      setStatus('signing')
      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: publicKey,
      })
      
      if (!signResult.ok) {
        throw new Error(signResult.error.message)
      }
      
      const signedTx = TransactionBuilder.fromXDR(signResult.value, NETWORK_PASSPHRASE) as Transaction

      // Submit transaction
      setStatus('submitting')
      const sendResult = await server.sendTransaction(signedTx)

      if (sendResult.status === 'ERROR') {
        throw new Error(`Transaction failed: ${sendResult.errorResult?.toXDR('base64')}`)
      }

      // Poll for transaction result
      const getResult = await server.pollTransaction(sendResult.hash, { attempts: 30 })

      if (getResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
        throw new Error('Transaction not found after polling')
      }

      if (getResult.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error('Transaction failed')
      }

      setTxHash(sendResult.hash)
      setStatus('success')

      return sendResult.hash
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed'
      console.error(`[useContractInvoke] ${method} failed:`, err)
      setError(message)
      setStatus('error')
      throw err
    }
  }

  return { invoke, status, txHash, error, reset }
}
