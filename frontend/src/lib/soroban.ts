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

// RPC Response types for type-safe parsing
export interface RawMilestone {
  amount?: { toString: () => string } | string;
  status?: unknown;
  proof_uri?: string;
}

export interface RawAgreementResponse {
  payer?: string;
  payee?: string;
  token?: string;
  dispute_resolver?: string;
  milestones?: RawMilestone[];
}

export interface RawEventResponse {
  ledger?: number;
  txHash?: string;
  ledgerClosedAt?: string;
  topic?: string[];
  value?: { xdr?: string };
}

// Type guards and validators
export function isValidAgreementResponse(data: unknown): data is RawAgreementResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    (typeof obj.payer === 'string' || obj.payer === undefined) &&
    (typeof obj.payee === 'string' || obj.payee === undefined) &&
    (typeof obj.token === 'string' || obj.token === undefined) &&
    (typeof obj.dispute_resolver === 'string' || obj.dispute_resolver === undefined) &&
    (Array.isArray(obj.milestones) || obj.milestones === undefined)
  );
}

export function isValidEventResponse(data: unknown): data is RawEventResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    (typeof obj.ledger === 'number' || obj.ledger === undefined) &&
    (typeof obj.txHash === 'string' || obj.txHash === undefined) &&
    (typeof obj.ledgerClosedAt === 'string' || obj.ledgerClosedAt === undefined) &&
    (Array.isArray(obj.topic) || obj.topic === undefined)
  );
}

export function parseEscrowStatus(statusValue: unknown): EscrowStatus {
  if (typeof statusValue === 'string') {
    const validStatuses: EscrowStatus[] = ['Pending', 'Funded', 'WorkSubmitted', 'Completed', 'Disputed', 'Refunded'];
    if (validStatuses.includes(statusValue as EscrowStatus)) {
      return statusValue as EscrowStatus;
    }
  }

  if (typeof statusValue === 'object' && statusValue !== null) {
    const keys = Object.keys(statusValue);
    if (keys.length > 0 && typeof keys[0] === 'string') {
      const status = keys[0];
      const validStatuses: EscrowStatus[] = ['Pending', 'Funded', 'WorkSubmitted', 'Completed', 'Disputed', 'Refunded'];
      if (validStatuses.includes(status as EscrowStatus)) {
        return status as EscrowStatus;
      }
    }
  }

  return 'Pending';
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
