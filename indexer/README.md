# Trellis Event Indexer & Relay

A small Node service that does two jobs for the frontend:

1. **Indexer (#496).** Polls Soroban RPC `getEvents` for the Trellis contract
   and stores every event in SQLite, so agreement history survives past the
   RPC node's retention window (~7 days on public testnet nodes).
2. **Relay (#495).** Pushes new events to browsers over Server-Sent Events.
   RPC is polled once, by the server, however many tabs are open, instead of
   once per tab.

It has no npm dependencies. It uses Node's built-in `node:sqlite`, which needs
**Node 22.13 or newer**.

## Running

```bash
cd indexer
cp .env.example .env        # then edit RPC_URL / CONTRACT_ID as needed
set -a; . ./.env; set +a
npm start
```

Point the frontend at it by setting `VITE_INDEXER_URL=http://localhost:8787`
in `frontend/.env`. If that variable is unset, or the service can't be
reached, the frontend polls RPC directly as it did before.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `RPC_URL` | — (required) | Soroban RPC endpoint to poll |
| `CONTRACT_ID` | — (required) | Contract whose events are indexed |
| `DB_PATH` | `./data/trellis-events.db` | SQLite file (one per contract) |
| `PORT` | `8787` | HTTP port |
| `POLL_INTERVAL_MS` | `5000` | Delay between `getEvents` polls |
| `CORS_ORIGIN` | `*` | `Access-Control-Allow-Origin` value |
| `MAX_SSE_CLIENTS` | `1000` | Cap on concurrent stream subscribers (global) |
| `MAX_SSE_CLIENTS_PER_IP` | `10` | Cap on concurrent stream subscribers per IP; excess connections get `429` |
| `MAX_SSE_BUFFER_BYTES` | `1048576` | Max buffered bytes per SSE client; slow clients exceeding this are disconnected |
| `START_LEDGER` | node's `oldestLedger` | First ledger to ingest on an empty database |
| `MAX_LAG_LEDGERS` | `100` | Maximum allowed gap between `rpcLatestLedger` and `latestIndexedLedger` before `/health` reports degraded |

## API

| Endpoint | Response |
|---|---|
| `GET /health` | Ingest status: last poll, last error, RPC vs. indexed ledger, current lag (`rpcLatestLedger - latestIndexedLedger`), last retention gap, number of connected clients. Returns `200` when healthy, `503` when degraded (e.g. recent poll error) or when lag exceeds `MAX_LAG_LEDGERS` |
| `GET /events?agreementId=<64 hex>[&limit=&beforeLedger=]` | `{ events }`: stored events for one agreement, newest first, in the same shape RPC `getEvents` returns |
| `GET /stats` | `{ agreements, milestonesLocked, latestIndexedLedger }` |
| `GET /stream/events?agreementId=<64 hex>` | SSE: one `snapshot` event (full history), then an `events` event for each new batch |
| `GET /stream/stats` | SSE: a `stats` event on connect and whenever newly indexed events arrive |

The `/stream/*` endpoints return `429` when the requesting IP already has
`MAX_SSE_CLIENTS_PER_IP` open streams, and `503` when the global
`MAX_SSE_CLIENTS` cap is reached.

See [DEPLOYMENT.md](../DEPLOYMENT.md#event-indexer--real-time-relay) for
production deployment and the data-retention model.
