import { useState } from 'react';
import { useMilestoneActions } from '../hooks/useMilestoneActions';
import { formatTokenAmount } from '../lib/format';
import type { Milestone } from '../types';

interface MilestoneActionsProps {
  agreementId: string;
  milestone: Milestone;
  index: number;
}

export function MilestoneActions({ agreementId, milestone, index }: MilestoneActionsProps) {
  const { lock, release, refund, pending, error } = useMilestoneActions(agreementId);
  const [confirming, setConfirming] = useState<null | 'lock' | 'release' | 'refund'>(null);

  const formattedAmount = formatTokenAmount(milestone.amount);

  const run = async (action: 'lock' | 'release' | 'refund') => {
    setConfirming(null);
    if (action === 'lock') await lock(milestone, index);
    else if (action === 'release') await release(milestone, index);
    else await refund(milestone, index);
  };

  const confirmationText = (action: 'lock' | 'release' | 'refund') => {
    switch (action) {
      case 'lock':
        return `Lock ${formattedAmount} tokens for milestone ${index}?`;
      case 'release':
        return `Release ${formattedAmount} tokens for milestone ${index}?`;
      case 'refund':
        return `Refund ${formattedAmount} tokens for milestone ${index}?`;
    }
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming('lock')}
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Lock
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming('release')}
          className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Release
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming('refund')}
          className="rounded bg-rose-600 px-3 py-1 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
        >
          Refund
        </button>
      </div>

      {confirming && (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{confirmationText(confirming)}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(confirming)}
              className="rounded bg-amber-600 px-3 py-1 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(null)}
              className="rounded border border-amber-400 px-3 py-1 text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
