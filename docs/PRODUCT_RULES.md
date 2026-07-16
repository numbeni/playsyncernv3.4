# PlaySyncer Core Product Rules

## Games

Platforms:

- `PS5_ONLY`
- `PS4_ONLY`
- `PS4_AND_PS5`

Rules:

- Account platform is inherited from the Game.
- Game platform cannot change after the first Account exists.
- Game statuses: `ACTIVE`, `INACTIVE`.
- Hard delete is allowed only when no Account or Order history exists.
- Otherwise use `INACTIVE`.

## Accounts

Required fields:

- PSN Email
- PSN Password
- Email Password
- Online ID
- Birth Date
- Family Management Email
- At least one Backup Code

Identifiers:

- global immutable code such as `ACC-000128`
- game-specific code such as `FC26-001`
- numbers are never reused
- do not use `MAX + 1`

Statuses:

- `AVAILABLE`
- `PARTIALLY_SOLD`
- `SOLD`
- `INACTIVE`

`SOLD` and `INACTIVE` block new assignments.

Duplicate PSN Email, Online ID, and Family Email are allowed only with warning and explicit confirmation.

## Capacities

### PS5_ONLY

- `Z2 PS5 #1`
- `Z2 PS5 #2`
- `Z3 PS5/PS4`

### PS4_ONLY

- `Z2 PS4`
- `Z3 PS5/PS4`

### PS4_AND_PS5

- `Z2 PS5 #1`
- `Z2 PS5 #2`
- `Z2 PS4`
- `Z3 PS5/PS4`

`Z3 PS5/PS4` is one shared Capacity record.

Capacity statuses:

- `AVAILABLE`
- `ASSIGNED`
- `FINISHED`

A Capacity may have multiple active customer assignments. `FINISHED` blocks new assignments.

## Orders

Canonical structure:

- Store
- Order
- Order Item
- Fulfillment Unit
- Assignment
- Delivery Batch

Rules:

- `Store + External Order ID` is unique.
- Quantity creates multiple Fulfillment Units.
- Each Fulfillment Unit has at most one active Assignment.
- All units must be assigned before Push.
- Partial Push is forbidden.
- Push is manually triggered by an admin.
- Delivery becomes final only after connector confirmation.

## Security

- Passwords and Backup Codes must not remain plaintext in the final implementation.
- Exact sensitive search must use a keyed lookup hash.
- Sensitive values must not appear in logs or generic API responses.
## PS-03 Account Core Rules

The following rules are authoritative for the PlaySyncer Account Core.

### Account Status

Allowed Account statuses are:

- `AVAILABLE`
- `PARTIALLY_SOLD`
- `SOLD`
- `INACTIVE`

`AVAILABLE` and `PARTIALLY_SOLD` are derived from Capacity and Assignment state.

`SOLD` and `INACTIVE` are persisted manual overrides.

`FINISHED` is a Capacity state and must never be used as an Account status.

### Account Identifiers

Each Account has:

- a global immutable `accountCode`
- an immutable per-game display number

Identifiers must be allocated using concurrency-safe and non-reusing sequences.

`MAX + 1` allocation is prohibited.

Deleted identifiers must not be reused.

### Duplicate Account Fields

Duplicate values are allowed for:

- PSN Email
- Online ID
- Family Management Email

The Backend must detect duplicates and return a warning.

Create or update requires explicit confirmation when a duplicate warning exists.

Duplicate detection must not expose another Account's Secret data.

### Sensitive Data

The following fields must be encrypted at rest:

- PSN Email
- PSN Password
- Email Password
- Family Management Email
- Backup Codes
- Customer Phone

Exact normalized search and duplicate detection must use separate keyed lookup hashes.

Plaintext searchable credential copies are prohibited.

### Safe DTO Rules

Generic Account list, summary and detail DTOs must not contain Secrets.

Secret Reveal must use a separate contract.

Secret Reveal must remain disabled until Authentication, RBAC, permission checks and actor-based Audit Logging exist.

### Backup Codes

Each Backup Code is an independent record.

Allowed statuses are:

- `AVAILABLE`
- `USED`
- `REVOKED`

Backup Codes must be encrypted and have separate keyed lookup hashes.

At least one Backup Code is required when an Account is created.

### Capacity Templates

Capacity rows are generated automatically from the Game Platform.

Manual Capacity creation and deletion are prohibited.

Approved templates are:

#### PS5_ONLY

- Z2 PS5 — instance 1
- Z2 PS5 — instance 2
- Shared Z3 PS5/PS4

#### PS4_ONLY

- Z2 PS4
- Shared Z3 PS5/PS4

#### PS4_AND_PS5

- Z2 PS5 — instance 1
- Z2 PS5 — instance 2
- Z2 PS4
- Shared Z3 PS5/PS4

### Capacity FINISHED State

`FINISHED` is a manual, persisted and reversible Capacity state.

Finish and unfinish operations require authorization and actor-based Audit Logging before Runtime activation.

Capacity rows must not be manually added or deleted.

### Customer Assignment Boundary

Customer Assignment is outside Account Core.

The current `capacity_customers` structure is not the final canonical Assignment contract.

Assignment integration must wait for the approved Assignment and Fulfillment Unit model.

### Account Delete and Retention

An Account with no current or historical Assignment may be hard-deleted through an authorized transactional operation.

An Account with Assignment history must not be hard-deleted.

It must retain its history and may only be changed to `INACTIVE`.

### API Authority

OpenAPI is the authoritative Account API contract.

Safe DTOs must be defined before Backend and generated-client implementation.

Runtime routes, generated clients and frontend integration must conform to the approved OpenAPI contract.

### Frontend Integration Order

Account Workspace must first be connected in read-only mode.

Mutations must be added later through controlled stages.

Secret Reveal must not be enabled as part of the initial Account Workspace integration.

### Account Search

Exact normalized search through keyed lookup hashes is allowed.

Partial search over encrypted PSN Email or Family Management Email is deferred.

Partial search must not be implemented using plaintext or ordinary hashes.