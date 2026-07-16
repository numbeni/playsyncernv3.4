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
