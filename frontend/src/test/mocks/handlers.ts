import { http, HttpResponse } from 'msw'
import { nativeToScVal } from '@stellar/stellar-sdk'
import {
  AGREEMENT_CREATED_SYMBOL,
  MILESTONE_LOCKED_SYMBOL,
} from '../../lib/contractEvents'

const RPC_URL = 'https://soroban-testnet.stellar.org'

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

export const handlers = [
  http.post(RPC_URL, async ({ request }) => {
    const body = (await request.json()) as {
      method?: string
      params?: { filters?: Array<{ topics?: string[][] }> }
    }

    if (body.method === 'getLatestLedger') {
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: 1,
        result: { sequence: 1000, protocolVersion: 21 },
      })
    }

    if (body.method === 'getEvents') {
      const topics = body.params?.filters?.[0]?.topics?.[0] ?? []
      const topic0 = topics[0]

      let events: ReturnType<typeof makeEvent>[] = []
      if (topic0 === CREATED_TOPIC) {
        events = [makeEvent(CREATED_TOPIC, 'created-1')]
      } else if (topic0 === LOCKED_TOPIC) {
        events = [makeEvent(LOCKED_TOPIC, 'locked-1')]
      }

      return HttpResponse.json({
        jsonrpc: '2.0',
        id: 1,
        result: { events, latestLedger: 1000 },
      })
    }

    return HttpResponse.json({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    })
  }),
]
