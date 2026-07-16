import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { capacityCustomerStatusEnum } from "./enums";
import { accountCapacitiesTable } from "./account-capacities";
import { ordersTable } from "./orders";

export const capacityCustomersTable = pgTable(
  "capacity_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    capacityId: uuid("capacity_id")
      .notNull()
      .references(() => accountCapacitiesTable.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id),

    // Encrypted columns — actual encryption is NOT implemented in this phase.
    customerPhoneEncrypted: text("customer_phone_encrypted").notNull(),
    // Blind index enables server-side equality search without decrypting.
    // Nullable: may be absent until indexing is wired up.
    customerPhoneBlindIndex: text("customer_phone_blind_index"),

    status: capacityCustomerStatusEnum("status").notNull().default("active"),
    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // An order may only be actively assigned to a given capacity once.
    uniqueIndex("capacity_customers_active_assignment_uniq")
      .on(t.capacityId, t.orderId)
      .where(sql`${t.status} = 'active'`),

    index("capacity_customers_capacity_id_idx").on(t.capacityId),
    index("capacity_customers_order_id_idx").on(t.orderId),
    index("capacity_customers_status_idx").on(t.status),
    index("capacity_customers_phone_blind_idx").on(t.customerPhoneBlindIndex),
  ],
);

export type CapacityCustomer = typeof capacityCustomersTable.$inferSelect;
export type InsertCapacityCustomer = typeof capacityCustomersTable.$inferInsert;
