# PS-03C2A — Runtime Schema Compatibility Refactor

**Status:** IMPLEMENTED, AWAITING COMMAND CENTER REVIEW

**Scope:** Remove Runtime and test dependencies on legacy Account fields so migration `0003` can later retire them safely. No migration, schema metadata, or live database change occurred.

## Immutable baseline

| Migration | Hash |
|-----------|------|
| 0000 | `a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca` |
| 0001 | `c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2` |
| 0002 | `99f124e4bb93a8763d485813a65355c44e4a0aa4a1a6b4eb8ddffc47e3059b6a` |

Migration `0003` does not exist. The three frozen migrations were not modified, regenerated, or reapplied.

## Live database verification (read-only)

Performed before and after implementation with a read-only transaction (`SHOW transaction_read_only = on`).

| Table | Row count (before) | Row count (after) |
|-------|-------------------:|------------------:|
| `accounts` | 0 | 0 |
| `account_backup_codes` | 0 | 0 |
| `account_capacities` | 0 | 0 |
| `capacity_customers` | 0 | 0 |
| `game_account_sequences` | 0 | 0 |
| `orders` | 0 | 0 |

`drizzle.__drizzle_migrations` contained exactly three rows with the hashes above, both before and after.

## Files changed

| Path | Change |
|------|--------|
| `artifacts/api-server/src/lib/dto.ts` | Rewrote `toSafeAccount` to return only non-secret Account fields; added `SafeAccount` and `BackupCodeStorage` runtime types. |
| `artifacts/api-server/src/routes/accounts.ts` | Disabled POST, PATCH, DELETE, and GET-detail Account routes (fail-closed 403); kept GET `/games/:gameId/accounts` but returned only `SafeAccount` DTOs. |
| `artifacts/api-server/src/routes/games.test.ts` | Refactored `createAccountForGame` to `seedAccountForGame`, which inserts a minimal Account row directly in the test DB for Game guard tests; removed the Account-creation concurrency test. |
| `artifacts/api-server/src/routes/accounts.concurrency.test.ts` | Deleted. |
| `artifacts/api-server/src/routes/accounts.disabled.test.ts` | Added. Proves Account POST, PATCH, DELETE, and GET-detail are disabled and perform no writes. |
| `lib/db/src/helpers/capacity-definitions.ts` | Replaced `Z3_PS5` with `Z3_SHARED_PS5_PS4` in the runtime capacity-definition helper. |

No files changed under `lib/db/migrations`, `lib/db/migrations/meta`, or `lib/db/src/schema`.

## Runtime couplings removed

- `artifacts/api-server/src/routes/accounts.ts` no longer references `email`, `emailNormalized`, `playstationPasswordEncrypted`, `emailPasswordEncrypted`, `familyManagementEmailEncrypted`, `status`, `statusOverride`, `accountBackupCodesTable`, `accountCapacitiesTable`, or `buildCapacityDefinitions`.
- `artifacts/api-server/src/lib/dto.ts` no longer omits specific encrypted columns; it now explicitly builds a `SafeAccount` containing only non-secret identifier fields.
- `lib/db/src/helpers/capacity-definitions.ts` no longer emits `Z3_PS5`.
- The deleted `accounts.concurrency.test.ts` no longer uses raw SQL with legacy Account columns or `Z3_PS5`.

## Remaining runtime/test coupling for PS-03C2B

- `artifacts/api-server/src/routes/games.test.ts` `seedAccountForGame()` still inserts dummy values into the legacy columns `email`, `email_normalized`, `playstation_password_encrypted`, and `email_password_encrypted` because the test DB schema (after 0002) still requires them as `NOT NULL`. After migration 0003 removes those columns, this test fixture must be rewritten.
- `lib/db/src/migrations/ps03c1.test.ts` is the frozen PS-03C1 baseline test and intentionally verifies that the legacy columns and `Z3_PS5` exist after 0002. It does not block retirement, but it will need a companion PS-03C2B test once 0003 is applied.

## Required checks and results

| Command | Result |
|---------|--------|
| `pnpm run typecheck` | PASS |
| `pnpm --filter @workspace/api-server run test` | PASS (30 tests) |
| `pnpm --filter @workspace/db run test` | PASS (13 tests) |
| `pnpm --filter @workspace/db run test:migrations` | PASS (26 tests) |
| `PORT=24351 BASE_PATH=/ pnpm --filter @workspace/playsyncer run build` | PASS |

