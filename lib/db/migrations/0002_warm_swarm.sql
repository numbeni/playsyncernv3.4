CREATE TYPE "public"."account_status_override" AS ENUM('SOLD', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."backup_code_status" AS ENUM('AVAILABLE', 'USED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."capacity_kind_v2" AS ENUM('Z2_PS5', 'Z2_PS4', 'Z3_SHARED_PS5_PS4');--> statement-breakpoint
CREATE SEQUENCE "public"."account_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "game_account_sequences" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_account_sequences" ADD CONSTRAINT "game_account_sequences_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "psn_email_encrypted" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "psn_email_lookup_hash" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "psn_password_encrypted" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "psn_password_lookup_hash" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "email_password_encrypted_v2" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "email_password_lookup_hash" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "family_management_email_encrypted_v2" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "family_management_email_lookup_hash" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "status_override" "account_status_override";--> statement-breakpoint
ALTER TABLE "account_backup_codes" ADD COLUMN "code_encrypted_v2" text;--> statement-breakpoint
ALTER TABLE "account_backup_codes" ADD COLUMN "code_lookup_hash_v2" text;--> statement-breakpoint
ALTER TABLE "account_backup_codes" ADD COLUMN "status" "backup_code_status" DEFAULT 'AVAILABLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_capacities" ADD COLUMN "capacity_kind_v2" "capacity_kind_v2";--> statement-breakpoint
ALTER TABLE "account_capacities" ADD COLUMN "is_finished" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account_capacities" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "accounts_psn_email_lookup_hash_idx" ON "accounts" USING btree ("psn_email_lookup_hash");--> statement-breakpoint
CREATE INDEX "accounts_psn_password_lookup_hash_idx" ON "accounts" USING btree ("psn_password_lookup_hash");--> statement-breakpoint
CREATE INDEX "accounts_email_password_lookup_hash_idx" ON "accounts" USING btree ("email_password_lookup_hash");--> statement-breakpoint
CREATE INDEX "accounts_family_email_lookup_hash_idx" ON "accounts" USING btree ("family_management_email_lookup_hash");--> statement-breakpoint
CREATE INDEX "accounts_online_id_idx" ON "accounts" USING btree ("online_id");--> statement-breakpoint
CREATE INDEX "account_backup_codes_status_idx" ON "account_backup_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_backup_codes_code_lookup_hash_v2_idx" ON "account_backup_codes" USING btree ("code_lookup_hash_v2");--> statement-breakpoint
CREATE UNIQUE INDEX "account_capacities_v2_unique_slot" ON "account_capacities" USING btree ("account_id","capacity_kind_v2","instance_no") WHERE "account_capacities"."capacity_kind_v2" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "account_capacities_is_finished_idx" ON "account_capacities" USING btree ("is_finished");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_game_seq_unique" UNIQUE("game_id","account_number_seq");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_game_display_unique" UNIQUE("game_id","display_number");--> statement-breakpoint
ALTER TABLE "account_capacities" ADD CONSTRAINT "account_capacities_finished_consistency" CHECK (("account_capacities"."is_finished" = false AND "account_capacities"."finished_at" IS NULL) OR ("account_capacities"."is_finished" = true AND "account_capacities"."finished_at" IS NOT NULL));--> statement-breakpoint

-- Identifier immutability trigger.
-- Blocks updates that change account_code, account_number_prefix, account_number_seq, or display_number.
-- Identical-value updates are allowed.
CREATE OR REPLACE FUNCTION "public"."accounts_protect_identifiers_fn"()
RETURNS TRIGGER AS $$
BEGIN
	IF (OLD."account_code" IS DISTINCT FROM NEW."account_code")
		OR (OLD."account_number_prefix" IS DISTINCT FROM NEW."account_number_prefix")
		OR (OLD."account_number_seq" IS DISTINCT FROM NEW."account_number_seq")
		OR (OLD."display_number" IS DISTINCT FROM NEW."display_number") THEN
		RAISE EXCEPTION 'Account identifiers are immutable';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "accounts_protect_identifiers_trigger"
BEFORE UPDATE ON "public"."accounts"
FOR EACH ROW
EXECUTE FUNCTION "public"."accounts_protect_identifiers_fn"();
