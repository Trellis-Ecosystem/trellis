import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function clampLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  const floored = Math.floor(parsed);
  if (floored < 1) {
    return 1;
  }
  if (floored > MAX_LIMIT) {
    return MAX_LIMIT;
  }
  return floored;
}

router.get('/events', (req: Request, res: Response) => {
  const limit = clampLimit(req.query.limit);
  const agreementId = req.query.agreementId;

  const db = getDb();

  let rows;
  if (agreementId !== undefined) {
    rows = db
      .prepare(
        'SELECT * FROM events WHERE agreement_id = ? ORDER BY id DESC LIMIT ?'
      )
      .all(String(agreementId), limit);
  } else {
    rows = db
      .prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?')
      .all(limit);
  }

  res.json({ events: rows, limit });
});

export default router;
