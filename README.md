<div align="center">

<img src="assets/banner.png" alt="Trellis — Milestone Escrow on Soroban" width="100%" />

# Trellis

**Trustless, milestone-based escrow for freelance and remote work — built on Stellar's Soroban smart contract platform.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Rust](https://img.shields.io/badge/rust-stable-orange?logo=rust)]()
[![Soroban](https://img.shields.io/badge/soroban-sdk%2021.x-blue)]()
[![License](https://img.shields.io/badge/license-TBD-lightgrey)]()
[![Status](https://img.shields.io/badge/status-active%20development-yellow)]()

</div>

---

## The Problem

Remote work and freelance contracting run on trust that often doesn't exist between strangers across borders. Clients hesitate to pay upfront. Workers hesitate to deliver without payment guarantees. The usual fix — a centralized escrow middleman — adds fees, delays, and a single point of failure.

**Trellis removes the middleman.** Funds are locked on-chain, released milestone by milestone as work is verified, with a built-in dispute process if either party disagrees. No platform holds your money. The contract does.

This matters everywhere, but especially for contributors in emerging markets — where access to reliable, low-fee, borderless payment infrastructure can be the difference between taking on international work or not.

---

## How It Works

Trellis models a freelance engagement as an **agreement** made up of one or more **milestones**, each with its own funding, work submission, and release lifecycle.

```
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

**The roles:**

- **Payer** — funds milestones and approves completed work
- **Payee** — submits proof of completed work and receives payment on approval
- **Dispute Resolver** — a neutral third party who can rule on disputes, releasing funds to either side

**The guarantees:**

- Funds are held by the contract, not by either party or a platform
- Either the payer *or* the payee can raise a dispute — neither party can unilaterally freeze the other's funds by going silent
- Unfunded milestones can be cancelled and walked away from cleanly
- Every state transition emits an on-chain event, so off-chain clients (dashboards, notifications, GrantFox-style activity feeds) can track progress in real time without polling contract state

---

## Architecture

Trellis is a Cargo workspace with two crates:

```
trellis/
├── contracts/trellis_core/      # Soroban smart contract (Rust → WASM)
│   └── src/
│       ├── lib.rs                # Contract entrypoints (#[contractimpl])
│       ├── types.rs               # Agreement, Milestone, EscrowStatus
│       ├── storage.rs             # Ledger read/write helpers (DataKey)
│       ├── errors.rs              # TrellisError enum
│       ├── events.rs              # Event emitters for off-chain consumers
│       └── test.rs                # Integration tests (Soroban sandbox)
│
└── cli/trellis_cli/              # Command-line interface
    └── src/
        ├── main.rs                # clap entrypoint
        ├── config.rs              # Network config (RPC URL, contract ID, keys)
        ├── rpc.rs                  # Soroban RPC / stellar CLI wrapper
        └── commands/               # Subcommand implementations
```

### Contract entrypoints

| Function | Caller | Effect |
|---|---|---|
| `init` | Payer | Creates a new agreement with one or more milestones |
| `lock_funds` | Payer | Deposits funds for a milestone into the contract |
| `submit_work` | Payee | Submits proof of completed work for a funded milestone |
| `approve_and_release` | Payer | Approves submitted work, releases funds to payee |
| `raise_dispute` | Payer or Payee | Flags a milestone for resolver review |
| `resolve_dispute` | Dispute Resolver | Rules on a dispute — refunds payer or pays payee |
| `cancel_unfunded_milestone` | Payer | Cancels a milestone that was never funded |

### Tech stack

- **[Soroban](https://developers.stellar.org/docs/build/smart-contracts)** — Stellar's Rust-based smart contract platform (`#![no_std]`, compiles to WASM)
- **soroban-sdk 21.x** — contract types, storage, auth, and token interfaces
- **clap 4** (derive) — CLI argument parsing
- **tokio** — async runtime for the CLI

Why Soroban: contracts are written in real Rust, compiled to WASM, and run on the Stellar network — which has fast finality, low fees, and an established USDC presence (via Circle's Stellar Asset Contract), making it well-suited for cross-border payment use cases like this one.

---

## Quickstart

### Prerequisites

- Rust (stable toolchain)
- [`stellar` CLI](https://developers.stellar.org/docs/tools/cli/install-cli) (for contract deployment and CLI interaction)
- A funded Soroban testnet account ([friendbot](https://developers.stellar.org/docs/tools/quickstart#friendbot))

### Build and test the contract

```bash
cd contracts/trellis_core
cargo test
```

All core flows — happy path, double-init protection, dispute resolution, and unfunded milestone cancellation — are covered by integration tests running in the Soroban sandbox.

### Build the contract for deployment

```bash
cd contracts/trellis_core
stellar contract build
```

### CLI usage

```bash
cd cli/trellis_cli
cargo build

# Set up environment (or use defaults for testnet)
export STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export TRELLIS_CONTRACT_ID="<your deployed contract ID>"
export TRELLIS_SOURCE_KEY="<your secret key>"

# Create a new agreement
trellis init \
  --agreement-id <hex-id> \
  --payer <payer-address> \
  --payee <payee-address> \
  --token <token-contract-address> \
  --resolver <resolver-address> \
  --milestones "1000,2000"

# Fund the first milestone
trellis lock-funds --agreement-id <hex-id> --milestone-id 0
```

---

## Project Status

Trellis is in **active development**. Here's where things stand:

### ✅ Done

- Core escrow contract — all 7 entrypoints implemented and tested
- Full state machine including dispute resolution and cancellation paths
- Integration test suite covering happy path, error cases, and edge cases
- CLI Phase 1 — `init` and `lock-funds` working end-to-end

### 🚧 Open for contribution

The CLI has working `init` and `lock-funds` commands. The remaining commands are stubbed and ready to be implemented — each is a self-contained, well-scoped task that maps directly to an existing, tested contract entrypoint:

| Command | Maps to | Difficulty |
|---|---|---|
| `submit-work` | `submit_work` entrypoint | Good first issue |
| `approve-release` | `approve_and_release` entrypoint | Good first issue |
| `raise-dispute` | `raise_dispute` entrypoint | Good first issue |
| `resolve-dispute` | `resolve_dispute` entrypoint | Good first issue |
| `cancel-milestone` | `cancel_unfunded_milestone` entrypoint | Good first issue |
| `status` | Read-only agreement query | Good first issue |

Beyond the CLI, future directions include:

- A native Rust Soroban RPC client (replacing the current `stellar` CLI shell-out)
- Web dashboard for tracking agreement status and events
- Multi-milestone batch operations
- Integration examples for common freelance platform workflows

See [Issues](../../issues) for current open tasks.

---

## Contributing

Trellis is built in the open and welcomes contributors of all experience levels — from CLI commands (good first issues above) to contract enhancements and tooling.

1. Fork the repo and clone it locally
2. Check [open issues](../../issues) for tasks tagged `good first issue` or `help wanted`
3. Run `cargo test` in `contracts/trellis_core` to confirm your environment is set up correctly
4. Open a PR — include a description of what you changed and why

If you're new to Soroban, the [official Soroban docs](https://developers.stellar.org/docs/build/smart-contracts/overview) and the `soroban-examples` repo are great references for conventions used throughout this codebase.

---

## License

License: **TBD** — to be finalized before first external contributions are merged.

---

<div align="center">

Built by ALLEN GrantFox open-source ecosystem

</div>
