import { useState } from 'react'
import {
  Contract,
  SorobanRpc,
  Transaction,
  TransactionBuilder,
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
    fee: string = '100000',
  ): Promise<string> => {
    try {
      setStatus('building')
      setError(null)
      setTxHash(null)

      const server = new SorobanRpc.Server(RPC_URL)
      const contract = new Contract(CONTRACT_ID)

      // Fetch account to get correct sequence number
      const sourceAccount = await server.getAccount(publicKey)

      // Build transaction
      const builtTx = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(method, ...args))
        .setTimeout(180)
        .build()

      // Simulate to prepare transaction
      const simulated = await server.simulateTransaction(builtTx)

      if (SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(`Simulation failed: ${simulated.error}`)
      }

      // Prepare transaction with simulation results
      const preparedTx = SorobanRpc.assembleTransaction(builtTx, simulated).build()

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
      let getResult = await server.getTransaction(sendResult.hash)
      let attempts = 0
      const maxAttempts = 30

      while (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        getResult = await server.getTransaction(sendResult.hash)
        attempts++
      }

      if (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
        throw new Error('Transaction not found after polling')
      }

      if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
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
