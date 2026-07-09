# Contributing to Trellis

Welcome to Trellis. This guide is the single source of truth for setting up the repository, running the baseline checks, claiming issues, and opening a reviewable pull request.

## 1. Prerequisites

Install and verify these tools before changing code:

- Rust stable toolchain, installed through `rustup`.
- The `wasm32-unknown-unknown` target for Soroban contract builds.
- `stellar` CLI 26.x or newer. Install docs: <https://developers.stellar.org/docs/tools/cli/install-cli>.
- Git.

Verify Rust and Git:

```bash
rustc --version
cargo --version
git --version
```

Install the Soroban WASM target:

```bash
rustup target add wasm32-unknown-unknown
```

Verify the Stellar CLI after installing it:

```bash
stellar --version
```

## 2. Fork and Clone

Fork `Trellis-Ecosystem/trellis` on GitHub, then clone your fork locally:

```bash
git clone https://github.com/<your-github-user>/trellis.git
cd trellis
```

Add the upstream remote so you can sync with the canonical repository:

```bash
git remote add upstream https://github.com/Trellis-Ecosystem/trellis.git
git remote -v
```

Before starting any task, update your local branch:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## 3. Project Structure

Trellis is a Rust workspace with a Soroban contract, a CLI, and a frontend scaffold.

```text
trellis/
├── contracts/trellis_core/  # Soroban smart contract crate
├── cli/trellis_cli/         # Rust CLI binary for contract workflows
├── frontend/                # React/Vite frontend scaffold
├── Cargo.toml               # Workspace manifest
├── DEPLOYMENT.md            # Testnet deployment and verification guide
└── README.md                # Product overview and quickstart
```

### `contracts/trellis_core`

This crate contains the escrow contract compiled to WASM for Soroban.

Files in `contracts/trellis_core/src/`:

- `types.rs` — shared contract data types, including `Agreement`, `Milestone`, and `EscrowStatus`.
- `storage.rs` — ledger storage helpers and `DataKey` access patterns.
- `errors.rs` — `TrellisError` variants returned by contract entrypoints.
- `events.rs` — event emission helpers used by off-chain consumers.
- `lib.rs` — the `#[contractimpl]` entrypoints and state-transition logic.
- `test.rs` — Soroban sandbox integration tests for the core contract lifecycle.

### `cli/trellis_cli`

This crate builds the `trellis` command-line binary. It wraps the Stellar CLI/Soroban RPC flow and exposes user-facing commands such as `init`, `lock-funds`, `submit-work`, `approve-release`, `raise-dispute`, `resolve-dispute`, `cancel-milestone`, and `status`.

Important files:

- `src/main.rs` — `clap` command parser and top-level dispatch.
- `src/config.rs` — environment-driven RPC, network, contract, and source-account configuration.
- `src/rpc.rs` — shell-out invocation layer and `InvokeOutput` handling.
- `src/commands/mod.rs` — command implementations.
- `src/utils.rs` — small CLI utility helpers.

## 4. Running the Contract Tests

Run the contract test suite before changing contract code:

```bash
cd contracts/trellis_core
cargo test
```

Exactly 5 tests should pass:

1. `test_happy_path` — covers `init -> lock_funds -> submit_work -> approve_and_release`, including payer/payee/contract balances.
2. `test_double_init_fails` — verifies the double-init guard returns `TrellisError::AlreadyInitialized` for an existing agreement ID.
3. `test_dispute_and_refund_to_payer` — covers a payee-raised dispute where the resolver refunds the payer.
4. `test_cancel_unfunded_milestone` — verifies an unfunded milestone can be cancelled once and cannot be cancelled a second time.
5. `test_get_agreement` — verifies `get_agreement` returns the stored agreement and rejects an unknown agreement ID.

If any baseline test fails, open an issue before continuing. Do not start feature, bug-fix, or documentation work on a broken baseline unless your assigned issue is specifically about that failure.

After running tests from inside `contracts/trellis_core`, return to the workspace root when you are done:

```bash
cd ../..
```

## 5. Building the CLI

Build the CLI from its crate directory:

```bash
cd cli/trellis_cli
cargo build --release
```

The compiled binary lands in the workspace root target directory, not inside the CLI crate:

- macOS/Linux: `target/release/trellis`
- Windows: `target/release/trellis.exe`

It does **not** land at `cli/trellis_cli/target/release/`.

Return to the workspace root after the build:

```bash
cd ../..
```

## 6. Understanding the State Machine

