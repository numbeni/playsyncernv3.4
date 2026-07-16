# PS-03C0 — Supplemental Corrected Evidence and Migration Readiness Report

**Status:** PS-03C0 — AWAITING COMMAND CENTER REVIEW

**Scope:** Strictly read-only. No source files, documentation, migrations, database writes, or runtime changes were performed.

---

## 1. Read-Only Transaction Evidence

All corrected metadata queries were executed inside an explicit read-only transaction.

### SQL script used

```sql
BEGIN TRANSACTION READ ONLY;

SELECT jsonb_pretty(jsonb_build_object(
  'transaction_read_only', current_setting('transaction_read_only'),
  'row_counts', (SELECT jsonb_build_object(
    'games', (SELECT count(*) FROM games),
    'accounts', (SELECT count(*) FROM accounts),
    'account_backup_codes', (SELECT count(*) FROM account_backup_codes),
    'account_capacities', (SELECT count(*) FROM account_capacities),
    'capacity_customers', (SELECT count(*) FROM capacity_customers),
    'orders', (SELECT count(*) FROM orders)
  )),
  'indexes', (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.schemaname, i.tablename, i.indexname)
    FROM (
      SELECT schemaname, tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('games','accounts','account_backup_codes','account_capacities','capacity_customers','orders')
    ) i),
  'constraints', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.schema_name, c.table_name, c.type, c.name)
    FROM (
      SELECT n.nspname AS schema_name,
             c.relname AS table_name,
             con.conname AS name,
             CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'f' THEN 'FOREIGN KEY' ELSE con.contype::text END AS type,
             pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('games','accounts','account_backup_codes','account_capacities','capacity_customers','orders')
    ) c),
  'foreign_keys', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.source_table, f.constraint_name)
    FROM (
      SELECT n.nspname AS source_schema,
             c.relname AS source_table,
             con.conname AS constraint_name,
             (SELECT string_agg(a.attname, ', ' ORDER BY t.ord)
              FROM unnest(con.conkey) WITH ORDINALITY AS t(col, ord)
              JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = t.col) AS source_columns,
             nr.nspname AS referenced_schema,
             cr.relname AS referenced_table,
             (SELECT string_agg(a.attname, ', ' ORDER BY t.ord)
              FROM unnest(con.confkey) WITH ORDINALITY AS t(col, ord)
              JOIN pg_attribute a ON a.attrelid = cr.oid AND a.attnum = t.col) AS referenced_columns,
             CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE con.confdeltype::text END AS on_delete,
             CASE con.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE con.confupdtype::text END AS on_update
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_class cr ON cr.oid = con.confrelid
      JOIN pg_namespace nr ON nr.oid = cr.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('accounts','account_backup_codes','account_capacities','capacity_customers')
        AND con.contype = 'f'
    ) f),
  'migrations', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id)
    FROM (SELECT id, hash, created_at FROM drizzle."__drizzle_migrations") m)
)) AS result;

ROLLBACK;
```

### Sanitized terminal output

```
BEGIN
{
    "transaction_read_only": "on",
    "row_counts": {
        "games": 0,
        "orders": 0,
        "accounts": 0,
        "account_capacities": 0,
        "capacity_customers": 0,
        "account_backup_codes": 0
    },
    "indexes": [ ... ],
    "constraints": [ ... ],
    "foreign_keys": [ ... ],
    "migrations": [ ... ]
}
ROLLBACK
```

**Proof summary:**
- `transaction_read_only` returned `on`.
- The transaction ended with `ROLLBACK`.
- No writes or DDL were issued.

---

## 2. Corrected Index and Constraint Evidence

The previous report contained two catalog-rendering defects that are now corrected by querying the live PostgreSQL catalog directly.

### Corrected indexes

