import { useRef, useState } from 'react'
import { nativeToScVal } from '@stellar/stellar-sdk'
import { useContractInvoke } from '../hooks/useContractInvoke'
import { useWallet } from '../context/WalletContext'
import useToast from '../hooks/useToast'
import TransactionStatus from './TransactionStatus'
import type { Agreement, Milestone } from '../lib/soroban'

interface MilestoneActionsProps {
  milestone: Milestone
  agreement: Agreement
  onSuccess?: () => void
}

const MAX_RETRIES = 3
const BASE_FEE = 100_000

export default function MilestoneActions({ milestone, agreement, onSuccess }: MilestoneActionsProps) {
  const wallet = useWallet()
  const toast = useToast()
  const { invoke, status, txHash, error, reset } = useContractInvoke()
  const [showProofInput, setShowProofInput] = useState(false)
  const [proofUri, setProofUri] = useState('')
  const [showConfirm, setShowConfirm] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const pendingAction = useRef<string | null>(null)

  const isLoading = status === 'building' || status === 'signing' || status === 'submitting'
  const isUserPayer = wallet.publicKey === agreement.payer
  const isUserPayee = wallet.publicKey === agreement.payee

  const handleLockFunds = async (fee?: string) => {
    if (!wallet.publicKey) return

    pendingAction.current = 'lock_funds'
    try {
      const idBytes = Buffer.from(agreement.agreement_id, 'hex')
      const args = [
        nativeToScVal(wallet.publicKey, { type: 'address' }),
        nativeToScVal(idBytes, { type: 'bytes' }),
        nativeToScVal(milestone.id, { type: 'u32' }),
      ]

      await invoke('lock_funds', args, wallet.publicKey, fee)
      toast.success({ title: 'Funds locked successfully' })
      setShowConfirm(null)
      setRetryCount(0)
      pendingAction.current = null
      onSuccess?.()
    } catch (err) {
      toast.error({ title: 'Lock funds failed', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const handleSubmitWork = async (fee?: string) => {
    if (!wallet.publicKey || !proofUri.trim()) return

    pendingAction.current = 'submit_work'
    try {
      const idBytes = Buffer.from(agreement.agreement_id, 'hex')
      const args = [
        nativeToScVal(wallet.publicKey, { type: 'address' }),
        nativeToScVal(idBytes, { type: 'bytes' }),
        nativeToScVal(milestone.id, { type: 'u32' }),
        nativeToScVal(proofUri, { type: 'string' }),
      ]

      await invoke('submit_work', args, wallet.publicKey, fee)
      toast.success({ title: 'Work submitted successfully' })
      setShowProofInput(false)
      setProofUri('')
      setShowConfirm(null)
      setRetryCount(0)
      pendingAction.current = null
      onSuccess?.()
    } catch (err) {
      toast.error({ title: 'Submit work failed', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const handleApproveRelease = async (fee?: string) => {
    if (!wallet.publicKey) return

    pendingAction.current = 'approve_and_release'
    try {
      const idBytes = Buffer.from(agreement.agreement_id, 'hex')
      const args = [
        nativeToScVal(wallet.publicKey, { type: 'address' }),
        nativeToScVal(idBytes, { type: 'bytes' }),
        nativeToScVal(milestone.id, { type: 'u32' }),
      ]

      await invoke('approve_and_release', args, wallet.publicKey, fee)
      toast.success({ title: 'Milestone approved and funds released' })
      setShowConfirm(null)
      setRetryCount(0)
      pendingAction.current = null
      onSuccess?.()
    } catch (err) {
      toast.error({ title: 'Approve failed', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const handleRaiseDispute = async (fee?: string) => {
    if (!wallet.publicKey) return

    pendingAction.current = 'raise_dispute'
    try {
      const idBytes = Buffer.from(agreement.agreement_id, 'hex')
      const args = [
        nativeToScVal(wallet.publicKey, { type: 'address' }),
        nativeToScVal(idBytes, { type: 'bytes' }),
        nativeToScVal(milestone.id, { type: 'u32' }),
      ]

      await invoke('raise_dispute', args, wallet.publicKey, fee)
      toast.success({ title: 'Dispute raised' })
      setShowConfirm(null)
      setRetryCount(0)
      pendingAction.current = null
      onSuccess?.()
    } catch (err) {
      toast.error({ title: 'Raise dispute failed', message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const handleRetry = () => {
    if (retryCount >= MAX_RETRIES) return
    const next = retryCount + 1
    setRetryCount(next)
    reset()
    const adjustedFee = String(Math.round(BASE_FEE * Math.pow(1.1, next)))
    if (pendingAction.current === 'lock_funds') handleLockFunds(adjustedFee)
    else if (pendingAction.current === 'submit_work') handleSubmitWork(adjustedFee)
    else if (pendingAction.current === 'approve_and_release') handleApproveRelease(adjustedFee)
    else if (pendingAction.current === 'raise_dispute') handleRaiseDispute(adjustedFee)
  }

  // Determine available actions based on milestone status and user role
  const actions: Array<{ label: string; action: () => void; color: string }> = []

  if (milestone.status === 'Pending' && isUserPayer) {
    actions.push({
      label: 'Lock Funds',
      action: () => setShowConfirm('lock'),
      color: 'bg-cyan-500 hover:bg-cyan-400',
    })
  }

  if (milestone.status === 'Funded' && isUserPayee) {
    actions.push({
      label: 'Submit Work',
      action: () => setShowProofInput(true),
      color: 'bg-emerald-500 hover:bg-emerald-400',
    })
  }

  if (milestone.status === 'WorkSubmitted' && isUserPayer) {
    actions.push({
      label: 'Approve & Release',
      action: () => setShowConfirm('approve'),
      color: 'bg-green-500 hover:bg-green-400',
    })
  }

  if ((milestone.status === 'Funded' || milestone.status === 'WorkSubmitted') && wallet.connected) {
    actions.push({
      label: 'Dispute',
      action: () => setShowConfirm('dispute'),
      color: 'bg-red-500 hover:bg-red-400',
    })
  }

  if (actions.length === 0) {
    return <span className="text-gray-500 text-sm">—</span>
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.action}
            disabled={isLoading || !wallet.connected}
            className={`px-3 py-1 ${action.color} text-white font-semibold text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {action.label}
          </button>
        ))}
      </div>

      <TransactionStatus
        status={status}
        txHash={txHash}
        error={error}
        onRetry={handleRetry}
        method={pendingAction.current || ''}
        retryCount={retryCount}
        maxRetries={MAX_RETRIES}
      />

      {/* Proof URI Input */}
      {showProofInput && (
        <div className="space-y-2 p-3 bg-navy-700 rounded">
          <input
            type="text"
            placeholder="Proof URI (e.g., GitHub PR, IPFS link)"
            value={proofUri}
            onChange={(e) => setProofUri(e.target.value)}
            className="w-full px-3 py-2 bg-navy-800 border border-navy-600 text-white text-sm rounded focus:outline-none focus:border-cyan-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmitWork}
              disabled={!proofUri.trim() || isLoading}
              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-white text-xs rounded disabled:opacity-50"
            >
              {isLoading ? 'Submitting...' : 'Submit'}
            </button>
            <button
              onClick={() => {
                setShowProofInput(false)
                setProofUri('')
              }}
              className="px-3 py-1 bg-navy-600 hover:bg-navy-500 text-white text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="p-3 bg-navy-700 rounded border border-yellow-500/50">
          <p className="text-sm text-gray-300 mb-2">
            {showConfirm === 'lock' && `Lock ${milestone.amount} tokens for milestone ${milestone.id}?`}
            {showConfirm === 'approve' && `Approve and release ${milestone.amount} tokens to payee?`}
            {showConfirm === 'dispute' && 'Raise a dispute for this milestone?'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (showConfirm === 'lock') handleLockFunds()
                else if (showConfirm === 'approve') handleApproveRelease()
                else if (showConfirm === 'dispute') handleRaiseDispute()
              }}
              disabled={isLoading}
              className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-white text-xs rounded disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              disabled={isLoading}
              className="px-3 py-1 bg-navy-600 hover:bg-navy-500 text-white text-xs rounded disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
