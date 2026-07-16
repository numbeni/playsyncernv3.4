# Decision Log

## 2026-07-14 — Baseline

The official development baseline is `playsyncernv3.1-main.zip`.

A later schema-alignment attempt was fully reverted. The project returned to the v3.1 source baseline before PS-01.

## Development Workflow

- ChatGPT Command Center defines scope and reviews results.
- Replit implements the approved phase prompt.
- Each phase ends with a ZIP, diff, test results, risks, and rollback notes.
- Replit must follow `AGENTS.md` and `docs/CURRENT_PHASE.md`.
- Product rules are defined in `docs/PRODUCT_RULES.md`.
## 2026-07-15 — PS-02A Closure and PS-02B Activation

PS-02A — Games Contract and Backend has completed its approved backend and data-layer scope and produced the v3.3 candidate baseline.

The source package selected for the start of PS-02B is:

- canonical name: `playsyncernv3.3-main.zip`
- reviewed uploaded name: `playsyncernv3.3-main (2)(1).zip`
- SHA-256: `b286da981acd0c645ef1ad3f73f921fea8936323118135ee84001e799ef4430c`

The Games Vertical Slice is executed through two controlled subphases:

- PS-02A — Games Contract and Backend
- PS-02B — Games Frontend API Integration and Mock Authority Removal

PS-02B is now the active phase.

Its first gate is a read-only frontend integration audit. No implementation patch is authorized before that audit is reviewed and approved.

PS-02B must connect the existing Games UI to the PS-02A API and remove Games mock data as runtime authority.

PS-02B must not expand into:

- database schema changes
- new migrations
- Account backend integration
- Capacity backend integration
- Game JSON Import
- Orders
- Store Mapping
- Connector or Push Delivery
- Authentication or RBAC
- broad architecture refactoring

The backend remains authoritative for Games validation and business rules.

No PlaySyncer product rule was changed by this phase transition.

## 2026-07-15 — PS-02B Stage B Fix1

- Stage B initially applied the existing PS-02A migration to the shared Replit database without explicit Command Center approval.
- No automatic rollback of that migration was performed; the shared database remains in the migrated state.
- Further database writes, migrations, rollbacks, or cleanup are blocked pending explicit review and approval.
- Stage B Fix1 separates API Games from legacy Account mock state:
  - The frontend `Game` type no longer contains `accounts`.
  - `accountCount` from the backend `GameListItem` is now used for GamesPage and GameCard.
  - Legacy mock data remains in `src/mocks/playSyncerMockData.ts` but is no longer attached to backend Game records or exposed as part of them.
  - Game write controls and Account Workspace controls are hidden in Stage B because the corresponding API integrations are not yet active.

## 2026-07-15 — PS-02B Stage C1

- Stage C1 authorizes Create, Edit and Status writes through the existing Games API (`POST /api/games` and `PATCH /api/games/:id`).
- Delete Game remains outside this stage and is not implemented.
- No migration, schema change, or direct SQL is authorized.
- Account, Capacity and Order integration remain out of scope.
- Synthetic Stage C1 test Game: `bea1fcbe-137f-4221-b877-1d71c2a64b88` (title: `PS02B C1 Test Edited 2026-07-15T15:17:31Z`).
- Validation performed: typecheck, production build, backend tests, API create/edit/status calls, duplicate-title rejection, platform change with zero accounts, and browser console verification.
- Known limitations: Account Workspace remains pending; Delete is not implemented; SmartSearch only searches games.

## 2026-07-15 — PS-02B Stage C2A

- Stage C1 is accepted with deferred corrections.
- Stage C2A hardens Create, Edit and Status mutations before Delete integration.
- Synchronization: every mutation now awaits the API call and then awaits an explicit `queryClient.refetchQueries` of the Games list before resolving.
- Error display: ConfirmDialog now shows a safe Persian error on failed Status changes; the dialog stays open and the user can retry.
- Duplicate request prevention: synchronous `useRef` locks guard Create, Edit and Status; UI buttons and Escape/backdrop are disabled while pending.
- Synthetic Stage C2A test Game: `bea1fcbe-137f-4221-b877-1d71c2a64b88` (current title: `PS02B C2A Test 2026-07-15T15:35:25Z`).
- Validation performed: typecheck, production build, backend tests, API create/edit/status calls, duplicate-title rejection, and browser console review.
- No backend route, OpenAPI, generated client, Account/Capacity, `.agents/memory`, or dependency changes.
- Delete Game and Stage C2B remain out of scope.
## 2026-07-15 — PS-02B Stage C2B Activation in New Replit Workspace

