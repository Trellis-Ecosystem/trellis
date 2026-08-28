import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './format'

describe('formatRelativeTime', () => {
  const NOW = new Date('2024-06-01T12:00:00Z').getTime()

  it('returns "just now" for the current moment', () => {
    expect(formatRelativeTime(new Date(NOW).toISOString(), NOW)).toBe('just now')
  })

  it('returns "just now" for timestamps slightly in the past (under 1 minute)', () => {
    const ts = new Date(NOW - 30_000).toISOString()
    expect(formatRelativeTime(ts, NOW)).toBe('just now')
  })

  it('returns a past relative string for old timestamps', () => {
    const ts = new Date(NOW - 2 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(ts, NOW)).toMatch(/2 hours ago/)
  })

  it('returns "just now" for a timestamp 1 ms in the future', () => {
    const ts = new Date(NOW + 1).toISOString()
    expect(formatRelativeTime(ts, NOW)).toBe('just now')
  })

  it('returns "just now" for a timestamp 1 second in the future', () => {
    const ts = new Date(NOW + 1_000).toISOString()
    expect(formatRelativeTime(ts, NOW)).toBe('just now')
  })

  it('returns "just now" for a timestamp 1 hour in the future', () => {
    const ts = new Date(NOW + 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(ts, NOW)).toBe('just now')
  })

  it('returns "just now" for a far-future timestamp (years ahead)', () => {
    const ts = new Date(NOW + 5 * 365 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(ts, NOW)).toBe('just now')
  })

  it('returns "unknown" for an invalid timestamp', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('unknown')
  })
})
