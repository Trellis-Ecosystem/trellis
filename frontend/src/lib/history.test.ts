import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addToHistory,
  clearHistory,
  getHistory,
  HISTORY_STORAGE_KEY,
  MAX_ENTRY_AGE_MS,
  MAX_HISTORY_ENTRIES,
  removeFromHistory,
} from './history'

function setRawStorage(data: unknown) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(data))
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('getHistory', () => {
  it('returns an empty array when no history is stored', () => {
    expect(getHistory()).toEqual([])
  })

  it('returns an empty array when stored data is not an array', () => {
    setRawStorage({ foo: 'bar' })
    expect(getHistory()).toEqual([])
  })

  it('returns an empty array when stored JSON is corrupt', () => {
    localStorage.setItem(HISTORY_STORAGE_KEY, '{bad json')
    expect(getHistory()).toEqual([])
  })

  it('filters out entries that do not match the HistoryEntry shape', () => {
    setRawStorage([
      { agreementId: 'abc123', lastViewed: new Date().toISOString() },
      { foo: 'bar' },
      { agreementId: 'def456' }, // missing lastViewed
    ])
    const entries = getHistory()
    expect(entries).toHaveLength(1)
    expect(entries[0].agreementId).toBe('abc123')
  })
})

describe('addToHistory', () => {
  it('adds a new entry at the front of the list', () => {
    addToHistory({ agreementId: 'first', lastViewed: new Date().toISOString() })
    addToHistory({ agreementId: 'second', lastViewed: new Date().toISOString() })

    const entries = getHistory()
    expect(entries).toHaveLength(2)
    expect(entries[0].agreementId).toBe('second')
    expect(entries[1].agreementId).toBe('first')
  })

  it('replaces an existing entry and moves it to the front', () => {
    const now = new Date().toISOString()
    const earlier = new Date(Date.now() - 3600000).toISOString()
    const latest = new Date(Date.now() - 1000).toISOString()
    addToHistory({ agreementId: 'a', lastViewed: earlier })
    addToHistory({ agreementId: 'b', lastViewed: now })
    addToHistory({ agreementId: 'a', lastViewed: latest })

    const entries = getHistory()
    expect(entries).toHaveLength(2)
    expect(entries[0].agreementId).toBe('a')
    expect(entries[0].lastViewed).toBe(latest)
    expect(entries[1].agreementId).toBe('b')
  })

  it('preserves existing label and role when new entry does not supply them', () => {
    const earlier = new Date(Date.now() - 3600000).toISOString()
    const later = new Date().toISOString()
    addToHistory({
      agreementId: 'x',
      lastViewed: earlier,
      label: 'My Agreement',
      role: 'payer',
    })
    addToHistory({ agreementId: 'x', lastViewed: later })

    const entries = getHistory()
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('My Agreement')
    expect(entries[0].role).toBe('payer')
  })

  it('caps entries at MAX_HISTORY_ENTRIES', () => {
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i++) {
      addToHistory({
        agreementId: `id-${i}`,
        lastViewed: new Date().toISOString(),
      })
    }
    const entries = getHistory()
    expect(entries.length).toBeLessThanOrEqual(MAX_HISTORY_ENTRIES)
  })
})

describe('removeFromHistory', () => {
  it('removes an entry by agreementId', () => {
    addToHistory({ agreementId: 'keep', lastViewed: new Date().toISOString() })
    addToHistory({ agreementId: 'remove', lastViewed: new Date().toISOString() })

    removeFromHistory('remove')

    const entries = getHistory()
    expect(entries).toHaveLength(1)
    expect(entries[0].agreementId).toBe('keep')
  })

  it('is a no-op when the agreementId does not exist', () => {
    addToHistory({ agreementId: 'keep', lastViewed: new Date().toISOString() })
    removeFromHistory('nonexistent')

    expect(getHistory()).toHaveLength(1)
  })
})

describe('clearHistory', () => {
  it('removes all entries', () => {
    addToHistory({ agreementId: 'a', lastViewed: new Date().toISOString() })
    addToHistory({ agreementId: 'b', lastViewed: new Date().toISOString() })

    clearHistory()
    expect(getHistory()).toEqual([])
  })

  it('does not throw when history is already empty', () => {
    expect(() => clearHistory()).not.toThrow()
  })
})

describe('auto-eviction', () => {
  it('evicts entries older than MAX_ENTRY_AGE_MS', () => {
    // Insert a stale entry
    const staleDate = new Date(Date.now() - MAX_ENTRY_AGE_MS - 1000).toISOString()
    const freshDate = new Date().toISOString()

    setRawStorage([
      { agreementId: 'stale', lastViewed: staleDate },
      { agreementId: 'fresh', lastViewed: freshDate },
    ])

    const entries = getHistory()
    expect(entries).toHaveLength(1)
    expect(entries[0].agreementId).toBe('fresh')
  })

  it('preserves entries with invalid lastViewed dates instead of silently evicting', () => {
    const freshDate = new Date().toISOString()

    setRawStorage([
      { agreementId: 'invalid-date', lastViewed: 'not-a-valid-date' },
      { agreementId: 'valid-date', lastViewed: freshDate },
    ])

    const entries = getHistory()
    expect(entries).toHaveLength(2)
    expect(entries.some((e) => e.agreementId === 'invalid-date')).toBe(true)
    expect(entries.some((e) => e.agreementId === 'valid-date')).toBe(true)
  })

  it('preserves multiple entries with invalid dates', () => {
    setRawStorage([
      { agreementId: 'invalid-1', lastViewed: 'bad-date-1' },
      { agreementId: 'invalid-2', lastViewed: 'bad-date-2' },
      { agreementId: 'valid', lastViewed: new Date().toISOString() },
    ])

    const entries = getHistory()
    expect(entries).toHaveLength(3)
  })

  it('does not throw when localStorage is full (5 MB limit)', () => {
    const originalSetItem = localStorage.setItem.bind(localStorage)
    localStorage.setItem = () => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError')
    }
    expect(() =>
      addToHistory({ agreementId: 'x', lastViewed: new Date().toISOString() }),
    ).not.toThrow()
    localStorage.setItem = originalSetItem
  })

  it('persists eviction back to localStorage', () => {
    const staleDate = new Date(Date.now() - MAX_ENTRY_AGE_MS - 1000).toISOString()
    const freshDate = new Date().toISOString()

    setRawStorage([
      { agreementId: 'stale', lastViewed: staleDate },
      { agreementId: 'fresh', lastViewed: freshDate },
    ])

    // First read triggers eviction and persists
    getHistory()

    // Second read should reflect the cleaned storage
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].agreementId).toBe('fresh')
  })
})
