import { pgEnum } from "drizzle-orm/pg-core";

export const gamePlatformEnum = pgEnum("game_platform", [
  "PS5_ONLY",
  "PS4_AND_PS5",
  "PS4_ONLY",
]);

export const gameStatusEnum = pgEnum("game_status", ["ACTIVE", "INACTIVE"]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "disabled",
]);

export const capacityKindEnum = pgEnum("capacity_kind", [
  "Z2_PS5",
  "Z2_PS4",
  "Z3_PS5",
]);

export const capacityPlatformEnum = pgEnum("capacity_platform", ["PS4", "PS5"]);

export const orderSourceEnum = pgEnum("order_source", [
  "manual",
  "woocommerce",
  "api",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending_assignment",
  "assigned",
  "delivered",
  "failed",
  "cancelled",
]);

export const capacityCustomerStatusEnum = pgEnum("capacity_customer_status", [
  "active",
  "removed",
  "cancelled",
]);

export const adminStatusEnum = pgEnum("admin_status", ["active", "inactive"]);
