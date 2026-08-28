import { NETWORK_PASSPHRASE } from './config'

// ---------------------------------------------------------------------------
// Stellar Expert deep links
//
// Every on-chain identifier surfaced by Trellis — transaction hashes, contract
// IDs, account addresses — should be one click away from its canonical record
// on the public block explorer.  Trust in a trustless system comes from
// verifiability: users must never have to take the UI's word for what happened.
// ---------------------------------------------------------------------------

/** Networks Stellar Expert serves under `/explorer/<network>`. */
export type StellarNetwork = 'public' | 'testnet'

/**
 * Entity segments in a Stellar Expert URL path.
 * "agreement" is a Trellis-internal hex ID — Stellar Expert has no page for it,
 * so explorerUrl returns null and ExplorerLink renders nothing (no 404 link).
 */
export type ExplorerEntity = 'tx' | 'op' | 'account' | 'contract' | 'ledger' | 'asset' | 'agreement'

export const STELLAR_EXPERT_ORIGIN = 'https://stellar.expert'

export const PUBLIC_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
export const TESTNET_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'

/**
 * Map a network passphrase to the Stellar Expert network segment.
 *
 * Only the pubnet passphrase resolves to `public`; everything else (testnet,
 * futurenet, standalone, or a missing/misconfigured value) falls back to
 * `testnet`, which is where Trellis is deployed today.  Falling back is
 * deliberate — a wrong-network link is recoverable, a crash on a missing env
 * var is not.
 */
export function networkFromPassphrase(passphrase?: string | null): StellarNetwork {
  return passphrase?.trim() === PUBLIC_NETWORK_PASSPHRASE ? 'public' : 'testnet'
}

/** The network Trellis is currently pointed at, derived from `VITE_NETWORK_PASSPHRASE`. */
export const ACTIVE_NETWORK: StellarNetwork = networkFromPassphrase(NETWORK_PASSPHRASE)

/** Explorer root for `network`, e.g. `https://stellar.expert/explorer/testnet`. */
export function explorerBaseUrl(network: StellarNetwork = ACTIVE_NETWORK): string {
  return `${STELLAR_EXPERT_ORIGIN}/explorer/${network}`
}

/**
 * Build a Stellar Expert URL for any on-chain entity.
 *
 * Returns `null` — rather than a link to a broken page — when `value` is
 * missing or blank, so callers can render nothing instead of a dead link.
 */
export function explorerUrl(
  entity: ExplorerEntity,
  value: string | null | undefined,
  network: StellarNetwork = ACTIVE_NETWORK,
): string | null {
  if (entity === 'agreement') return null
  const id = value?.trim()
  if (!id) return null
  return `${explorerBaseUrl(network)}/${entity}/${encodeURIComponent(id)}`
}

/** Deep link to a transaction by hash. */
export function txUrl(hash: string | null | undefined, network?: StellarNetwork) {
  return explorerUrl('tx', hash, network)
}

/** Deep link to a Soroban contract by contract ID (`C…`). */
export function contractUrl(contractId: string | null | undefined, network?: StellarNetwork) {
  return explorerUrl('contract', contractId, network)
}

/** Deep link to an account by public key (`G…`). */
export function accountUrl(address: string | null | undefined, network?: StellarNetwork) {
  return explorerUrl('account', address, network)
}

/** Deep link to a ledger by sequence number. */
export function ledgerUrl(sequence: number | string | null | undefined, network?: StellarNetwork) {
  return explorerUrl('ledger', sequence == null ? null : String(sequence), network)
}

/** Deep link to an asset, identified as `CODE-ISSUER`. */
export function assetUrl(asset: string | null | undefined, network?: StellarNetwork) {
  return explorerUrl('asset', asset, network)
}

/**
 * Shorten a long on-chain identifier for display as `ABCD…WXYZ`.
 *
 * Values already shorter than the elided form are returned untouched, so short
 * strings never grow an ellipsis that hides nothing.
 */
export function truncateId(value: string, lead = 4, tail = 4): string {
  const id = value?.trim() ?? ''
  if (id.length <= lead + tail + 1) return id
  return `${id.slice(0, lead)}…${id.slice(-tail)}`
}

/** Human-readable network label for badges and tooltips. */
export function networkLabel(network: StellarNetwork = ACTIVE_NETWORK): string {
  return network === 'public' ? 'Mainnet' : 'Testnet'
}
