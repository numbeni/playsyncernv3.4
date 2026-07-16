# PS-03C2B — Schema Retirement Inventory

**Status:** Prepared, not started. This inventory lists the schema objects that migration `0003` may later remove or rename once Runtime coupling has been cleared by PS-03C2A.

## 1. Legacy plaintext Account columns and index

| Object | Kind | Notes |
|--------|------|-------|
| `accounts.email` | column | Plaintext PSN email. |
| `accounts.email_normalized` | column | Normalized plaintext email. |
| `accounts_email_normalized_active_uniq` | partial unique index | ON `email_normalized` WHERE `deleted_at IS NULL`. |

## 2. Legacy Account status column, index, and enums

| Object | Kind | Notes |
|--------|------|-------|
| `accounts.status` | column | `account_status` enum (`active`, `disabled`). |
| `accounts.status_override` | column | `account_status_override` enum (`SOLD`, `INACTIVE`). |
| `account_status` | enum | Legacy active/disabled status. |
| `account_status_override` | enum | Manual override values. |
| `accounts_status_idx` | index | ON `status`. |

## 3. Legacy password / family-email columns

| Object | Kind | Notes |
|--------|------|-------|
| `accounts.playstation_password_encrypted` | column | Legacy PSN password value. |
| `accounts.email_password_encrypted` | column | Legacy email password value. |
| `accounts.family_management_email_encrypted` | column | Legacy family-management email value. |

## 4. Legacy Capacity kind column, enum, constraint, and value

| Object | Kind | Notes |
|--------|------|-------|
| `account_capacities.capacity_kind` | column | `capacity_kind` enum, NOT NULL. |
| `capacity_kind` | enum | Values `Z2_PS5`, `Z2_PS4`, `Z3_PS5`. |
| `Z3_PS5` | enum value | Replaced by `Z3_SHARED_PS5_PS4` in Runtime logic. |
| `account_capacities_unique_slot` | unique constraint | ON (`account_id`, `capacity_kind`, `instance_no`). |

After retirement, `capacity_kind_v2` (enum `capacity_kind_v2` with `Z3_SHARED_PS5_PS4`) becomes the canonical column and `account_capacities_v2_unique_slot` becomes the active unique index.

## 5. Obsolete Backup Code value and lifecycle columns

### 5.1 Value field to become canonical ciphertext

| Object | Kind | Notes |
|--------|------|-------|
| `account_backup_codes.code_encrypted` | column | Legacy value column; migration 0003 should rename/replace to `code_ciphertext` and keep it as the single storage field. |

### 5.2 Fields superseded by the storage-only decision

| Object | Kind | Notes |
|--------|------|-------|
| `account_backup_codes.code_encrypted_v2` | column | Additive v2 ciphertext; no longer needed. |
| `account_backup_codes.code_lookup_hash_v2` | column | Additive lookup hash; no longer needed. |
| `account_backup_codes.status` | column | `backup_code_status` enum (`AVAILABLE`, `USED`, `REVOKED`). |
| `account_backup_codes.used_at` | column | Lifecycle timestamp. |
| `backup_code_status` | enum | Lifecycle status enum. |
| `account_backup_codes_status_idx` | index | ON `status`. |
| `account_backup_codes_code_lookup_hash_v2_idx` | index | ON `code_lookup_hash_v2`. |

After retirement, the authoritative Backup Code contract is `id`, `account_id`, `code_ciphertext`, `created_at`.

## 6. Objects that are final and should NOT be retired

| Object | Reason |
|--------|--------|
| `game_account_sequences` | Already final: `last_value` is `NOT NULL` with default `0`, FK is `NO ACTION`. |
| `capacity_customers` | Explicitly out of scope for Account Core. |

## 7. Remaining Runtime/test coupling that still blocks retirement

| Location | Coupling | Action required in PS-03C2B or a follow-up stage |
|----------|----------|---------------------------------------------------|
| `artifacts/api-server/src/routes/games.test.ts` `seedAccountForGame()` | Inserts dummy values into `email`, `email_normalized`, `playstation_password_encrypted`, `email_password_encrypted` to satisfy the test DB's `NOT NULL` constraints. | Rewrite the test fixture once those columns are removed or made nullable. |
| `lib/db/src/migrations/ps03c1.test.ts` | Frozen PS-03C1 baseline test asserts the existence of legacy columns and `Z3_PS5` after 0002. | Keep as the 0002 baseline; add a new PS-03C2B migration test that verifies the post-0003 schema. |
| `fixtures/legacy/playSyncerMockData.ts` | Contains `Z3_PS5` and legacy Account mock fields (email, password, backupCodes). | Update or remove when the frontend is integrated with the Account backend. |
| `artifacts/playsyncer/src/domain/slots/types.ts` | `SlotType` still includes `Z3_PS5`. | Update when frontend integrates with the canonical `Z3_SHARED_PS5_PS4` capacity model. |

## 8. Notes for migration 0003 design

- All Account-related tables are empty in the live database, so destructive schema changes are safe.
- `capacity_customers` must remain untouched.
- The new canonical Account storage contract after 0003 should expose only non-secret identifier fields: `id`, `game_id`, `account_code`, `account_number_prefix`, `account_number_seq`, `display_number`, `online_id`, `birth_date`, `created_at`, `updated_at`, `deleted_at`.
- The new canonical Backup Code storage contract is `id`, `account_id`, `code_ciphertext`, `created_at`.
- The new canonical Capacity kind contract is `capacity_kind_v2` with values `Z2_PS5`, `Z2_PS4`, `Z3_SHARED_PS5_PS4`.
