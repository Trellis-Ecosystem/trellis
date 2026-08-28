/** Shorten a 64-character hex agreement ID to `first 8…last 6`. */
export function truncateAgreementId(id: string): string {
  if (id.length <= 16) return id
  return `${id.slice(0, 8)}…${id.slice(-6)}`
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** Render an ISO timestamp as relative time, e.g. "2 hours ago". */
export function formatRelativeTime(isoTimestamp: string, now: number = Date.now()): string {
  const timestamp = new Date(isoTimestamp).getTime()
  if (Number.isNaN(timestamp)) return 'unknown'

  const elapsed = now - timestamp
  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return rtf.format(-Math.round(elapsed / ms), unit)
    }
  }
  return 'just now'
}

/**
 * Decode a hex string into a Uint8Array without relying on Node.js Buffer.
 *
 * This is a browser-safe replacement for `Buffer.from(hex, 'hex')`.
 * It is intentionally strict: the string must consist of an even number of
 * hexadecimal characters (0-9 / a-f / A-F).
 *
 * @throws {Error} If `hex` contains non-hex characters or has an odd length.
 *
 * @example
 * hexToBytes('deadbeef') // Uint8Array [0xde, 0xad, 0xbe, 0xef]
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`hexToBytes: expected even-length hex string, got length ${hex.length}`)
  }
  if (hex.length > 0 && !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('hexToBytes: input contains non-hexadecimal characters')
  }

  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