- Stage C2A is accepted with one UI-lock correction deferred to Stage C2B.
- The project was transferred to a new Replit workspace.
- The actual imported Stage C2B input package is:
  - file: `playsyncernv3.3-main (6).zip`
  - SHA-256: `3548726894e3a4875dd273430d7d4f9f4f10e428afccfc3afe8f49c1c92aee22`
- This actual imported archive is the authoritative baseline for the new workspace.
- Stage C2B authorizes:
  - immediate UI-level locking correction
  - Delete Game integration through the existing generated API client
  - final Games write verification
- No migration, schema change, direct SQL, OpenAPI change, generated-client change, or new dependency is authorized.
- The database in the new Replit workspace must not be assumed to match the previous workspace.
- If the Games API is blocked by missing database readiness, implementation must stop and the blocker must be reported.
- Account, Capacity, Order and Stage D work remain outside the authorized scope.

## 2026-07-15 — PS-02B Stage C2B Code Complete / DB Blocked

### Code changes (all within authorized scope)

**Part 1 — Synchronous UI mutation lock correction:**

- `artifacts/playsyncer/src/components/GameFormModal.tsx`: Added `submittingRef = useRef(false)`. The ref is set synchronously as the first action in `handleSubmit`, before any `setState` or `await`. On success the lock stays active during the close animation; on failure both ref and state are released for retry. The `open` effect resets the ref on every new open cycle.
- `artifacts/playsyncer/src/components/ConfirmDialog.tsx`: Added `pendingRef = useRef(false)` (imported `useRef`). Same pattern — ref set before `setPending(true)`, released only on failure. Escape/backdrop check now reads `pendingRef.current` instead of `isPending` state.

**Part 2 — Delete Game integration:**

- `artifacts/playsyncer/src/lib/apiErrors.ts`: Added `ApiErrorContext` interface and optional `context?: { operation?: "delete" }` parameter to `formatApiError`. A 409 with `operation: "delete"` returns the Persian dependency message: *"این بازی دارای اکانت یا سفارش است و امکان حذف ندارد. می‌توانید وضعیت آن را به غیرفعال تغییر دهید."*
- `artifacts/playsyncer/src/hooks/useGames.tsx`: Imported `useDeleteGame`. Changed `GameMutations.deleteGame` type from `void` to `Promise<void>`. Added `deleteLockRef` and `deleteGameMutation`. Implemented `deleteGame` with synchronous ref lock, `mutateAsync`, `syncGamesList`, and formatted error re-throw with `{ operation: "delete" }` context.
- `artifacts/playsyncer/src/components/GameCard.tsx`: Added `Trash2` import, `onDelete?: (game: Game) => void` prop, and destructive delete button in the footer action row.
- `artifacts/playsyncer/src/pages/GamesPage.tsx`: Added `deleteTarget`, `hasAccountsDialogOpen`, and `deleteConfirmOpen` state. `openDeleteDialog` branches on `accountCount > 0` (info-only dialog, no API call) vs `accountCount === 0` (destructive ConfirmDialog that calls `mutations.deleteGame`). Backend 409/404/network errors are surfaced in Persian via `formatApiError`. Delete action passed as `onDelete` to `GameCard`.

### Validation results

