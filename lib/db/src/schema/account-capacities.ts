import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { capacityKindEnum } from "./enums";
import { accountsTable } from "./accounts";

/**
 * Persistent capacity rows — one row per slot per account.
 *
 * instanceNo is NOT NULL (required by Commander):
 *   Z2 PS5 #1  → capacityKind=Z2_PS5, instanceNo=1
 *   Z2 PS5 #2  → capacityKind=Z2_PS5, instanceNo=2
 *   Z2 PS4     → capacityKind=Z2_PS4, instanceNo=0
 *   Z3 PS5     → capacityKind=Z3_PS5, instanceNo=0
 *
 * Capacities are created once when an account is registered and are never
 * auto-regenerated when the game platform changes (Commander decision 10).
 */
export const accountCapacitiesTable = pgTable(
  "account_capacities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id),
    capacityKind: capacityKindEnum("capacity_kind").notNull(),
    instanceNo: integer("instance_no").notNull(),
    displayLabel: text("display_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("account_capacities_unique_slot").on(
      t.accountId,
      t.capacityKind,
      t.instanceNo,
    ),
    index("account_capacities_account_id_idx").on(t.accountId),
  ],
);

export type AccountCapacity = typeof accountCapacitiesTable.$inferSelect;
export type InsertAccountCapacity = typeof accountCapacitiesTable.$inferInsert;
