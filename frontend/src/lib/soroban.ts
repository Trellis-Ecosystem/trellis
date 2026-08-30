/**
 * Shared domain types for the Trellis escrow contract.
 *
 * Runtime contract calls are performed via the hooks in `hooks/useContractRead.ts`
 * and `hooks/useContractInvoke.ts`.  No stub servers or mock functions live here.
 */

export interface Agreement {
  agreement_id: string;
  payer: string;
  payee: string;
  token: string;
  dispute_resolver: string;
  milestones: Milestone[];
}

export interface Milestone {
  id?: number;
  amount: string;
  status: EscrowStatus;
  proof_uri: string;
}

export type EscrowStatus =
  | 'Pending'
  | 'Funded'
  | 'WorkSubmitted'
  | 'Completed'
  | 'Disputed'
  | 'Refunded';

export interface SorobanEvent {
  type: string;
  ledger: number;
  txHash: string;
  timestamp: number;
  data: Record<string, unknown>;
}