| Schema | Table | Index | Type | Definition |
|---|---|---|---|---|
| public | account_backup_codes | account_backup_codes_account_id_idx | INDEX | `CREATE INDEX account_backup_codes_account_id_idx ON public.account_backup_codes USING btree (account_id)` |
| public | account_backup_codes | account_backup_codes_pkey | PRIMARY KEY | `CREATE UNIQUE INDEX account_backup_codes_pkey ON public.account_backup_codes USING btree (id)` |
| public | account_capacities | account_capacities_account_id_idx | INDEX | `CREATE INDEX account_capacities_account_id_idx ON public.account_capacities USING btree (account_id)` |
| public | account_capacities | account_capacities_pkey | PRIMARY KEY | `CREATE UNIQUE INDEX account_capacities_pkey ON public.account_capacities USING btree (id)` |
| public | account_capacities | account_capacities_unique_slot | UNIQUE | `CREATE UNIQUE INDEX account_capacities_unique_slot ON public.account_capacities USING btree (account_id, capacity_kind, instance_no)` |
| public | accounts | accounts_account_code_idx | INDEX | `CREATE INDEX accounts_account_code_idx ON public.accounts USING btree (account_code)` |
| public | accounts | accounts_account_code_unique | UNIQUE | `CREATE UNIQUE INDEX accounts_account_code_unique ON public.accounts USING btree (account_code)` |
| public | accounts | accounts_deleted_at_idx | INDEX | `CREATE INDEX accounts_deleted_at_idx ON public.accounts USING btree (deleted_at)` |
| public | accounts | accounts_email_normalized_active_uniq | UNIQUE (partial) | `CREATE UNIQUE INDEX accounts_email_normalized_active_uniq ON public.accounts USING btree (email_normalized) WHERE (deleted_at IS NULL)` |
| public | accounts | accounts_game_id_idx | INDEX | `CREATE INDEX accounts_game_id_idx ON public.accounts USING btree (game_id)` |
| public | accounts | accounts_pkey | PRIMARY KEY | `CREATE UNIQUE INDEX accounts_pkey ON public.accounts USING btree (id)` |
| public | accounts | accounts_status_idx | INDEX | `CREATE INDEX accounts_status_idx ON public.accounts USING btree (status)` |
| public | capacity_customers | capacity_customers_active_assignment_uniq | UNIQUE (partial) | `CREATE UNIQUE INDEX capacity_customers_active_assignment_uniq ON public.capacity_customers USING btree (capacity_id, order_id) WHERE (status = 'active'::capacity_customer_status)` |
| public | capacity_customers | capacity_customers_capacity_id_idx | INDEX | `CREATE INDEX capacity_customers_capacity_id_idx ON public.capacity_customers USING btree (capacity_id)` |
| public | capacity_customers | capacity_customers_order_id_idx | INDEX | `CREATE INDEX capacity_customers_order_id_idx ON public.capacity_customers USING btree (order_id)` |
| public | capacity_customers | capacity_customers_phone_blind_idx | INDEX | `CREATE INDEX capacity_customers_phone_blind_idx ON public.capacity_customers USING btree (customer_phone_blind_index)` |
| public | capacity_customers | capacity_customers_pkey | PRIMARY KEY | `CREATE UNIQUE INDEX capacity_customers_pkey ON public.capacity_customers USING btree (id)` |
| public | capacity_customers | capacity_customers_status_idx | INDEX | `CREATE INDEX capacity_customers_status_idx ON public.capacity_customers USING btree (status)` |
| public | games | games_deleted_at_idx | INDEX | `CREATE INDEX games_deleted_at_idx ON public.games USING btree (deleted_at)` |
| public | games | games_pkey | PRIMARY KEY | `CREATE UNIQUE INDEX games_pkey ON public.games USING btree (id)` |
| public | games | games_status_idx | INDEX | `CREATE INDEX games_status_idx ON public.games USING btree (status)` |
| public | games | games_title_normalized_uniq | UNIQUE | `CREATE UNIQUE INDEX games_title_normalized_uniq ON public.games USING btree (title_normalized)` |
| public | orders | orders_deleted_at_idx | INDEX | `CREATE INDEX orders_deleted_at_idx ON public.orders USING btree (deleted_at)` |
| public | orders | orders_order_code_unique | UNIQUE | `CREATE UNIQUE INDEX orders_order_code_unique ON public.orders USING btree (order_code)` |
| public | orders | orders_pkey | PRIMARY KEY | `CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)` |
| public | orders | orders_source_idx | INDEX | `CREATE INDEX orders_source_idx ON public.orders USING btree (source)` |
| public | orders | orders_status_idx | INDEX | `CREATE INDEX orders_status_idx ON public.orders USING btree (status)` |

