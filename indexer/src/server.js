import http from 'node:http';
import { URL } from 'node:url';

/**
 * Create the indexer HTTP server.
 *
 * @param {object} deps
 * @param {object} deps.store   Store instance (see store.js)
 * @param {object} deps.ingest  Ingest instance (see ingest.js)
 * @returns {http.Server}
 */
export function createServer({ store, ingest }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const { pathname } = url;

      if (req.method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'GET' && pathname === '/events') {
        const cursor = url.searchParams.get('cursor');
        const limit = parseLimit(url.searchParams.get('limit'));
        const events = await store.listEvents({ cursor, limit });
        const nextCursor = events.length === limit ? events[events.length - 1].id : null;
        return sendJson(res, 200, { events, nextCursor });
      }

      if (req.method === 'GET' && pathname === '/events/stream') {
        return streamEvents(req, res, store, url.searchParams.get('cursor'));
      }

      if (req.method === 'POST' && pathname === '/ingest') {
        const body = await readJson(req);
        const result = await ingest.ingest(body);
        return sendJson(res, 200, result);
      }

      return sendJson(res, 404, { error: 'not found' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  });
}

function parseLimit(raw) {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(n, 200);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('invalid JSON body'));
      }
    });
  });
}

async function streamEvents(req, res, store, cursor) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  let lastId = cursor ?? null;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
  };

  req.on('close', cleanup);
  res.on('close', cleanup);

  const flush = async () => {
    if (closed) return;
    const events = await store.listEvents({ cursor: lastId, limit: 100 });
    for (const event of events) {
      res.write(`id: ${event.id}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      lastId = event.id;
    }
  };

  await flush();
  const timer = setInterval(() => {
    flush().catch(() => cleanup());
  }, 1000);
}