Read this before touching contract code. Trellis models each milestone as a state machine:

```text
Pending ──lock_funds──► Funded ──submit_work──► WorkSubmitted ──approve_and_release──► Completed
   │                       │                          │
   │                  raise_dispute              raise_dispute
   │                       └──────────────────────────┘
   │                                    │
cancel_unfunded                         ▼
   │                                Disputed
   │                            ┌───────┴────────┐
   │                            │                 │
   ▼                            ▼                 ▼
Cancelled              resolve_dispute      resolve_dispute
                        (refund payer)      (release payee)
                              │                   │
                              ▼                   ▼
                          Refunded            Completed
```

Transitions and entrypoints:

- `Pending -> Funded` is triggered by `lock_funds`. The payer deposits the milestone amount into the contract.
- `Pending -> Cancelled` is triggered by `cancel_unfunded_milestone`. The payer cancels a milestone that has never been funded.
- `Funded -> WorkSubmitted` is triggered by `submit_work`. The payee attaches proof of completed work.
- `Funded -> Disputed` is triggered by `raise_dispute`. Either payer or payee can request resolver review before work is submitted.
- `WorkSubmitted -> Completed` is triggered by `approve_and_release`. The payer accepts the work and funds are released to the payee.
- `WorkSubmitted -> Disputed` is triggered by `raise_dispute`. Either side can escalate submitted work for resolver review.
- `Disputed -> Refunded` is triggered by `resolve_dispute` when the resolver rules for the payer.
- `Disputed -> Completed` is triggered by `resolve_dispute` when the resolver rules for the payee.
- `get_agreement` is read-only. It does not transition state; it returns the current agreement snapshot.
- `init` creates the agreement and starts each milestone in `Pending`.

Never add a new transition or bypass an existing state without first discussing it in the linked issue.

## 7. How to Claim an Issue

1. Browse open issues and look for `good first issue` or `help wanted` labels.
2. Comment exactly: `I'd like to work on this`.
3. Wait for maintainer confirmation before opening a PR.
4. Do not open a PR for an issue nobody has confirmed you can work on.
5. If an issue has been claimed but shows no activity after its stated timeframe, comment asking whether it is still being worked on.

This avoids duplicated effort and keeps maintainers from reviewing competing solutions for the same small task.

## 8. Branch Naming

Use short, scoped branch names:

- `feat/short-description` for features.
- `fix/short-description` for bug fixes.
- `docs/short-description` for documentation.
- `test/short-description` for testnet verification tasks.

Examples:

```bash
git checkout -b feat/agreement-status-page
git checkout -b fix/dispute-resolution-edge-case
git checkout -b docs/contributing-guide
git checkout -b test/live-status-command
```

## 9. PR Requirements

All of the following must be true before requesting review:

- `cargo test` passes 5/5 in `contracts/trellis_core`.
- `cargo build` passes with zero warnings in both Rust crates you touched.
- The PR description explains what changed and why.
- The PR references the issue number using `Closes #X`.
- No files outside the linked issue's scope are changed.
- No changes are made to `contracts/trellis_core` unless the issue explicitly requires contract changes.
- No new dependencies are added without prior discussion in the issue thread.

Suggested final checks from the workspace root:

```bash
cargo test
cargo build --workspace
```

For contract-specific work, also run:

```bash
cd contracts/trellis_core
cargo test
cd ../..
```

For CLI-specific work, also run:

```bash
cd cli/trellis_cli
cargo build --release
cd ../..
```

## 10. Code Style

Follow the existing patterns in the file you edit. Do not introduce a new style in the same PR.

Rules:

- No commented-out code in PRs.
- No leftover `println!` debug statements in committed code.
- Contract code never uses `panic!`; return a `TrellisError` variant instead.
- CLI code follows the existing shell-out plus `InvokeOutput` pattern in `rpc.rs` unless the issue specifically asks you to change it.
- Keep Soroban contract code compatible with `#![no_std]` expectations.
- Prefer small, reviewable PRs over broad refactors.

Before committing Rust changes, format them:

```bash
cargo fmt
```

## 11. Getting Help

Use the right channel for the question:

- Open a GitHub Discussion for general questions about Trellis, Soroban, or contributor workflow.
- Comment directly on the issue you are working on for issue-specific questions.
- Tag the maintainer if you are blocked for more than 24 hours.

When asking for help, include:

- Your operating system.
- The command you ran.
- The full error output.
- The branch and issue number.
- What you already tried.