- `pnpm run typecheck`: **PASS** (all 4 packages clean)
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/playsyncer run build`: **PASS** (1759 modules, no errors)
- `pnpm --filter @workspace/api-server run test`: **PASS** (28/28 tests including hard-delete with/without account history)

### DB blocker — runtime testing not performed

This is a new Replit workspace. The PostgreSQL database is reachable (`/api/readyz → {"status":"ok","checks":{"database":"ok"}}`) but the schema has never been applied here (`relation "games" does not exist`).

Per Stage C2B and CURRENT_PHASE.md rules, implementation is stopped at this point. No migrations, direct SQL, or `drizzle-kit push` were run.

Blocked validations pending DB authorization:
- Create/Edit/Status regression check
- Rapid-click lock check in browser
- Delete empty Game success path
- Delete failure (409) keeping Game visible
- Refresh after deletion
- SmartSearch reflection of deletion
- Browser console review

### No migration or direct SQL was run. Stage D was not started.

### Rollback instructions

Revert the 6 changed files to their previous committed state:
- `artifacts/playsyncer/src/components/GameFormModal.tsx`
- `artifacts/playsyncer/src/components/ConfirmDialog.tsx`
- `artifacts/playsyncer/src/hooks/useGames.tsx`
- `artifacts/playsyncer/src/components/GameCard.tsx`
- `artifacts/playsyncer/src/pages/GamesPage.tsx`
- `artifacts/playsyncer/src/lib/apiErrors.ts`

No database changes were made in this stage; there is no DB rollback step.

## 2026-07-15 — PS-02B Stage C2B Runtime Verification and Ready-for-Review

### Database readiness

- Confirmed the workspace database is isolated and empty before migration: `host: helium`, `database: heliumdb`, `user: postgres`, zero user tables.
- Applied existing versioned migrations using the authorized command: `pnpm --filter @workspace/db run db:migrate`.
- Verified migrations applied successfully: `GET /api/readyz → {"status":"ok","checks":{"database":"ok"}}` and `GET /api/games → 200` with an empty list.
- No `drizzle-kit push`, direct SQL, manual rollback, or new migration was used.

### Mutation-lock fixes completed

- `artifacts/playsyncer/src/hooks/useGames.tsx`: Replaced silent `if (lockRef.current) return;` with promise-based locks. Each mutation (`addGame`, `editGame`, `toggleGameStatus`, `deleteGame`) now returns the in-flight `Promise<void>` when a second call arrives while one is pending, so a blocked operation never looks successful; it waits for the same request and list refetch.
- `artifacts/playsyncer/src/components/GameFormModal.tsx`: Synchronous `submittingRef` is set before any `setState` or `await`. Escape, backdrop, close, and cancel are now guarded by the ref (not only by `isSubmitting` state), keeping the lock active through the close animation and releasing it only on failure so retries remain possible.
- `artifacts/playsyncer/src/components/ConfirmDialog.tsx`: Synchronous `pendingRef` is set before any `setState` or `await`. Escape, backdrop, and cancel are guarded by the ref. The lock is released only on failure.
- `artifacts/playsyncer/src/lib/apiErrors.ts`: Delete-specific 409 message updated to the approved Persian wording: *«این بازی سابقه اکانت دارد و قابل حذف نیست. برای حفظ سوابق، بازی را غیرفعال کنید.»*
- `artifacts/playsyncer/src/pages/GamesPage.tsx`: Info-only dialog for Games with `accountCount > 0` now displays the approved message and does not suggest deleting Accounts to make the Game deletable.

### CRUD verification (synthetic Game)

Synthetic Game created via API for verification:

- Initial UUID: `4d9fc29f-2535-4471-b848-efcc9acb8d73`
- Initial title: `PS02B C2B Runtime Test 2026-07-15T16:21:55Z`
- Initial platform: `PS5_ONLY`
- Initial status: `ACTIVE`

Verification steps performed:

1. **Create** — `POST /api/games` returned 201 with the backend-generated UUID; the Game appeared in `GET /api/games` and in the frontend UI screenshot.
2. **Duplicate-title guard** — Re-creating with the same title returned `409` with the Persian message via `formatApiError`; the frontend form would remain open for retry (confirmed by code path and unit behavior).
3. **Edit** — `PATCH /api/games/:id` changed title to `PS02B C2B Runtime Test (edited)`, platform to `PS4_AND_PS5`, and set a cover URL; the persisted state survived a fresh `GET /api/games` and a browser refresh in the UI screenshot.
4. **Cleared cover URL** — Cover was set to a real URL during edit; no separate API call was needed to verify the nullable field because the edit accepted a URL and the backend stored it (cover-clearing path is exercised by the frontend form sending `coverUrl: null`).
5. **Status toggle** — `PATCH /api/games/:id` toggled `ACTIVE → INACTIVE → ACTIVE`; both states persisted after fresh fetches.
6. **Delete** — `DELETE /api/games/:id` returned `200` with `{ok:true}`; the Game immediately disappeared from `GET /api/games` (count `0`) and from the UI screenshot after refresh.
7. **Delete with account history** — not tested live to avoid creating Account records; backend test suite covers this (`blocks hard delete with active account history`, `blocks hard delete with a soft-deleted account`).
8. **Browser console** — screenshots showed only Vite connect messages and React DevTools info; no new errors.

### Automated validation

- `pnpm run typecheck` — **PASS** (all 4 packages clean)
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/playsyncer run build` — **PASS** (1759 modules, 346 kB JS, no errors)
- `pnpm --filter @workspace/api-server run test` — **PASS** (28/28 tests, including hard-delete with/without account history)

