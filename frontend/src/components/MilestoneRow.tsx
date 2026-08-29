import { useState } from 'react';
import type { Milestone, Agreement, EscrowStatus } from '../lib/soroban';

interface WalletLike {
  connected: boolean;
  publicKey: string | null;
  error: string | null;
}

interface MilestoneRowProps {
  milestone: Milestone;
  agreement: Agreement;
  wallet: WalletLike;
  onUpdate?: () => void;
}

export default function MilestoneRow({ milestone, agreement, wallet }: MilestoneRowProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showProofInput, setShowProofInput] = useState(false);
  const [proofUri, setProofUri] = useState('');

  const getStatusBadgeColor = (status: EscrowStatus) => {
    const colors: Record<EscrowStatus, string> = {
      Pending: 'bg-gray-600',
      Funded: 'bg-blue-600',
      WorkSubmitted: 'bg-yellow-600',
      Completed: 'bg-green-600',
      Disputed: 'bg-red-600',
      Refunded: 'bg-gray-600',
    };
    return colors[status];
  };

  const isUserPayer = wallet.publicKey === agreement.payer;
  const isUserPayee = wallet.publicKey === agreement.payee;

  const getAvailableActions = () => {
    const actions: Array<{ label: string; action: () => void; requiresWallet?: boolean }> = [];

    if (milestone.status === 'Pending' && isUserPayer) {
      actions.push({
        label: 'Lock Funds',
        action: handleLockFunds,
        requiresWallet: true,
      });
    }

    if (milestone.status === 'Funded' && isUserPayee) {
      actions.push({
        label: 'Submit Work',
        action: handleSubmitWork,
        requiresWallet: true,
      });
    }

    if (milestone.status === 'WorkSubmitted' && isUserPayer) {
      actions.push({
        label: 'Approve & Release',
        action: handleApproveRelease,
        requiresWallet: true,
      });
    }

    if ((milestone.status === 'Funded' || milestone.status === 'WorkSubmitted') && wallet.connected) {
      actions.push({
        label: 'Raise Dispute',
        action: handleRaiseDispute,
        requiresWallet: true,
      });
    }

    return actions;
  };

  const handleLockFunds = async () => {
    if (!wallet.connected) {
      setActionError('Please connect your wallet');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      // TODO: Implement contract call to lock_funds
      // const result = await invokeContractFunction('lock_funds', {
      //   agreement_id: agreement.agreement_id,
      //   milestone_id: milestone.id,
      // }, wallet);
      console.log('Lock funds action not yet implemented');
      setActionError('Lock funds action not yet implemented');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to lock funds');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitWork = async () => {
    if (!wallet.connected) {
      setActionError('Please connect your wallet');
      return;
    }

    if (!proofUri.trim()) {
      setActionError('Please enter a proof URI');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      // TODO: Implement contract call to submit_work
      // const result = await invokeContractFunction('submit_work', {
      //   agreement_id: agreement.agreement_id,
      //   milestone_id: milestone.id,
      //   proof_uri: proofUri,
      // }, wallet);
      console.log('Submit work action not yet implemented');
      setActionError('Submit work action not yet implemented');
      setShowProofInput(false);
      setProofUri('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to submit work');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRelease = async () => {
    if (!wallet.connected) {
      setActionError('Please connect your wallet');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      // TODO: Implement contract call to approve_and_release
      // const result = await invokeContractFunction('approve_and_release', {
      //   agreement_id: agreement.agreement_id,
      //   milestone_id: milestone.id,
      // }, wallet);
      console.log('Approve and release action not yet implemented');
      setActionError('Approve and release action not yet implemented');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to approve and release');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRaiseDispute = async () => {
    if (!wallet.connected) {
      setActionError('Please connect your wallet');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      // TODO: Implement contract call to raise_dispute
      // const result = await invokeContractFunction('raise_dispute', {
      //   caller: wallet.address,
      //   agreement_id: agreement.agreement_id,
      //   milestone_id: milestone.id,
      // }, wallet);
      console.log('Raise dispute action not yet implemented');
      setActionError('Raise dispute action not yet implemented');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to raise dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const availableActions = getAvailableActions();

  return (
    <tr className="border-b border-navy-700 dark:border-navy-700 light:border-gray-200 hover:bg-navy-700/50 dark:hover:bg-navy-700/50 light:hover:bg-gray-100">
      <td className="py-3 px-4 text-white dark:text-white light:text-gray-900 font-mono text-sm">{milestone.id}</td>
      <td className="py-3 px-4 text-white dark:text-white light:text-gray-900 text-sm">{milestone.amount}</td>
      <td className="py-3 px-4">
        <span
          className={`${getStatusBadgeColor(
            milestone.status
          )} text-white dark:text-white light:text-gray-900 text-xs font-semibold px-2 py-1 rounded`}
        >
          {milestone.status}
        </span>
      </td>
      <td className="py-3 px-4">
        {milestone.proof_uri ? (
          <a
            href={milestone.proof_uri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 dark:text-cyan-400 light:text-cyan-600 hover:text-cyan-300 text-sm"
          >
            View
          </a>
        ) : (
          <span className="text-gray-500 dark:text-gray-500 light:text-gray-600 text-sm">-</span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2 flex-wrap">
          {availableActions.length > 0 ? (
            availableActions.map((action) => (
              <button
                key={action.label}
                onClick={action.action}
                disabled={actionLoading || (action.requiresWallet && !wallet.connected)}
                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-navy-900 font-semibold text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            ))
          ) : (
            <span className="text-gray-500 dark:text-gray-500 light:text-gray-600 text-sm">-</span>
          )}
        </div>

        {milestone.status === 'Funded' && isUserPayee && showProofInput && (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              placeholder="Proof URI (e.g., GitHub PR link)"
              value={proofUri}
              onChange={(e) => setProofUri(e.target.value)}
              className="w-full px-3 py-2 bg-navy-700 dark:bg-navy-700 light:bg-gray-100 border border-navy-600 dark:border-navy-600 light:border-gray-300 text-white dark:text-white light:text-gray-900 text-xs rounded focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => {
                setShowProofInput(false);
                setProofUri('');
              }}
              className="text-xs text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-gray-300 dark:hover:text-gray-300 light:hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {actionError && <p className="mt-2 text-red-400 text-xs">{actionError}</p>}
      </td>
    </tr>
  );
}
