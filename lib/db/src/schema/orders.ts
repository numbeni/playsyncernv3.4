import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { orderSourceEnum, orderStatusEnum } from "./enums";

/**
 * Orders table — independent entity. capacity_customers references orders.
 * orderCode is the canonical normalized form: ORD-<number> (no leading zeros).
 */
export const ordersTable = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderCode: text("order_code").notNull().unique(),
    source: orderSourceEnum("source").notNull().default("manual"),
    status: orderStatusEnum("status").notNull().default("pending_assignment"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_source_idx").on(t.source),
    index("orders_deleted_at_idx").on(t.deletedAt),
  ],
);

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;
