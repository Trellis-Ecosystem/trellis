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
  if (elapsed < 0) return 'just now'
  for (const [unit, ms] of UNITS) {
    if (elapsed >= ms) {
      return rtf.format(-Math.round(elapsed / ms), unit)
    }
  }
  return 'just now'
}
