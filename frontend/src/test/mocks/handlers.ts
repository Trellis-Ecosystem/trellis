import { http, HttpResponse } from 'msw'

const RPC_URL = 'https://soroban-testnet.stellar.org'

const mockEvents = [
  {
    type: 'contract',
    ledger: 100,
    ledgerClosedAt: '2024-01-01T00:00:00Z',
    contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    id: '0000000100-0000000001',
    pagingToken: '0000000100-0000000001',
    inSuccessfulContractCall: true,
    txHash: 'abc123',
    topic: [],
    value: {},
  },
]

export const handlers = [
  http.post(RPC_URL, async ({ request }) => {
    const body = (await request.json()) as {
      method: string
      params?: {
        filters?: Array<{ topics?: string[][] }>
      }
    }

    if (body.method === 'getEvents') {
      const filters = body.params?.filters ?? []
      const topicFilter = filters[0]?.topics

      const events = topicFilter
        ? mockEvents.filter((event) =>
            topicFilter.every((segment, index) => {
              if (segment[0] === '*') return true
              return segment[0] === event.topic[index]
            }),
          )
        : mockEvents

      return HttpResponse.json({
        jsonrpc: '2.0',
        id: 1,
        result: { events, latestLedger: 100 },
      })
    }

    return HttpResponse.json({
      jsonrpc: '2.0',
      id: 1,
      result: {},
    })
  }),
]
