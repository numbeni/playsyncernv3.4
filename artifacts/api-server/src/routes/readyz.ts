import { Router, type IRouter, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ReadinessCheckResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * GET /readyz — database readiness check.
 * Distinct from /healthz (process is up) — this confirms the process can
 * actually reach PostgreSQL, so orchestration can distinguish "alive" from
 * "ready to serve traffic".
 */
router.get("/readyz", async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`select 1`);
    const data = ReadinessCheckResponse.parse({
      status: "ok",
      checks: { database: "ok" },
    });
    res.json(data);
  } catch (err) {
    logger.error(err, "GET /readyz — database check failed");
    const data = ReadinessCheckResponse.parse({
      status: "error",
      checks: { database: "error" },
    });
    res.status(503).json(data);
  }
});

export default router;
