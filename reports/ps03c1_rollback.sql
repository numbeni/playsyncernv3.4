-- PS-03C1 rollback plan for migration 0002_warm_swarm.sql
-- Removes only objects introduced by PS-03C1 in safe reverse dependency order.
-- Do not run against the active Replit database. Use only on an isolated disposable database.

-- 1. Identifier immutability trigger and function.
DROP TRIGGER IF EXISTS "accounts_protect_identifiers_trigger" ON "public"."accounts";
DROP FUNCTION IF EXISTS "public"."accounts_protect_identifiers_fn"();

-- 2. New indexes introduced by PS-03C1.
DROP INDEX IF EXISTS "public"."account_capacities_v2_unique_slot";
DROP INDEX IF EXISTS "public"."account_capacities_is_finished_idx";
DROP INDEX IF EXISTS "public"."account_backup_codes_code_lookup_hash_v2_idx";
DROP INDEX IF EXISTS "public"."account_backup_codes_status_idx";
DROP INDEX IF EXISTS "public"."accounts_online_id_idx";
DROP INDEX IF EXISTS "public"."accounts_family_email_lookup_hash_idx";
DROP INDEX IF EXISTS "public"."accounts_email_password_lookup_hash_idx";
DROP INDEX IF EXISTS "public"."accounts_psn_password_lookup_hash_idx";
DROP INDEX IF EXISTS "public"."accounts_psn_email_lookup_hash_idx";

-- 3. New unique and check constraints introduced by PS-03C1.
ALTER TABLE "public"."account_capacities" DROP CONSTRAINT IF EXISTS "account_capacities_finished_consistency";
ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "accounts_game_display_unique";
ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "accounts_game_seq_unique";

-- 4. New columns introduced by PS-03C1.
ALTER TABLE "public"."account_capacities" DROP COLUMN IF EXISTS "finished_at";
ALTER TABLE "public"."account_capacities" DROP COLUMN IF EXISTS "is_finished";
ALTER TABLE "public"."account_capacities" DROP COLUMN IF EXISTS "capacity_kind_v2";

ALTER TABLE "public"."account_backup_codes" DROP COLUMN IF EXISTS "status";
ALTER TABLE "public"."account_backup_codes" DROP COLUMN IF EXISTS "code_lookup_hash_v2";
ALTER TABLE "public"."account_backup_codes" DROP COLUMN IF EXISTS "code_encrypted_v2";

ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "status_override";
ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "family_management_email_lookup_hash";
ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "family_management_email_encrypted_v2";
ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "email_password_lookup_hash";
ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "email_password_encrypted_v2";
ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "psn_password_lookup_hash";
ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "psn_password_encrypted";
ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "psn_email_lookup_hash";
ALTER TABLE "public"."accounts" DROP COLUMN IF EXISTS "psn_email_encrypted";

-- 5. New table introduced by PS-03C1.
DROP TABLE IF EXISTS "public"."game_account_sequences";

-- 6. New sequence introduced by PS-03C1.
DROP SEQUENCE IF EXISTS "public"."account_code_seq";

-- 7. New enums introduced by PS-03C1.
DROP TYPE IF EXISTS "public"."capacity_kind_v2";
DROP TYPE IF EXISTS "public"."backup_code_status";
DROP TYPE IF EXISTS "public"."account_status_override";
