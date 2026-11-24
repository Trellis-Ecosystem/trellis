import React from 'react';
import { ExternalLink } from 'lucide-react';

interface ExplorerLinkProps {
  /** The hash or address to link to */
  value: string;
  /** The type of explorer link */
  type?: 'tx' | 'account' | 'ledger' | 'contract';
  /** Optional custom label; defaults to a truncated value */
  label?: string;
  /** Optional additional CSS classes */
  className?: string;
  /** Whether to show the external link icon */
  showIcon?: boolean;
}

const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer/public';

const TYPE_PATHS: Record<NonNullable<ExplorerLinkProps['type']>, string> = {
  tx: 'tx',
  account: 'account',
  ledger: 'ledger',
  contract: 'contract',
};

function truncate(value: string, head = 6, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Renders a link to Stellar Expert for a given on-chain value.
 */
export const ExplorerLink: React.FC<ExplorerLinkProps> = ({
  value,
  type = 'tx',
  label,
  className = '',
  showIcon = true,
}) => {
  const href = `${STELLAR_EXPERT_BASE}/${TYPE_PATHS[type]}/${value}`;
  const display = label ?? truncate(value);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-cyan-400 light:text-cyan-700 hover:underline ${className}`}
      title={value}
    >
      <span className="font-mono">{display}</span>
      {showIcon && <ExternalLink className="h-3 w-3" aria-hidden="true" />}
    </a>
  );
};

export default ExplorerLink;
