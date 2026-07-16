import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  accountCapacitiesTable,
  capacityCustomersTable,
  ordersTable,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { p } from "../lib/req-param";
import { requireUuidParam } from "../lib/validate-uuid";

const router: IRouter = Router();

// Malformed UUID route params fail fast with HTTP 400 instead of reaching the DB.
router.param("accountId", requireUuidParam("accountId"));
router.param("capacityId", requireUuidParam("capacityId"));
router.param("customerId", requireUuidParam("customerId"));

// ── Validation ──────────────────────────────────────────────────────────────

const AssignCustomerBody = z.object({
  orderId: z.string().uuid(),
  /** Plaintext phone — stored as-is until encryption is wired up. */
  customerPhone: z.string().min(7),
  note: z.string().optional(),
});

const EditCustomerBody = z.object({
  customerPhone: z.string().min(7).optional(),
  note: z.string().nullable().optional(),
});

// ── Routes ───────────────────────────────────────────────────────────────────

/** GET /accounts/:accountId/capacities — slots with their active customers */
router.get("/accounts/:accountId/capacities", async (req: Request, res: Response) => {
  try {
    const accountId = p(req.params["accountId"]);

    const capacities = await db
      .select()
      .from(accountCapacitiesTable)
      .where(eq(accountCapacitiesTable.accountId, accountId));

    if (capacities.length === 0) {
      res.json({ capacities: [] });
      return;
    }

    const customers = await db
      .select({
        id: capacityCustomersTable.id,
        capacityId: capacityCustomersTable.capacityId,
        orderId: capacityCustomersTable.orderId,
        orderCode: ordersTable.orderCode,
        customerPhoneEncrypted: capacityCustomersTable.customerPhoneEncrypted,
        status: capacityCustomersTable.status,
        note: capacityCustomersTable.note,
        createdAt: capacityCustomersTable.createdAt,
      })
      .from(capacityCustomersTable)
      .innerJoin(ordersTable, eq(ordersTable.id, capacityCustomersTable.orderId))
      .where(
        and(
          eq(capacityCustomersTable.status, "active"),
          isNull(capacityCustomersTable.deletedAt),
        ),
      );

    const byCapacity = customers.reduce<
      Record<string, typeof customers>
    >((acc, c) => {
      (acc[c.capacityId] ??= []).push(c);
      return acc;
    }, {});

    res.json({
      capacities: capacities.map((cap) => ({
        ...cap,
        customers: byCapacity[cap.id] ?? [],
      })),
    });
  } catch (err) {
    logger.error(err, "GET /accounts/:accountId/capacities failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /capacities/:capacityId/customers — assign customer to a slot */
router.post("/capacities/:capacityId/customers", async (req: Request, res: Response) => {
  const parsed = AssignCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const capacityId = p(req.params["capacityId"]);

  const [capacity] = await db
    .select()
    .from(accountCapacitiesTable)
    .where(eq(accountCapacitiesTable.id, capacityId))
    .limit(1);

  if (!capacity) {
    res.status(404).json({ error: "Capacity not found" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, parsed.data.orderId))
    .limit(1);

  if (!order || order.deletedAt) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  try {
    // Assign customer and advance order status atomically — partial failure
    // would leave an order stuck in pending_assignment with no customer record.
    const customer = await db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(capacityCustomersTable)
        .values({
          capacityId,
          orderId: parsed.data.orderId,
          customerPhoneEncrypted: parsed.data.customerPhone,
          customerPhoneBlindIndex: parsed.data.customerPhone.toLowerCase().trim(),
          note: parsed.data.note ?? null,
        })
        .returning();

      await tx
        .update(ordersTable)
        .set({ status: "assigned", updatedAt: new Date() })
        .where(eq(ordersTable.id, parsed.data.orderId));

      return customer;
    });

    res.status(201).json({ customer });
  } catch (err: unknown) {
    if (
      typeof err === "object" && err !== null && "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      res.status(409).json({
        error: "This order is already actively assigned to this capacity",
      });
      return;
    }
    logger.error(err, "POST /capacities/:capacityId/customers failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** PATCH /capacities/:capacityId/customers/:customerId — edit assignment */
router.patch(
  "/capacities/:capacityId/customers/:customerId",
  async (req: Request, res: Response) => {
    const parsed = EditCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
      return;
    }

    try {
      const update: Partial<typeof capacityCustomersTable.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (parsed.data.customerPhone !== undefined) {
        update.customerPhoneEncrypted = parsed.data.customerPhone;
        update.customerPhoneBlindIndex = parsed.data.customerPhone.toLowerCase().trim();
      }
      if (parsed.data.note !== undefined) update.note = parsed.data.note;

      const [customer] = await db
        .update(capacityCustomersTable)
        .set(update)
        .where(
          and(
            eq(capacityCustomersTable.id, p(req.params["customerId"])),
            eq(capacityCustomersTable.capacityId, p(req.params["capacityId"])),
          ),
        )
        .returning();

      if (!customer) {
        res.status(404).json({ error: "Customer assignment not found" });
        return;
      }
      res.json({ customer });
    } catch (err) {
      logger.error(err, "PATCH /capacities/:capacityId/customers/:customerId failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/** DELETE /capacities/:capacityId/customers/:customerId — soft remove */
router.delete(
  "/capacities/:capacityId/customers/:customerId",
  async (req: Request, res: Response) => {
    try {
      const [customer] = await db
        .update(capacityCustomersTable)
        .set({ status: "removed", deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(capacityCustomersTable.id, p(req.params["customerId"])),
            eq(capacityCustomersTable.capacityId, p(req.params["capacityId"])),
          ),
        )
        .returning();

      if (!customer) {
        res.status(404).json({ error: "Customer assignment not found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      logger.error(err, "DELETE /capacities/:capacityId/customers/:customerId failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
