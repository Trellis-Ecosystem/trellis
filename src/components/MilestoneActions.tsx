import { useState } from 'react';
import { useMilestoneActions } from '../hooks/useMilestoneActions';
import { getStatusColor } from '../utils/statusColors';
import type { Milestone } from '../types';

interface MilestoneActionsProps {
  milestone: Milestone;
  onActionComplete?: () => void;
}

export function MilestoneActions({ milestone, onActionComplete }: MilestoneActionsProps) {
  const { approveMilestone, rejectMilestone, releaseFunds, isLoading, error } = useMilestoneActions();
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
      onActionComplete?.();
    } catch {
      // error surfaced via hook state
    }
  };

  const statusClasses = getStatusColor(milestone.status);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses}`}
        >
          {milestone.status}
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {milestone.status === 'Pending' && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleAction(() => approveMilestone(milestone.id))}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>
        )}

        {milestone.status === 'Submitted' && (
          <>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleAction(() => approveMilestone(milestone.id))}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleAction(() => rejectMilestone(milestone.id))}
              className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}

        {milestone.status === 'Approved' && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleAction(() => releaseFunds(milestone.id))}
            className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
          >
            Release Funds
          </button>
        )}

        {milestone.status === 'Completed' && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setConfirming('release')}
            className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50"
          >
            Release Funds
          </button>
        )}
      </div>

      {confirming === 'release' && (
        <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
            Release funds for this milestone?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setConfirming(null);
                handleAction(() => releaseFunds(milestone.id));
              }}
              className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
