import { createServer } from 'node:http'
import { toRpcEvent } from './ingest.js'

const AGREEMENT_ID_RE = /^[0-9a-f]{64}$/
const HEARTBEAT_MS = 15_000
const MAX_LIMIT = 1000

/**
 * HTTP query API + Server-Sent Events relay.
 *
 *   GET /health                          ingest status
 *   GET /events?agreementId=<hex>        stored history, newest first
 *   GET /stats                           aggregate counts for the landing page
 *   GET /stream/events?agreementId=<hex> SSE: `snapshot`, then `events` deltas
 *   GET /stream/stats                    SSE: `stats` on connect and on change
 *
 * Every browser subscribes here instead of polling Soroban RPC itself; the
 * Ingester polls RPC once and this server fans results out.
 */
export function createIndexerServer({
  store,
  ingester,
  corsOrigin,
  maxClients,
  maxClientsPerIp = 10,
  maxBufferBytes = 1024 * 1024,
  maxLagLedgers = 100,
}) {
  /**
   * Registry of connected SSE clients, keyed by client object so we can look up
   * the remote IP (for per-IP caps) and the response (for backpressure checks).
   * @type {Set<{ res: import('node:http').ServerResponse, ip: string | undefined, agreementId: string | null, stats: boolean }>}
   */
  const clients = new Set()

  const countForIp = (ip) => {
    let n = 0
    for (const client of clients) if (client.ip === ip) n++
    return n
  }

  // Write to a client, disconnecting it if its socket buffer has grown past the
  // limit (slow/stalled consumer). Returns false if the client was dropped.
  const writeTo = (client, chunk) => {
    if (client.dropped) return false
    const { res } = client
    if (res.writableLength > maxBufferBytes) {
      client.drop()
      return false
    }
    res.write(chunk)
    return true
  }

  ingester.on('events', (fresh) => {
    const byAgreement = new Map()
    for (const e of fresh) {
      if (!e.agreementId) continue
      if (!byAgreement.has(e.agreementId)) byAgreement.set(e.agreementId, [])
      byAgreement.get(e.agreementId).push(toRpcEvent(e))
    }
    const stats = store.stats()
    for (const client of [...clients]) {
      if (client.stats) send(client, 'stats', stats)
      const matching = client.agreementId && byAgreement.get(client.agreementId)
      if (matching) send(client, 'events', { events: matching })
    }
  })

  const heartbeat = setInterval(() => {
    for (const client of [...clients]) writeTo(client, ': ping\n\n')
  }, HEARTBEAT_MS)
  heartbeat.unref()

  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin)
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.writeHead(204).end()
      return
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' })

    const url = new URL(req.url ?? '/', 'http://localhost')

    switch (url.pathname) {
      case '/health': {
        const rpcLatestLedger = ingester.rpcLatestLedger ?? 0
        const latestIndexedLedger = store.stats().latestIndexedLedger ?? 0
        const lag = rpcLatestLedger - latestIndexedLedger
        const degraded = Boolean(ingester.lastError)
        const lagging = lag > maxLagLedgers
        return json(res, degraded || lagging ? 503 : 200, {
          status: degraded ? 'degraded' : lagging ? 'lagging' : 'ok',
          lag,
          maxLagLedgers,
          rpcLatestLedger,
          latestIndexedLedger,
          lastPollAt: ingester.lastPollAt,
          lastError: ingester.lastError,
          lastGap: JSON.parse(store.getMeta('last_gap') ?? 'null'),
          clients: clients.size,
          maxClientsPerIp,
        })
      }

      case '/events': {
        const agreementId = parseAgreementId(url)
        if (!agreementId) return json(res, 400, { error: 'agreementId must be 64 hex characters' })
        const limit = Math.min(Number(url.searchParams.get('limit')) || 500, MAX_LIMIT)
        const beforeLedger = Number(url.searchParams.get('beforeLedger')) || undefined
        return json(res, 200, {
          events: store.eventsForAgreement(agreementId, { limit, beforeLedger }),
          latestLedger: ingester.rpcLatestLedger,
        })
      }

      case '/stats':
        return json(res, 200, store.stats())

      case '/stream/events': {
        const agreementId = parseAgreementId(url)
        if (!agreementId) return json(res, 400, { error: 'agreementId must be 64 hex characters' })
        const ip = req.socket.remoteAddress
        if (countForIp(ip) >= maxClientsPerIp) {
          return json(res, 429, { error: 'too many subscribers from this IP' })
        }
        if (clients.size >= maxClients) return json(res, 503, { error: 'too many subscribers' })
        const client = openStream(req, res, clients, { ip, agreementId, stats: false }, maxBufferBytes)
        send(client, 'snapshot', { events: store.eventsForAgreement(agreementId) })
        return
      }

      case '/stream/stats': {
        const ip = req.socket.remoteAddress
        if (countForIp(ip) >= maxClientsPerIp) {
          return json(res, 429, { error: 'too many subscribers from this IP' })
        }
        if (clients.size >= maxClients) return json(res, 503, { error: 'too many subscribers' })
        const client = openStream(req, res, clients, { ip, agreementId: null, stats: true }, maxBufferBytes)
        send(client, 'stats', store.stats())
        return
      }

      default:
        return json(res, 404, { error: 'not found' })
    }
  })

  server.on('close', () => {
    clearInterval(heartbeat)
    for (const { res } of clients) res.end()
    clients.clear()
  })

  // Expose the registry for tests / introspection.
  server.sseClients = clients

  return server
}

function parseAgreementId(url) {
  const id = (url.searchParams.get('agreementId') ?? '').toLowerCase()
  return AGREEMENT_ID_RE.test(id) ? id : null
}

function openStream(req, res, clients, opts, maxBufferBytes) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disable proxy buffering (nginx) so events reach the browser immediately.
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 5000\n\n')
  const client = {
    res,
    ...opts,
    maxBufferBytes,
    dropped: false,
    drop() {
      if (this.dropped) return
      this.dropped = true
      clients.delete(this)
      try {
        this.res.destroy()
      } catch {
        // ignore
      }
    },
  }
  clients.add(client)
  req.on('close', () => clients.delete(client))
  return client
}

function send(client, event, data) {
  if (client.dropped) return
  const { res } = client
  if (res.writableLength > client.maxBufferBytes) {
    client.drop()
    return
  }
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