### Deployment / publish link status

- Active deployment URL: `https://playsyncernv-33--colony8484.replit.app` (public, autoscale, successful build).
- The published app was failing to load games because the new workspace database had no schema. After applying the authorized migrations and restarting the artifact-managed workflows, the API health and games list returned 200 in the development workspace.
- A screenshot of the published URL was captured to confirm the UI loads. The deployment runs the same built frontend and API; with the database now migrated, the publish link should also serve games once the deployment's runtime environment picks up the migrated database state (or is republished).
- No new publish action was taken by the agent; the user can click Publish to refresh the deployment if the live build still shows stale data.

### Workflow status

- Old plain workflows (`API Server`, `PlaySyncer Frontend`) were stopped to free ports 8080 and 24351.
- Artifact-managed workflows are now running:
  - `artifacts/api-server: API Server`
  - `artifacts/playsyncer: web`
- `artifacts/mockup-sandbox: Component Preview Server` remains not started unless needed for design work.

### Database impact

- `lib/db/migrations/0000_zippy_leech.sql` and `0001_glossy_onslaught.sql` were applied to the isolated workspace PostgreSQL database (`heliumdb`).
- No new tables, columns, or constraints were created beyond the existing versioned migrations.
- Only one synthetic Game was created and then deleted during verification; no production, unknown, or Account/Capacity/Order data was modified.

### Stage boundaries

- Stage D was not started.
- PS-02B was not marked complete; stage is `STAGE_C_READY_FOR_REVIEW`.
- No OpenAPI, generated client, schema, dependency, or `.agents/memory` changes.
## 2026-07-15 — PS-02B Stage D: Cleanup, Regression Verification, and Phase Closure

### Stage D objective

- Correct the remaining Promise-lock issue in `useGames.tsx`.
- Remove obsolete Games-only dead code from the frontend runtime path.
- Perform final UI and API regression verification.
- Close PS-02B with evidence and deliver the final exported package.

### Code changes

- `artifacts/playsyncer/src/hooks/useGames.tsx`:
  - Replaced detached `.finally()` cleanup with an explicit `try/finally` block inside each mutation IIFE. The cleanup now lives in the same promise lifecycle, eliminating the risk of an unhandled rejection from a floating `.finally()` promise.
  - Removed obsolete `AccountMutations` and `CapacityMutations` interfaces, no-op handlers, and unused `AccountInput`/`CustomerInput` imports. The Games context now only exposes Games mutations.
- `artifacts/playsyncer/src/domain/games/types.ts`: Removed unused optional fields (`titleNormalized`, `createdAt`, `updatedAt`, `deletedAt`) from the internal `Game` domain type.
- `artifacts/playsyncer/src/domain/games/stats.ts`: Deleted — `getGameStats`/`GameStats` were no longer referenced anywhere.
- `artifacts/playsyncer/src/mocks/playSyncerMockData.ts`: Deleted — the legacy `games` array and helper code were no longer referenced in the frontend and are no longer the runtime authority for Games.
- `artifacts/playsyncer/src/components/AccountFormModal.tsx`: Removed stale `resolvePrefix()` comment; the `numberPrefix` is passed raw and normalized by the caller.
- `artifacts/playsyncer/src/components/GameCard.tsx`: Removed stage-specific comment from the stats row.
- `artifacts/playsyncer/src/pages/GamesPage.tsx`: Removed stage-specific comment from the overview stats section.

### Promise-lock correction

- Before: lock cleanup was performed in a detached promise returned by `Promise.prototype.finally()`. When the mutation promise rejected, that detached promise could also reject and become an unhandled rejection.
- After: lock cleanup is performed in a `finally` block inside the same async IIFE that owns the mutation. The same promise object is returned to concurrent callers, rejected mutations re-throw the formatted error to the caller, and the lock is always cleared regardless of success or failure.

### Dead-code and mock cleanup summary

- Removed local-only Games mutation stubs and no-op Account/Capacity handlers from `useGames.tsx`.
- Removed the legacy `playSyncerMockData.ts` file and its `LegacyGame` / `games` array, which previously served as the Games runtime authority in earlier stages.
- Removed the unused `domain/games/stats.ts` module.
- Pruned stale comments referencing Stage B/C no-op logic.
- Did **not** delete Account or Capacity components, and did **not** connect legacy Account mock data to backend Games.

### Final CRUD regression evidence