### Corrected constraints

| Schema | Table | Constraint | Type | Definition |
|---|---|---|---|---|
| public | account_backup_codes | account_backup_codes_account_id_accounts_id_fk | FOREIGN KEY | `FOREIGN KEY (account_id) REFERENCES accounts(id)` |
| public | account_backup_codes | account_backup_codes_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |
| public | account_capacities | account_capacities_account_id_accounts_id_fk | FOREIGN KEY | `FOREIGN KEY (account_id) REFERENCES accounts(id)` |
| public | account_capacities | account_capacities_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |
| public | account_capacities | account_capacities_unique_slot | UNIQUE | `UNIQUE (account_id, capacity_kind, instance_no)` |
| public | accounts | accounts_game_id_games_id_fk | FOREIGN KEY | `FOREIGN KEY (game_id) REFERENCES games(id)` |
| public | accounts | accounts_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |
| public | accounts | accounts_account_code_unique | UNIQUE | `UNIQUE (account_code)` |
| public | capacity_customers | capacity_customers_capacity_id_account_capacities_id_fk | FOREIGN KEY | `FOREIGN KEY (capacity_id) REFERENCES account_capacities(id)` |
| public | capacity_customers | capacity_customers_order_id_orders_id_fk | FOREIGN KEY | `FOREIGN KEY (order_id) REFERENCES orders(id)` |
| public | capacity_customers | capacity_customers_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |
| public | games | games_title_max_length | CHECK | `CHECK ((length(title) <= 120))` |
| public | games | games_title_normalized_max_length | CHECK | `CHECK ((length(title_normalized) <= 120))` |
| public | games | games_title_normalized_not_blank | CHECK | `CHECK ((length(TRIM(BOTH FROM title_normalized)) > 0))` |
| public | games | games_title_not_blank | CHECK | `CHECK ((length(TRIM(BOTH FROM title)) > 0))` |
| public | games | games_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |
| public | orders | orders_pkey | PRIMARY KEY | `PRIMARY KEY (id)` |
| public | orders | orders_order_code_unique | UNIQUE | `UNIQUE (order_code)` |

### Correction notes
- `account_backup_codes_pkey` is now confirmed on `public.account_backup_codes`, not `public.accounts`.
- `account_capacities_pkey` is now correctly named and distinct from the foreign-key constraint.

---

## 3. Live Foreign-Key Action Evidence

The live catalog confirms the following foreign-key actions for every Account-related relationship.

| Source table | Source column | Referenced table | Referenced column | ON DELETE | ON UPDATE |
|---|---|---|---|---|---|
| accounts | game_id | games | id | NO ACTION | NO ACTION |
| account_backup_codes | account_id | accounts | id | NO ACTION | NO ACTION |
| account_capacities | account_id | accounts | id | NO ACTION | NO ACTION |
| capacity_customers | capacity_id | account_capacities | id | NO ACTION | NO ACTION |
| capacity_customers | order_id | orders | id | NO ACTION | NO ACTION |

All values were obtained directly from `pg_constraint` (`confdeltype` and `confupdtype`), not inferred from the migration files.

---

## 4. Repository vs. Applied Migration Hash Evidence

### Terminal output

```
a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca  lib/db/migrations/0000_zippy_leech.sql
c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2  lib/db/migrations/0001_glossy_onslaught.sql
```

### Comparison table

| Repository filename | Repository SHA-256 | Applied migration id | Applied migration hash | Exact match |
|---|---|---|---|---|
| `lib/db/migrations/0000_zippy_leech.sql` | `a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca` | 1 | `a43ab14cacf73a107d5c115c2025dc56de3537efe4d409ca65c79e48a8aa07ca` | ✅ yes |
| `lib/db/migrations/0001_glossy_onslaught.sql` | `c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2` | 2 | `c09f28b3895fa3ee2732f42438d55e4ad136a02d485386bfe001c4530d14c4c2` | ✅ yes |

Both repository migrations are applied and verified by hash.

---

## 5. Confirmed Database Row-Count Conclusion

The database reached by the active Replit workspace `DATABASE_URL` is empty for all Account-related tables.

