import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAgreement } from '../hooks/useAgreement';
import { useMilestoneActions } from '../hooks/useMilestoneActions';
import { MilestoneActions } from '../components/MilestoneActions';
import { formatTokenAmount } from '../lib/format';
import type { Milestone } from '../types';

export function AgreementDetail() {
  const { id } = useParams<{ id: string }>();
  const { agreement, loading, error } = useAgreement(id);
  const { lockMilestone, releaseMilestone, disputeMilestone } = useMilestoneActions();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setActionError(null);
  }, [id]);

  if (loading) {
    return <div className="page-loading">Loading agreement…</div>;
  }

  if (error) {
    return <div className="page-error">Failed to load agreement: {error}</div>;
  }

  if (!agreement) {
    return <div className="page-empty">Agreement not found.</div>;
  }

  const handleLock = async (milestone: Milestone) => {
    try {
      setActionError(null);
      await lockMilestone(agreement.id, milestone.index);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRelease = async (milestone: Milestone) => {
    try {
      setActionError(null);
      await releaseMilestone(agreement.id, milestone.index);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDispute = async (milestone: Milestone) => {
    try {
      setActionError(null);
      await disputeMilestone(agreement.id, milestone.index);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="agreement-detail">
      <div className="agreement-detail__header">
        <Link to="/agreements" className="back-link">
          ← Back to agreements
        </Link>
        <h1>Agreement #{agreement.id}</h1>
      </div>

      <dl className="agreement-detail__meta">
        <dt>Client</dt>
        <dd>{agreement.client}</dd>
        <dt>Freelancer</dt>
        <dd>{agreement.freelancer}</dd>
        <dt>Status</dt>
        <dd>{agreement.status}</dd>
      </dl>

      {actionError && <div className="page-error">{actionError}</div>}

      <ul className="milestone-list">
        {agreement.milestones.map((milestone) => (
          <li key={milestone.index} className="milestone-list__item">
            <div className="milestone-list__info">
              <span className="milestone-list__index">Milestone {milestone.index}</span>
              <span className="milestone-list__amount">
                {formatTokenAmount(milestone.amount)} tokens
              </span>
              <span className="milestone-list__status">{milestone.status}</span>
            </div>
            <MilestoneActions
              milestone={milestone}
              onLock={handleLock}
              onRelease={handleRelease}
              onDispute={handleDispute}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