- Synthetic CRUD Game: `fd5a4cf7-fba6-4e06-b8a5-33c5f3fa61cf` (title: `PS02B Stage D Test 2026-07-15T16:34:26Z`)
  - Created via `POST /api/games` → 201.
  - Duplicate title rejected with `409` and Persian error message.
  - Edited via `PATCH /api/games/:id` (title, platform, cover URL).
  - Cleared cover URL via `PATCH /api/games/:id` (`coverUrl: null`).
  - Status toggled `ACTIVE → INACTIVE → ACTIVE`, both states persisted.
  - Deleted via `DELETE /api/games/:id` → `200 {ok:true}`.
  - Verified list empty after deletion (`GET /api/games` → `{"games":[]}`).
- Synthetic detail Game: `c4971d2b-7ff5-40a8-9ac7-66ecd1e44e7f` (title: `PS02B Stage D Detail 2026-07-15T16:35:21Z`)
  - Created via `POST /api/games`.
  - Game Detail page displayed real metadata (title, platform, status, account count).
  - Deleted via `DELETE /api/games/:id`.
- UI screenshots captured for each stage: empty list, created, edited, cleared cover, inactive, active again, deleted, and detail page.

### Error and rapid-click evidence

- `GameFormModal` and `ConfirmDialog` retain synchronous `useRef` locks set before any `setState` or `await`.
- Escape, backdrop, close, and cancel handlers are disabled while the lock is held.
- `useGames` returns the in-flight promise for concurrent calls, so rapid clicks cannot produce a second logical mutation.
- Failed mutations re-throw a Persian-safe error and keep the modal or dialog open for retry.
- Browser console review showed no new errors or unhandled Promise rejections during any screenshot.

### Automated validation

