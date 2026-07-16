import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { capacityKindEnum, capacityKindV2Enum } from "./enums";
import { accountsTable } from "./accounts";

/**
 * Persistent capacity rows — one row per slot per account.
 *
 * Legacy capacityKind uses Z3_PS5. PS-03C1 introduces capacityKindV2 with
 * Z3_SHARED_PS5_PS4, kept nullable until the runtime cutover stage.
 */
export const accountCapacitiesTable = pgTable(
  "account_capacities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id),
    // Legacy capacity kind. Kept during the additive stage.
    capacityKind: capacityKindEnum("capacity_kind").notNull(),
    // Versioned capacity kind. Nullable until the runtime cutover stage.
    capacityKindV2: capacityKindV2Enum("capacity_kind_v2"),
    instanceNo: integer("instance_no").notNull(),
    displayLabel: text("display_label").notNull(),
    // PS-03C1 additive FINISHED state fields.
    isFinished: boolean("is_finished").notNull().default(false),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Legacy unique slot constraint.
    unique("account_capacities_unique_slot").on(
      t.accountId,
      t.capacityKind,
      t.instanceNo,
    ),
    // Future unique slot index for the versioned capacity kind.
    uniqueIndex("account_capacities_v2_unique_slot")
      .on(t.accountId, t.capacityKindV2, t.instanceNo)
      .where(sql`${t.capacityKindV2} IS NOT NULL`),
    // FINISHED state consistency: indicator and timestamp must agree.
    check(
      "account_capacities_finished_consistency",
      sql`(${t.isFinished} = false AND ${t.finishedAt} IS NULL) OR (${t.isFinished} = true AND ${t.finishedAt} IS NOT NULL)`,
    ),
    index("account_capacities_account_id_idx").on(t.accountId),
    index("account_capacities_is_finished_idx").on(t.isFinished),
  ],
);

export type AccountCapacity = typeof accountCapacitiesTable.$inferSelect;
export type InsertAccountCapacity = typeof accountCapacitiesTable.$inferInsert;
