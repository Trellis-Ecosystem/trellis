import { useState, useCallback } from 'react';
import { submitMilestoneWork, approveMilestoneWork } from '../lib/contracts';
import { getStatusColor } from '../lib/statusColors';

export type MilestoneStatus = 'Pending' | 'WorkSubmitted' | 'Completed' | 'Disputed';

// Re-export the shared status-colour helper so consumers keep a single map.
export { getStatusColor };

export function useMilestoneActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitWork = useCallback(async (agreementId: string, milestoneId: string) => {
    setLoading(true);
    setError(null);
    try {
      await submitMilestoneWork(agreementId, milestoneId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit work');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const approveWork = useCallback(async (agreementId: string, milestoneId: string) => {
    setLoading(true);
    setError(null);
    try {
      await approveMilestoneWork(agreementId, milestoneId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve work');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submitWork, approveWork, loading, error };
}
