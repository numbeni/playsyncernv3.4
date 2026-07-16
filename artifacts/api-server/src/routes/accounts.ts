import { Router, type IRouter, type Request, type Response } from "express";
import { db, gamesTable, accountsTable } from "@workspace/db";
import { eq, isNull, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import { p } from "../lib/req-param";
import { toSafeAccount } from "../lib/dto";
import { requireUuidParam } from "../lib/validate-uuid";

const router: IRouter = Router();

// Malformed UUID route params fail fast with HTTP 400 instead of reaching the DB.
router.param("gameId", requireUuidParam("gameId"));
router.param("id", requireUuidParam("id"));

const ACCOUNT_OPS_DISABLED = "Account operations are not authorized";

/** GET /games/:gameId/accounts — list non-secret account summaries for a game */
router.get("/games/:gameId/accounts", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.gameId, p(req.params["gameId"])),
          isNull(accountsTable.deletedAt),
        ),
      )
      .orderBy(desc(accountsTable.createdAt));

    res.json({ accounts: rows.map(toSafeAccount) });
  } catch (err) {
    logger.error(err, "GET /games/:gameId/accounts failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /accounts/:id — disabled; detail routes may expose secrets. */
router.get("/accounts/:id", async (_req: Request, res: Response) => {
  res.status(403).json({ error: ACCOUNT_OPS_DISABLED });
});

/** POST /games/:gameId/accounts — disabled; account creation is not authorized. */
router.post("/games/:gameId/accounts", async (_req: Request, res: Response) => {
  res.status(403).json({ error: ACCOUNT_OPS_DISABLED });
});

/** PATCH /accounts/:id — disabled; account editing is not authorized. */
router.patch("/accounts/:id", async (_req: Request, res: Response) => {
  res.status(403).json({ error: ACCOUNT_OPS_DISABLED });
});

/** DELETE /accounts/:id — disabled; account deletion is not authorized. */
router.delete("/accounts/:id", async (_req: Request, res: Response) => {
  res.status(403).json({ error: ACCOUNT_OPS_DISABLED });
});

export default router;