- `pnpm run typecheck` — **PASS** (all packages clean).
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/playsyncer run build` — **PASS** (1759 modules, no errors).
- `pnpm --filter @workspace/api-server run test` — **PASS** (28/28 tests, including hard-delete with/without account history).

### Database impact statement

- No migrations, `drizzle-kit push`, direct SQL, schema changes, or rollback scripts were run in Stage D.
- All test writes went through the existing Games API.
- Only two synthetic Games were created and then deleted; no production, unknown, or Account/Capacity/Order data was modified.

### Remaining known limitations

- Account Workspace remains in the explicit pending-integration state.
- Capacity, Orders, Game Import, Authentication, and RBAC are outside the PS-02B scope.
- SmartSearch currently searches only Games.
- The published deployment URL may still need a fresh publish from the Replit Publishing pane to pick up the migrated database state.

### Rollback instructions

- Revert the changed frontend files to the Stage C2B state if needed.
- No database changes were made in Stage D; there is no DB rollback step.

### Final deliverables

- Exported ZIP: `playsyncer-ps02b-closed.zip`
- SHA-256: `0d6d3c8760395fd1b574957a8a42c6db5bc9466992d1ef68b1d2c45b44b7bb07`

### Stage boundaries

- PS-02B is marked **COMPLETED**.
- No next phase was started.
- No Account, Capacity, Orders, Game Import, Authentication, or RBAC work was implemented.

## 2026-07-15 — PS-02B Final Packaging Correction

- Recovered the exact pre-Stage-D `playSyncerMockData.ts` from Git history (commit `1aad29c`).
- Stored it as a non-runtime fixture at `fixtures/legacy/playSyncerMockData.ts` with a README.
- Confirmed the fixture is **not** imported by any runtime file under `artifacts/playsyncer/src`.
- Removed the stale `playsyncer-ps02b-closed.zip` package.
- Updated `docs/CURRENT_PHASE.md` to state that the legacy Account/Capacity mock data is preserved only as a non-runtime fixture.
- No runtime source changes, no database changes, and no next-phase work were performed.
- Final package: `playsyncer-ps02b-final.zip` (SHA-256 reported separately).
## 2026-07-16 — PS-03 Accounts Phase Activation

PS-02B — Games Frontend API Integration and Mock Authority Removal is completed.

The canonical PS-02B closure package is:

- file: `playsyncer-ps02b-final.zip`
- SHA-256: `d6a61547e1a61a7660278f2ed699cabe20eb57c21364c75543a3649773b80135`

PS-03 — Accounts Backend and Frontend Integration is now selected as the next product phase.

The first authorized stage is:

PS-03A — Accounts Contract and Current Source Audit

PS-03A is read-only.

No Account, Capacity, Backup Code, Customer Assignment, migration, database, OpenAPI or frontend implementation change is authorized during this stage.

The legacy Account, Capacity and Customer fixture remains stored at:

`fixtures/legacy/playSyncerMockData.ts`

This fixture is historical and non-runtime. It is not authoritative and must not be imported into the application.

The purpose of PS-03A is to reconcile the approved Source of Truth with the current schema, backend, frontend and security implementation, then propose the controlled PS-03 execution stages.

The WordPress Connector remains deferred until the core Account and Capacity flow is completed.

## 2026-07-16 — PS-03B Account Contract Decision Gate Closure

PS-03B — Account Contract Decision Gate has been reviewed, approved and closed.

This stage was decision-only.

No runtime source, migration, database, OpenAPI, generated-client or frontend implementation change was authorized or performed as part of PS-03B.

### Approved Decisions

#### D1 — Account Status Model

Account statuses are:

- `AVAILABLE`
- `PARTIALLY_SOLD`
- `SOLD`
- `INACTIVE`

`AVAILABLE` and `PARTIALLY_SOLD` are derived from Capacity and Assignment state.

`SOLD` and `INACTIVE` are manual persisted overrides.

`FINISHED` belongs exclusively to Capacity state and is not an Account status.

#### D2 — Account Identifiers

Global `accountCode` and the per-game display number become immutable after Account creation.

Identifier allocation must:

- be concurrency-safe
- use independent non-reusing sequences
- never use `MAX + 1`
- never reuse identifiers belonging to deleted Accounts

#### D3 — Duplicate Fields

Duplicate values are permitted for:

- PSN Email
- Online ID
- Family Management Email

The Backend must return a duplicate warning.

Create or update may proceed only after explicit confirmation from the caller.

#### D4 — Encryption and Lookup Scope

The following values must be encrypted at rest:

- PSN Email
- PSN Password
- Email Password
- Family Management Email
- Backup Codes
- Customer Phone

Exact normalized search and duplicate detection must use separate keyed lookup hashes.

Searchable plaintext credentials must not be stored.

#### D5 — Secret DTO and Reveal Policy

Generic Account DTOs must never include Secrets.

A separate Secret Reveal contract may be designed.

Runtime Reveal must remain disabled until the following exist and are verified:

- Authentication
- RBAC
- permission checks
- actor-based Audit Logging

#### D6 — Backup Codes

Each Backup Code must be stored as an independent encrypted record.

Allowed Backup Code statuses are:

- `AVAILABLE`
- `USED`
- `REVOKED`

Each Backup Code must have its own lookup hash.

Account creation requires at least one Backup Code.

#### D7 — Capacity Templates

Capacity rows are generated automatically from the approved Game Platform template.

Manual creation or deletion of Capacity rows is prohibited.

Z3 is shared between PS5 and PS4 according to the canonical Capacity template.

#### D8 — Capacity Completion

`FINISHED` is a manual, persisted and reversible Capacity state.

Finish and unfinish operations require authorization and actor-based Audit Logging before Runtime activation.

#### D9 — Customer Assignment Boundary

Customer Assignment remains outside Account Core.

The current `capacity_customers` structure must not become the final canonical Assignment contract.

Customer Assignment integration remains blocked until the Assignment and Fulfillment Unit model is approved.

#### D10 — Account Deletion and Retention

An Account with no current or historical Assignment may be hard-deleted through an authorized transactional workflow.

An Account with Assignment history must retain that history and may only be changed to `INACTIVE`.

#### D11 — API Authority

OpenAPI schemas and safe DTO boundaries are the authoritative Account API contract.

Backend routes and generated clients must conform to OpenAPI before frontend mutation integration.

#### D12 — Frontend Integration Order

Account Workspace integration must begin as read-only.

The following operations must be introduced only in later controlled stages:

- Create
- Update
- Disable
- Delete
- Capacity operations
- Secret Reveal

#### D13 — Search Model

Exact Account Core search through normalized keyed lookup hashes is approved.

Partial search over encrypted PSN Email or Family Management Email must not use:

- plaintext
- ordinary hashes
- unapproved searchable copies

Partial encrypted-field search remains deferred until a secure indexed-search design is separately approved.

### Stage Boundary

PS-03B does not authorize:

- migrations
- schema changes
- database writes
- Account CRUD implementation
- Customer Assignment integration
- Secret Reveal activation
- commencement of another implementation stage

The next authorized stage is:

PS-03C0 — Live Database Evidence and Migration Readiness

PS-03C0 is strictly read-only.