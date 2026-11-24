import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db';

const MAX_LIMIT = 1000;

async function seedEvents(agreementId: string, count: number) {
  const insert = db.prepare(
    'INSERT INTO events (agreement_id, event_type, payload, created_at) VALUES (?, ?, ?, ?)'
  );
  const tx = db.transaction((n: number) => {
    for (let i = 0; i < n; i++) {
      insert.run(agreementId, 'test', JSON.stringify({ i }), new Date().toISOString());
    }
  });
  tx(count);
}

describe('GET /events limit clamping', () => {
  const app = createApp();
  const agreementId = 'clamp-test-agreement';

  beforeAll(async () => {
    await seedEvents(agreementId, MAX_LIMIT + 50);
  });

  afterAll(() => {
    db.prepare('DELETE FROM events WHERE agreement_id = ?').run(agreementId);
  });

  it.each([
    ['-1', -1],
    ['0', 0],
    ['abc', NaN],
    ['5000', 5000],
  ])('limit=%s returns at most MAX_LIMIT rows', async (raw) => {
    const res = await request(app).get('/events').query({ agreementId, limit: raw });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(MAX_LIMIT);
  });

  it('limit=-1 does not dump the entire history', async () => {
    const res = await request(app).get('/events').query({ agreementId, limit: '-1' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(MAX_LIMIT);
    expect(res.body.length).toBeLessThan(MAX_LIMIT + 50);
  });
});
