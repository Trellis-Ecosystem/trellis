import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { useMilestoneActions } from '../hooks/useMilestoneActions';
import { getAgreement, Agreement, Milestone } from '../lib/contracts';
import { formatTokenAmount } from '../lib/format';
import { MilestoneActions } from './MilestoneActions';
import { ExplorerLink } from './ExplorerLink';
import { getStatusColor } from '../lib/statusColors';

type AgreementStatus = 'Active' | 'WorkSubmitted' | 'Completed' | 'Disputed' | 'Cancelled';

function statusLabel(status: AgreementStatus): string {
  switch (status) {
    case 'WorkSubmitted':
      return 'Work Submitted';
    default:
      return status;
  }
}

export function AgreementDetail() {
  const { id } = useParams<{ id: string }>();
  const { address } = useWallet();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { submitWork, approveWork, loading: actionLoading } = useMilestoneActions();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getAgreement(id);
        if (!cancelled) setAgreement(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load agreement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <div className="p-6 text-gray-600 dark:text-gray-300">Loading agreement…</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600 dark:text-red-400">{error}</div>;
  }

  if (!agreement) {
    return <div className="p-6 text-gray-600 dark:text-gray-300">Agreement not found.</div>;
  }

  const status = agreement.status as AgreementStatus;
  const isClient = address && agreement.client.toLowerCase() === address.toLowerCase();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Agreement #{agreement.id}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Client: <ExplorerLink address={agreement.client} />
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(status)}`}
        >
          {statusLabel(status)}
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Milestones</h2>
        <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700">
          {agreement.milestones.map((milestone: Milestone) => (
            <li key={milestone.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {milestone.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTokenAmount(milestone.amount)} tokens
                </p>
              </div>
              <MilestoneActions
                milestone={milestone}
                isClient={Boolean(isClient)}
                disabled={actionLoading}
                onSubmitWork={() => submitWork(agreement.id, milestone.id)}
                onApproveWork={() => approveWork(agreement.id, milestone.id)}
              />
            </li>
          ))}
        </ul>
      </div>

      <Link
        to="/agreements"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        ← Back to agreements
      </Link>
    </div>
  );
}
