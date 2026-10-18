# Data flow: one agreement, three layers

This traces a single read — `get_agreement` — from contract storage to the CLI's
JSON output and, separately, to the rendered agreement detail view in the
frontend. Line numbers are from the commit that introduced this doc; search for
the function name if they have drifted.

```
                        ┌──────────────────────────────┐
                        │ contract: get_agreement      │
                        │ contracts/trellis_core       │
                        └──────────────┬───────────────┘
                 simulateTransaction   │   (ScVal map / enum)
              ┌────────────────────────┴────────────────────────┐
              ▼                                                 ▼
 ┌──────────────────────────┐                     ┌──────────────────────────────┐
 │ CLI: `trellis status`    │                     │ frontend: useAgreement hook  │
 │ shells out to `stellar   │                     │ scValToNative → parse →      │
 │ contract invoke`, prints │                     │ Agreement → React components │
 │ the JSON envelope        │                     └──────────────────────────────┘
 └──────────────────────────┘
```

## Hop by hop

| # | Layer | Where | What happens |
|---|-------|-------|--------------|
| 1 | Contract | `contracts/trellis_core/src/types.rs` (`Agreement`, `Milestone`, `EscrowStatus`) | The `#[contracttype]` structs define the on-chain shape. |
| 2 | Contract | `contracts/trellis_core/src/lib.rs:867` `get_agreement` → `storage.rs:257` `read_agreement` | Reads the persistent entry and returns it, or a `TrellisError` if absent. |
| 3 | CLI | `cli/trellis_cli/src/commands/mod.rs:1570` `run_status` → `:2139` `execute` | Builds the invoke args and calls `get_agreement` through the Stellar CLI. |
| 4 | CLI | `cli/trellis_cli/src/commands/mod.rs` (`history_envelope` / JSON output) | Wraps the result in the `{status, result, tx_hash, events, error}` envelope. Use `--json`. |
| 5 | Frontend | `frontend/src/lib/soroban.ts:226` `simulateRead`, `:251` `getAgreement` | Simulates the same `get_agreement` call over RPC and decodes with `scValToNative`. |
| 6 | Frontend | `frontend/src/hooks/useAgreement.ts:22` `useAgreement` | Validates the response (`isValidAgreementResponse`), maps each milestone, and decodes status via `parseEscrowStatus` (`soroban.ts:132`) and `releasedAmountFor`. |
| 7 | Frontend | `frontend/src/pages/StatusPage.tsx:195,209` → `MilestoneRow` / `MilestoneCard` | Renders `milestone.status`, amount and proof link. |

## Worked example: a milestone's status

1. `EscrowStatus::WorkSubmitted` is stored in `Milestone.status` (hop 1–2).
2. It serialises as an enum ScVal. The CLI prints it as `{"WorkSubmitted":null}` (hop 3–4).
3. The frontend's `parseEscrowStatus` turns the decoded value into the string
   `'WorkSubmitted'`, which must be a member of the TypeScript `EscrowStatus`
   union (hop 5–6), and `MilestoneCard` renders it (hop 7).

Adding a status therefore touches `types.rs` and the frontend union.

## Keeping the layers in sync

The `Milestone`/`Agreement`/`EscrowStatus` shapes are hand-copied across layers.
`make check-types` (`scripts/check-type-consistency.py`, run in CI by
`.github/workflows/type-consistency.yml`) fails when a contract field or status
name has no counterpart in the frontend (and, for `Milestone` and the `init`
inputs, the CLI).

**Limitations:** it compares *names only* — not field types, order, or nesting —
so a retyped field still passes. It uses text matching, not the contract's
generated spec. Deliberate gaps are listed in `KNOWN_GAPS` in the script. A
fuller solution would generate the CLI and frontend types from the contract's
spec (`stellar contract bindings`); that is a larger follow-up.

To verify all three layers against a real deployment, run `make smoke-test`
(see [DEPLOYMENT.md](../DEPLOYMENT.md)).
