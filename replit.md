# PlaySyncer

PlayStation account subscription management platform — tracks games, shared accounts, capacity slots, and customer order assignments.

## Run & Operate

- `pnpm --filter @workspace/playsyncer run dev` — frontend dev server (React/Vite)
- `pnpm --filter @workspace/api-server run dev` — API server (Express 5, port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **API:** Express 5, Zod validation, pino logging
- **DB:** PostgreSQL (Replit-managed) + Drizzle ORM 0.45
- **Frontend:** React 19, Vite 7, TailwindCSS 4, React Router, TanStack Query
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API codegen:** Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- **Build:** esbuild (CJS bundle for api-server)

## Where things live

```
artifacts/
  playsyncer/       React frontend (mock state, no DB yet)
  api-server/       Express API — routes in src/routes/
  mockup-sandbox/   Component preview sandbox (Canvas)

lib/
  db/               Drizzle schema + helpers
    src/schema/     enums.ts, admins, games, accounts, account-backup-codes,
                    account-capacities, orders, capacity-customers, audit-logs
    src/helpers/    order-code.ts, account-number.ts, capacity-definitions.ts
  api-spec/         openapi.yaml (source of truth for codegen)
  api-zod/          Orval-generated Zod schemas (server-side)
  api-client-react/ Orval-generated React Query hooks (frontend)
```

## API Routes (all under /api)

| Method | Path | Description |
|--------|------|-------------|
| GET | /healthz | Health check |
| GET | /games | List games with account count |
| POST | /games | Create game |
| GET | /games/:id | Get single game |
| PATCH | /games/:id | Update game |
| DELETE | /games/:id | Soft delete game |
| GET | /games/:gameId/accounts | List accounts for game |
| POST | /games/:gameId/accounts | Create account + auto-generate capacity slots |
| GET | /accounts/:id | Account detail with capacities + backup codes |
| PATCH | /accounts/:id | Update account |
| DELETE | /accounts/:id | Soft delete account |
| GET | /accounts/:accountId/capacities | Capacity slots with active customers |
| POST | /capacities/:capacityId/customers | Assign customer to slot |
| PATCH | /capacities/:capacityId/customers/:id | Edit customer assignment |
| DELETE | /capacities/:capacityId/customers/:id | Soft-remove customer |
| GET | /orders | List orders |
| GET | /orders/:id | Get single order |
| POST | /orders | Create order (normalizes order code) |

## Database schema

8 tables: `admins`, `games`, `accounts`, `account_backup_codes`, `account_capacities`, `orders`, `capacity_customers`, `audit_logs`

Key constraints:
- `accounts.email_normalized`: partial unique WHERE `deleted_at IS NULL`
- `capacity_customers(capacity_id, order_id)`: partial unique WHERE `status = 'active'`
- `account_capacities(account_id, capacity_kind, instance_no)`: unique constraint

## Capacity rules (fixed — do not change)

| Platform | Slots |
|----------|-------|
| PS5_ONLY | Z2 PS5 #1, Z2 PS5 #2, Z3 PS5 |
| PS4_AND_PS5 | Z2 PS5 #1, Z2 PS5 #2, Z2 PS4, Z3 PS5 |
| PS4_ONLY | Z2 PS4 |

`instanceNo`: Z2_PS5 uses 1/2, singletons use 0.

## Architecture decisions

- **Soft deletes everywhere** — `deleted_at` timestamp, never hard delete
- **Encrypted column naming** — `*Encrypted` suffix for sensitive fields; actual encryption not yet wired (plaintext stored in dev)
- **Order code normalization** — `ORD-<number>` canonical form, no leading zeros; `normalizeOrderCode()` in `lib/db/src/helpers/order-code.ts`
- **Persistent capacity slots** — created once on account registration; platform changes do NOT regenerate slots
- **accountCode globally unique** — `ACC-000001` format; `displayNumber` = `#PREFIX-001`
- **Partial unique index via Drizzle** — uses `.where(sql\`...\`)` syntax, compatible with drizzle-kit 0.31+

## Environment variables required

- `DATABASE_URL` — Postgres connection string (auto-provided by Replit)
- `PORT` — server port (auto-provided by Replit per artifact)
- `BASE_PATH` — URL base path (auto-provided by Replit per artifact)
- `SESSION_SECRET` — session signing secret

## Gotchas

- `pnpm run build` for playsyncer/api-server requires `PORT` and `BASE_PATH` env vars (injected by Replit workflow system; cannot run `build` standalone)
- `lib/db` uses `"type": "module"` — esbuild handles import resolution at api-server build time
- `req.params` in Express 5 types is `string | string[]` — use the `p()` helper from `src/lib/req-param.ts`
- `nextAccountCode()` and `nextSeqForGame()` in accounts.ts are race-condition-prone under concurrent load — replace with PostgreSQL sequences before production

## User preferences

_Populate as you build._

## Pointers

- See `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Drizzle push: `pnpm --filter @workspace/db run push` (dev only, requires DATABASE_URL)
