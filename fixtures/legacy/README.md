# Legacy Fixtures

This directory contains non-runtime historical fixtures preserved for future reference only.

## `playSyncerMockData.ts`

- This is a **non-runtime historical fixture**.
- It is **not a Games data authority**.
- It **must not be imported by the frontend** runtime.
- It is preserved **only for the future Account/Capacity integration phase**.

This file contains the original Account, Capacity, and Customer mock data used before the PS-02B backend integration. It is intentionally kept outside `artifacts/playsyncer/src` so it does not participate in the frontend build or runtime.
