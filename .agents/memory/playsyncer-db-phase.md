---
name: PlaySyncer DB phase
description: What was built in the DB advancement phase — schema, seed data, API routes, and patterns to carry forward.
---

## What exists

**Schema (live in Replit PostgreSQL):**
- 9 enums, 8 tables: admins, games, accounts, account_backup_codes, account_capacities, orders, capacity_customers, audit_logs
- Partial unique indexes: `accounts.email_normalized WHERE deleted_at IS NULL`, `capacity_customers(capacity_id, order_id) WHERE status = 'active'`

**Seed data:** 3 games, 4 accounts, 14 capacity slots, 5 orders, 4 customer assignments (UUIDs all prefixed 11/22/33/44/55-0000-...-000N)

**API routes (all under /api):** full CRUD for games, accounts, orders, capacity-customers. See replit.md for the full route table.

## Patterns — always follow

**Sensitive fields:** `playstationPasswordEncrypted`, `emailPasswordEncrypted`, `familyManagementEmailEncrypted` must NEVER be returned in API responses. Always pipe accounts through `toSafeAccount()` from `src/lib/dto.ts`.

**Transactions:** any route that does 2+ DB writes must use `db.transaction(async (tx) => { ... })`. Account creation and customer assignment already do this.

**Soft-delete filtering:** list routes must always include `isNull(table.deletedAt)` in WHERE. LEFT JOINs that count child rows must filter deletedAt in the JOIN condition, not the WHERE clause.

**Express v5 params:** `req.params["key"]` is typed `string | string[]`. Always wrap with `p()` from `src/lib/req-param.ts`.

**Order codes:** always normalize via `normalizeOrderCode()` from `@workspace/db/helpers` before insert. Canonical form: `ORD-<number>` no leading zeros.

## Known gaps / TODOs

- `nextAccountCode()` and `nextSeqForGame()` are race-prone (`max+1`). Replace with PostgreSQL sequences before production load.
- Encryption not wired — `*Encrypted` columns currently store plaintext. Full encryption middleware needed before any production deployment.
- No authz middleware on any route — all CRUD is open. Auth layer needed before non-local deployment.
- `audit_logs` table exists but nothing writes to it yet.
- OpenAPI spec and Orval-generated clients not updated to reflect new routes.

**Why these gaps are OK for now:** this is a dev/admin tool in an internal environment. The foundation is correct; the gaps are sequenced for later phases.
