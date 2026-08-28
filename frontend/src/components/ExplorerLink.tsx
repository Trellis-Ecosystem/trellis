import type { ReactNode } from 'react'
import {
  explorerUrl,
  networkLabel,
  truncateId,
  type ExplorerEntity,
  type StellarNetwork,
} from '../lib/explorer'

interface ExplorerLinkProps {
  /** Which kind of on-chain record `value` identifies. */
  type: ExplorerEntity
  /** The raw identifier — tx hash, contract ID, account address, ledger seq. */
  value: string | null | undefined
  /** Override the visible text. Defaults to a truncated form of `value`. */
  label?: ReactNode
  /** Show the full identifier instead of the `ABCD…WXYZ` short form. */
  full?: boolean
  /** Explorer network. Defaults to the network Trellis is configured for. */
  network?: StellarNetwork
  className?: string
}

const ENTITY_NOUN: Record<ExplorerEntity, string> = {
  tx: 'transaction',
  op: 'operation',
  account: 'account',
  contract: 'contract',
  ledger: 'ledger',
  asset: 'asset',
  agreement: 'agreement',
}

/**
 * Renders an on-chain identifier as a link to its Stellar Expert record.
 *
 * Renders `null` for a missing or blank `value` so callers can pass through
 * optional data (an unconfirmed tx hash, an unset resolver) without guarding
 * at every call site — an absent identifier shows nothing rather than a link
 * that 404s on the explorer.
 */
export function ExplorerLink({
  type,
  value,
  label,
  full = false,
  network,
  className = '',
}: ExplorerLinkProps) {
  const href = explorerUrl(type, value, network)
  if (!href || !value) return null

  const id = value.trim()

  return (
    <a
      href={href}
      target="_blank"
      // noreferrer alongside noopener: the explorer never needs to know which
      // Trellis screen the user came from.
      rel="noopener noreferrer"
      title={`View ${ENTITY_NOUN[type]} ${id} on Stellar Expert (${networkLabel(network)})`}
      data-testid="explorer-link"
      className={`inline-flex items-center gap-1 font-mono text-cyan-400 underline decoration-cyan-400/40 underline-offset-2 transition-colors hover:text-cyan-300 hover:decoration-cyan-300 ${className}`}
    >
      <span>{label ?? (full ? id : truncateId(id))}</span>
      <ExternalLinkIcon />
    </a>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 shrink-0 opacity-70"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  )
}

export default ExplorerLink
