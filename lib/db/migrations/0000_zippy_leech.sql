CREATE TYPE "public"."account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."admin_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."capacity_customer_status" AS ENUM('active', 'removed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."capacity_kind" AS ENUM('Z2_PS5', 'Z2_PS4', 'Z3_PS5');--> statement-breakpoint
CREATE TYPE "public"."capacity_platform" AS ENUM('PS4', 'PS5');--> statement-breakpoint
CREATE TYPE "public"."game_platform" AS ENUM('PS5_ONLY', 'PS4_AND_PS5', 'PS4_ONLY');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('manual', 'woocommerce', 'api');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_assignment', 'assigned', 'delivered', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" "admin_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"cover_url" text,
	"platform" "game_platform" NOT NULL,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"account_code" text NOT NULL,
	"account_number_prefix" text NOT NULL,
	"account_number_seq" integer NOT NULL,
	"display_number" text NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"playstation_password_encrypted" text NOT NULL,
	"email_password_encrypted" text NOT NULL,
	"family_management_email_encrypted" text,
	"online_id" text,
	"birth_date" text,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "accounts_account_code_unique" UNIQUE("account_code")
);
--> statement-breakpoint
CREATE TABLE "account_backup_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"code_encrypted" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_capacities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"capacity_kind" "capacity_kind" NOT NULL,
	"instance_no" integer NOT NULL,
	"display_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_capacities_unique_slot" UNIQUE("account_id","capacity_kind","instance_no")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_code" text NOT NULL,
	"source" "order_source" DEFAULT 'manual' NOT NULL,
	"status" "order_status" DEFAULT 'pending_assignment' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "orders_order_code_unique" UNIQUE("order_code")
);
--> statement-breakpoint
CREATE TABLE "capacity_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capacity_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_phone_encrypted" text NOT NULL,
	"customer_phone_blind_index" text,
	"status" "capacity_customer_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_backup_codes" ADD CONSTRAINT "account_backup_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_capacities" ADD CONSTRAINT "account_capacities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_customers" ADD CONSTRAINT "capacity_customers_capacity_id_account_capacities_id_fk" FOREIGN KEY ("capacity_id") REFERENCES "public"."account_capacities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_customers" ADD CONSTRAINT "capacity_customers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_status_idx" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "games_deleted_at_idx" ON "games" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_normalized_active_uniq" ON "accounts" USING btree ("email_normalized") WHERE "accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "accounts_game_id_idx" ON "accounts" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accounts_deleted_at_idx" ON "accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "accounts_account_code_idx" ON "accounts" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "account_backup_codes_account_id_idx" ON "account_backup_codes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "account_capacities_account_id_idx" ON "account_capacities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_source_idx" ON "orders" USING btree ("source");--> statement-breakpoint
CREATE INDEX "orders_deleted_at_idx" ON "orders" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "capacity_customers_active_assignment_uniq" ON "capacity_customers" USING btree ("capacity_id","order_id") WHERE "capacity_customers"."status" = 'active';--> statement-breakpoint
CREATE INDEX "capacity_customers_capacity_id_idx" ON "capacity_customers" USING btree ("capacity_id");--> statement-breakpoint
CREATE INDEX "capacity_customers_order_id_idx" ON "capacity_customers" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "capacity_customers_status_idx" ON "capacity_customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "capacity_customers_phone_blind_idx" ON "capacity_customers" USING btree ("customer_phone_blind_index");--> statement-breakpoint
CREATE INDEX "audit_logs_admin_id_idx" ON "audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");