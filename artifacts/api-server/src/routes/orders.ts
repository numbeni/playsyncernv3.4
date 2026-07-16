import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable } from "@workspace/db";
import { normalizeOrderCode, isValidOrderCode } from "@workspace/db/helpers";
import { eq, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { p } from "../lib/req-param";
import { requireUuidParam } from "../lib/validate-uuid";

const router: IRouter = Router();

// Malformed UUID route params fail fast with HTTP 400 instead of reaching the DB.
router.param("id", requireUuidParam("id"));

// ── Validation ──────────────────────────────────────────────────────────────

const CreateOrderBody = z.object({
  orderCode: z.string().min(1),
  source: z.enum(["manual", "woocommerce", "api"]).default("manual"),
  notes: z.string().optional(),
});

// ── Routes ───────────────────────────────────────────────────────────────────

/** GET /orders — list all non-deleted orders */
router.get("/orders", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(isNull(ordersTable.deletedAt))
      .orderBy(desc(ordersTable.createdAt));

    res.json({ orders: rows });
  } catch (err) {
    logger.error(err, "GET /orders failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /orders/:id — single order */
router.get("/orders/:id", async (req: Request, res: Response) => {
  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, p(req.params["id"])))
      .limit(1);

    if (!order || order.deletedAt) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json({ order });
  } catch (err) {
    logger.error(err, "GET /orders/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /orders — create order with normalized order code */
router.post("/orders", async (req: Request, res: Response) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const normalized = normalizeOrderCode(parsed.data.orderCode);
  if (!normalized || !isValidOrderCode(normalized)) {
    res.status(400).json({
      error: "Invalid order code",
      detail: "Expected a positive integer or ORD-<number> format (e.g. 200, ORD-200, ord-200, #200)",
    });
    return;
  }

  try {
    const [order] = await db
      .insert(ordersTable)
      .values({
        orderCode: normalized,
        source: parsed.data.source,
        notes: parsed.data.notes,
      })
      .returning();

    res.status(201).json({ order });
  } catch (err: unknown) {
    if (
      typeof err === "object" && err !== null && "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      res.status(409).json({ error: `Order code ${normalized} already exists` });
      return;
    }
    logger.error(err, "POST /orders failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
