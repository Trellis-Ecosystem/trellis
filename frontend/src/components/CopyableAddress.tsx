import { useCopyToClipboard } from '../hooks/useCopyToClipboard'

interface CopyableAddressProps {
  address: string
  truncate?: boolean
  showFull?: boolean
  className?: string
}

function ClipboardIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function CopyableAddress({
  address,
  truncate = true,
  showFull = false,
  className = '',
}: CopyableAddressProps) {
  const { copied, copy } = useCopyToClipboard()
  const displayAddress = showFull || !truncate ? address : truncateAddress(address)

  const handleCopy = () => {
    void copy(address)
  }

  return (
    <span
      className={`inline-flex items-center gap-2 align-middle font-mono ${className}`}
      title={address}
    >
      <span>{displayAddress}</span>
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-cyan-400 transition-colors hover:bg-cyan-400/10 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
        onClick={handleCopy}
        aria-label={copied ? 'Address copied' : 'Copy full address'}
        title={copied ? 'Copied' : `Copy ${address}`}
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </button>
    </span>
  )
}

export default CopyableAddress
