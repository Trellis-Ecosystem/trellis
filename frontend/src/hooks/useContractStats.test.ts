import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nativeToScVal } from '@stellar/stellar-sdk'
import { useContractStats } from './useContractStats'
import {
  AGREEMENT_CREATED_SYMBOL,
  MILESTONE_LOCKED_SYMBOL,
} from '../lib/contractEvents'

function scvSymbol(symbol: string): string {
  return nativeToScVal(symbol, { type: 'symbol' }).toXDR('base64')
}

const CREATED_TOPIC = scvSymbol(AGREEMENT_CREATED_SYMBOL)
const LOCKED_TOPIC = scvSymbol(MILESTONE_LOCKED_SYMBOL)

function makeEvent(topic0: string, id: string) {
  return {
    type: 'contract',
    ledger: 100,
    ledgerClosedAt: '2024-01-01T00:00:00Z',
    contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    id,
    pagingToken: id,
    inSuccessfulContractCall: true,
    topic: [topic0],
    value: nativeToScVal(1, { type: 'u32' }).toXDR('base64'),
  }
}

const getEvents = vi.fn()
const getLatestLedger = vi.fn()

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>()
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn().mockImplementation(() => ({
        getEvents,
        getLatestLedger,
      })),
    },
  }
})

describe('useContractStats', () => {
  beforeEach(() => {
    getEvents.mockReset()
    getLatestLedger.mockReset()
    getLatestLedger.mockResolvedValue({ sequence: 1000 })
    getEvents.mockImplementation(async ({ filters }: { filters: Array<{ topics: string[][] }> }) => {
      const topic0 = filters[0]?.topics?.[0]?.[0]
      if (topic0 === CREATED_TOPIC) {
        return { events: [makeEvent(CREATED_TOPIC, 'created-1')] }
      }
      if (topic0 === LOCKED_TOPIC) {
        return { events: [makeEvent(LOCKED_TOPIC, 'locked-1')] }
      }
      return { events: [] }
    })
  })

  it('queries the real trls_crte/trls_lckd topics and parses stats', async () => {
    const { result } = renderHook(() => useContractStats())

    expect(result.current.status).toBe('loading')
    expect(result.current.stats).toBeNull()

    await waitFor(
      () => {
        expect(result.current.status).toBe('ok')
      },
      { timeout: 3000 }
    )

    expect(result.current.stats).not.toBeNull()
    expect(result.current.stats?.agreements).toBe(1)
    expect(result.current.stats?.milestonesLocked).toBe(1)

    const queriedTopics = getEvents.mock.calls.map(
      (call) => call[0].filters[0].topics[0][0]
    )
    expect(queriedTopics).toContain(CREATED_TOPIC)
    expect(queriedTopics).toContain(LOCKED_TOPIC)
  })

  it('handles RPC errors gracefully', async () => {
    getEvents.mockRejectedValue(new Error('rpc down'))

    const { result } = renderHook(() => useContractStats())

    await waitFor(
      () => {
        expect(['ok', 'error', 'stale']).toContain(result.current.status)
      },
      { timeout: 3000 }
    )
  })
})