| Table | Row count |
|---|---|
| games | 0 |
| accounts | 0 |
| account_backup_codes | 0 |
| account_capacities | 0 |
| capacity_customers | 0 |
| orders | 0 |

No Account, Backup Code, Capacity, Customer, or Order data exists. Therefore, no data-migration blocker exists for the next approved schema stage.

---

## 6. Corrected Identifier-Readiness Decision

The approved Account identifier model is preserved:

- One **global Account code**, e.g. `ACC-000001`.
- One **per-game display number**, e.g. `GOW-001`.

Both identifiers must:

- Be created once at Account creation.
- Be immutable after creation.
- Never be reused, including after Account deletion.
- Use concurrency-safe allocation.
- Never use `MAX + 1`.

The current schema already has:
- `accounts.account_code` with a unique constraint.
- `accounts.account_number_prefix`, `accounts.account_number_seq`, and `accounts.display_number`.

The schema is missing:
- A concurrency-safe global counter/sequence for `account_code`.
- A concurrency-safe per-game counter/sequence for `account_number_seq` / `display_number`.
- A DB-level immutability guard for `account_code`, `account_number_prefix`, `account_number_seq`, and `display_number`.
- A unique constraint on `(game_id, account_number_seq)`.
- A unique constraint on `(game_id, display_number)`.

These are identified as migration-readiness requirements only; no implementation is performed in PS-03C0.

---

## 7. Finalized Account Effective-Status Rules

The authoritative effective Account status rules are:

### INACTIVE
- A manual persisted override.
- Highest priority.
- When an Account is manually `INACTIVE`, its effective status remains `INACTIVE` regardless of Capacity states.

### SOLD
- Can occur in two ways:
  1. A manual persisted `SOLD` override.
  2. All Capacities belonging to the Account are `FINISHED`.
- When all Capacities are `FINISHED`, the effective Account status automatically becomes `SOLD`.
- If the automatic `SOLD` state was caused only by all Capacities being `FINISHED`, and one Capacity later leaves `FINISHED`, the Account must automatically leave `SOLD` and be recalculated.
- It remains `SOLD` only while a manual `SOLD` override also exists.

### AVAILABLE
- The effective Account status is `AVAILABLE` only when all of its Capacities are `AVAILABLE`.

### PARTIALLY_SOLD
- The effective Account status is `PARTIALLY_SOLD` when:
  - At least one Capacity is `ASSIGNED` or `FINISHED`, and
  - Not all Capacities are `FINISHED`, and
  - There is no manual `SOLD` override, and
  - There is no manual `INACTIVE` override.

Examples:
- `AVAILABLE + AVAILABLE + AVAILABLE` → `AVAILABLE`
- `AVAILABLE + ASSIGNED + AVAILABLE` → `PARTIALLY_SOLD`
- `AVAILABLE + FINISHED + AVAILABLE` → `PARTIALLY_SOLD`
- `ASSIGNED + ASSIGNED + ASSIGNED` → `PARTIALLY_SOLD`
- `FINISHED + FINISHED + FINISHED` → `SOLD` automatically

Key schema implication:
- The persisted Account override field must contain only `SOLD`, `INACTIVE`, or `NULL` when no manual override exists.
- `AVAILABLE` and `PARTIALLY_SOLD` must never be persisted as manual override values.
- `FINISHED` is a Capacity state, not a persisted Account status.

Customer Assignment implementation remains outside Account Core. The dependency on the `ASSIGNED` state is recorded only as a schema implication, not as a redesign of Assignment.

---

## 8. Corrected Phased Migration-Readiness Recommendation

The complete Account contract transition must **not** be placed into one large migration. The recommended sequence is:

### Stage A — Additive Foundation
Introduce only new structures, leaving legacy columns temporarily in place:

- New encrypted-value columns for PSN Email, PSN Password, Email Password, and Family Management Email.
- Separate keyed lookup-hash columns for each of those fields, plus for Backup Codes.
- A nullable `SOLD`/`INACTIVE` manual override column on `accounts` (no `AVAILABLE` or `PARTIALLY_SOLD` values).
- Backup Code lifecycle fields: `status` (`AVAILABLE`/`USED`/`REVOKED`) and lookup hash.
- Capacity `FINISHED` state fields.
- Shared Z3 representation (e.g., `Z3_SHARED_PS5_PS4`) and template adjustment so `PS4_ONLY` Accounts receive the Shared Z3 capacity.
- Concurrency-safe identifier allocation structures.
- Required unique constraints for `account_code` and per-game identifiers.
- Required non-unique lookup indexes for duplicate-permitted fields (PSN Email, Online ID, Family Management Email).