### API Server test output

```
▶ Account operations are disabled
  ✔ POST /games/:gameId/accounts returns 403 and writes nothing
  ✔ PATCH /accounts/:id returns 403 and writes nothing
  ✔ DELETE /accounts/:id returns 403 and writes nothing
  ✔ GET /accounts/:id returns 403 and exposes no secrets
  ✔ GET /games/:gameId/accounts returns only non-secret account fields
▶ Games API
  ✔ creates a game successfully
  ✔ rejects duplicate normalized titles
  ✔ rejects whitespace-only titles on create
  ✔ rejects whitespace-only titles on update
  ✔ collapses repeated internal spaces in the stored title
  ✔ rejects invalid UUID with 400
  ✔ returns 404 for missing game
  ✔ allows platform change without account history
  ✔ blocks platform change with active account history
  ✔ allows same-platform update when an account exists
  ✔ blocks platform change with a soft-deleted account
  ✔ changes status from ACTIVE to INACTIVE
  ✔ allows hard delete without history
  ✔ blocks hard delete with active account history
  ✔ blocks hard delete with a soft-deleted account
  ✔ enforces global normalized-title uniqueness across soft-deleted games
  ✔ lists all games including inactive ones
ℹ tests 30
ℹ suites 3
ℹ pass 30
ℹ fail 0
```

### DB migration test output

```
▶ PS-03C1 additive schema
  ✔ disposable database is not the active workspace database
  ✔ disposable migration history matches expected hashes
  ✔ global account_code sequence produces increasing non-reused values
  ✔ rolled-back transaction does not reuse a global sequence value
  ✔ per-game counter allocation increments atomically
  ✔ concurrent per-game counter allocations produce distinct sequential values
  ✔ different Games have independent per-game counters
  ✔ deleting an Account does not reset or reuse its per-game sequence number
  ✔ concurrent first per-game counter allocations when no row exists
  ✔ two different Games begin per-game counters independently
  ✔ deleted Account with allocated sequence does not reuse its per-game sequence number
  ✔ unique (game_id, account_number_seq) is enforced
  ✔ unique (game_id, display_number) is enforced
  ✔ duplicate PSN Email lookup hashes remain allowed
  ✔ duplicate Family Management Email lookup hashes remain allowed
  ✔ duplicate Online ID values remain allowed
  ✔ identifier update trigger blocks actual identifier changes
  ✔ identifier update trigger permits unrelated Account updates
  ✔ identifier update trigger permits identical-value updates
  ✔ Capacity FINISHED consistency accepts valid states
  ✔ Capacity FINISHED consistency rejects contradictory states
  ✔ Backup Code lifecycle enum accepts only approved values
  ✔ manual Account override accepts only SOLD, INACTIVE or NULL
  ✔ new shared Z3 representation accepts Z3_SHARED_PS5_PS4
  ✔ legacy columns and enum values remain present
  ✔ rollback restores schema to post-0001 state
ℹ tests 26
ℹ suites 1
ℹ pass 26
ℹ fail 0
```

## Confirmations required by the stage

1. **Account writes remain unauthorized** — POST, PATCH, DELETE return `403` with message `Account operations are not authorized`; tests prove zero row changes.
2. **Generic DTOs expose no Secrets or Backup Codes** — `SafeAccount` includes only `id`, `gameId`, `accountCode`, `accountNumberPrefix`, `accountNumberSeq`, `displayNumber`, `onlineId`, `birthDate`, `createdAt`, `updatedAt`. No email, password, encrypted, lookup-hash, status, or override fields are returned.
3. **`Z3_PS5` Runtime/test dependency removed** — `lib/db/src/helpers/capacity-definitions.ts` now uses `Z3_SHARED_PS5_PS4`; no API-server source or test file contains `Z3_PS5`.
4. **`capacity_customers` unchanged** — No source file under `capacity-customers` or `capacity_customers` schema was modified; migration hashes and live row counts confirm it.
5. **No migration/schema/live DB change** — `git diff` is empty for `lib/db/migrations`, `lib/db/migrations/meta`, and `lib/db/src/schema`; migration hashes and live row counts are identical before and after.

## Evidence artifacts

- `reports/ps03c2a_complete.diff` — full git diff of this stage.
- `reports/ps03c2b_retirement_inventory.md` — exact schema objects that migration 0003 may retire.
