import express from "express";
import { DatabaseSync } from "node:sqlite";

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 500;

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  const truncated = Math.trunc(n);
  if (truncated < 1) return 1;
  if (truncated > MAX_LIMIT) return MAX_LIMIT;
  return truncated;
}

export function createApp(db: DatabaseSync): express.Express {
  const app = express();

  app.get("/events", (req, res) => {
    const limit = parseLimit(req.query.limit);
    const agreement = req.query.agreement;

    const rows = agreement
      ? db
          .prepare(
            "SELECT * FROM events WHERE agreement = ? ORDER BY id DESC LIMIT ?"
          )
          .all(String(agreement), limit)
      : db
          .prepare("SELECT * FROM events ORDER BY id DESC LIMIT ?")
          .all(limit);

    res.json({ events: rows, limit });
  });

  return app;
}
