import { explorerLinks, type ExplorerLinkType, truncateExplorerValue } from '../lib/explorer'

interface ExplorerLinkProps {
  type: ExplorerLinkType
  value: string
  label?: string
  className?: string
  showIcon?: boolean
}

const typeLabels: Record<ExplorerLinkType, string> = {
  tx: 'transaction',
  contract: 'contract',
  account: 'account',
}

export function ExplorerLink({
  type,
  value,
  label,
  className = '',
  showIcon = true,
}: ExplorerLinkProps) {
  const href = explorerLinks[type](value)
  const linkText = label ?? truncateExplorerValue(value)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-cyan-400 transition-colors hover:text-cyan-300 hover:underline ${className}`.trim()}
      aria-label={`View ${typeLabels[type]} on Stellar Expert`}
    >
      <span>{linkText}</span>
      {showIcon ? <span aria-hidden="true">↗</span> : null}
    </a>
  )
}