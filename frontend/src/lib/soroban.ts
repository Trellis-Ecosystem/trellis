import { Account, Contract, TransactionBuilder, nativeToScVal, scValToNative, rpc, xdr } from '@stellar/stellar-sdk';
import { CONTRACT_ID, RPC_URL, NETWORK_PASSPHRASE } from './config';

export interface Agreement {
  agreement_id: string;
  payer: string;
  payee: string;
  token: string;
  dispute_resolver: string;
  milestones: Milestone[];
}

export interface Milestone {
  id: number;
  amount: string;
  status: EscrowStatus;
  proof_uri: string | null;
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

// Soroban RPC requires a signed-looking source account even for a read-only
// simulation; this well-known all-zero-signature address never needs a real
// key since the transaction is simulated, never submitted.
const READ_ONLY_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function rpcServer(): rpc.Server {
  return new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
}

/** Converts a 64-char hex string (a `BytesN<32>` agreement ID) to an XDR ScVal. */
export function agreementIdToScVal(hex: string): xdr.ScVal {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return nativeToScVal(bytes, { type: 'bytes' });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Encodes one milestone as the XDR map the contract's `Milestone` struct expects. */
export function milestoneToScVal(m: { id: number; amount: string; status: EscrowStatus; proof_uri?: string | null }): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('amount'),
      val: nativeToScVal(BigInt(m.amount), { type: 'i128' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('id'),
      val: nativeToScVal(m.id, { type: 'u32' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('proof_uri'),
      val: m.proof_uri ? xdr.ScVal.scvVec([nativeToScVal(m.proof_uri, { type: 'string' })]) : xdr.ScVal.scvVoid(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('status'),
      val: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(m.status)]),
    }),
  ]);
}

interface RawMilestone {
  id: number;
  amount: bigint;
  status: [EscrowStatus];
  proof_uri: string | null;
}

interface RawAgreement {
  agreement_id: Uint8Array;
  payer: string;
  payee: string;
  token: string;
  dispute_resolver: string;
  milestones: RawMilestone[];
}

async function simulateRead<T>(method: string, args: xdr.ScVal[]): Promise<T> {
  const server = rpcServer();
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(new Account(READ_ONLY_SOURCE, '0'), {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(simulated.error);
  }
  if (!simulated.result) {
    throw new Error(`No result returned for ${method}`);
  }

  return scValToNative(simulated.result.retval) as T;
}

/** Reads a full `Agreement` from the contract by its 64-char hex ID. */
export async function getAgreement(agreementId: string): Promise<Agreement> {
  const raw = await simulateRead<RawAgreement>('get_agreement', [agreementIdToScVal(agreementId)]);

  return {
    agreement_id: bytesToHex(raw.agreement_id),
    payer: raw.payer,
    payee: raw.payee,
    token: raw.token,
    dispute_resolver: raw.dispute_resolver,
    milestones: raw.milestones.map((m) => ({
      id: m.id,
      amount: m.amount.toString(),
      status: m.status[0],
      proof_uri: m.proof_uri ?? null,
    })),
  };
}

export async function getAgreementEvents(): Promise<SorobanEvent[]> {
  return [];
}