### Stage B — Runtime Cutover and Constraint Enforcement
Performed only after Stage A is approved and verified:

- Move read/write paths to the new contract.
- Enforce encryption and keyed lookup hashes.
- Enforce immutable identifiers.
- Enforce at least one Backup Code at Account creation.
- Activate safe DTO boundaries (no Backup Codes in generic Account DTOs).
- Verify OpenAPI and generated-client parity.

### Stage C — Legacy Cleanup
Performed only after runtime evidence confirms the new contract is authoritative:

- Remove legacy plaintext columns (e.g., `email`, `email_normalized`).
- Remove obsolete status fields and enum values.
- Remove obsolete indexes (e.g., the overly restrictive `accounts_email_normalized_active_uniq` once the application no longer depends on it).
- Remove deprecated write paths.

Customer Assignment and Customer Phone encryption remain outside Account Core and are deferred to the approved Assignment stage.

---

## 9. Remaining Blockers

### Data blockers
None. The database is empty, so no data backfill or reconciliation is required.

### Schema blockers
1. **Account status override:** The current `account_status` enum (`active`/`disabled`) and the non-nullable `accounts.status` column do not match the approved `SOLD`/`INACTIVE`/`NULL` override model. A nullable override column is required.
2. **Identifier allocation:** No concurrency-safe global or per-game allocation mechanism exists; no DB-level immutability guard exists for identifiers.
3. **Identifier unique constraints:** Missing unique constraints on `(game_id, account_number_seq)` and `(game_id, display_number)`.
4. **Duplicate-permitted field indexes:** The current `accounts_email_normalized_active_uniq` partial unique index is incompatible with the approved duplicate-warning behavior. Lookup-hash indexes for PSN Email, Online ID, and Family Management Email must be non-unique.
5. **Encryption and lookup hashes:** No encrypted-value columns or separate keyed lookup-hash columns exist for PSN Email, PSN Password, Email Password, Family Management Email, or Backup Codes.
6. **Backup Code lifecycle:** `account_backup_codes` lacks `status` (`AVAILABLE`/`USED`/`REVOKED`) and a lookup-hash column.
7. **Capacity FINISHED state:** `account_capacities` lacks a persisted `FINISHED` state.
8. **Shared Z3 Capacity:** The `capacity_kind` enum value `Z3_PS5` does not represent the approved `Z3_SHARED_PS5_PS4` concept; `PS4_ONLY` Accounts must receive the Shared Z3 capacity.
9. **Customer Assignment boundary:** `capacity_customers` must not become the canonical Assignment contract. Customer Phone encryption and lookup hash remain a deferred security obligation outside Account Core.

### Operational note
The Drizzle migration table is located in `drizzle.__drizzle_migrations` (not in the `public` schema). This is not a blocker, but migration tooling must reference it correctly.

---

## 10. Final PS-03C0 Recommendation

- ✅ The active Replit workspace database was inspected using read-only PostgreSQL catalog queries.
- ✅ The transaction was explicitly `READ ONLY` and ended with `ROLLBACK`; no writes or DDL occurred.
- ✅ Both Drizzle migrations (`0000_zippy_leech.sql`, `0001_glossy_onslaught.sql`) are applied and verified by hash.
- ✅ All Account-related tables exist and are empty.
- ✅ Foreign-key actions are confirmed as `NO ACTION` on delete and update for all Account-related relationships.
- ✅ No data blockers exist.
- ⚠️ The schema still contains material drift from the approved PS-03B contract, corrected for: Account status override, identifier allocation, duplicate-permitted lookup indexes, encryption/lookup-hash scope, Backup Code lifecycle, Capacity FINISHED state, Shared Z3 representation, and Customer Assignment boundary.

**PS-03C0 remains AWAITING COMMAND CENTER REVIEW. It is not closed.**
