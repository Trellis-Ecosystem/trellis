export interface Agreement {
  agreement_id: string;
  payer: string;
  payee: string;
  token: string;
  dispute_resolver: string;
  milestones: Milestone[];
}

export interface Milestone {
  amount: string;
  status: EscrowStatus;
  proof_uri: string;
}

export type EscrowStatus = 'Pending' | 'Funded' | 'WorkSubmitted' | 'Completed' | 'Disputed' | 'Refunded';

export interface SorobanEvent {
  type: string;
  ledger: number;
  txHash: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export const sorobanServer = {
  getEvents: async (_options?: unknown) => {
    return { events: [] };
  },
};

export async function getAgreement(agreementId: string): Promise<Agreement> {
  throw new Error(
    `Agreement query not yet fully implemented. Agreement ID: ${agreementId}. Use CLI: trellis status --agreement-id ${agreementId}`
  );
}

export async function getAgreementEvents(): Promise<SorobanEvent[]> {
  return [];
}
