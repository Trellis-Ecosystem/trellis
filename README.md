<div align="center">

<img src="assets/banner.png" alt="Trellis — Milestone Escrow on Soroban" width="100%" />

# Trellis

**Trustless, milestone-based escrow for freelance and remote work — built on Stellar's Soroban smart contract platform.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Rust](https://img.shields.io/badge/rust-stable-orange?logo=rust)]()
[![Soroban](https://img.shields.io/badge/soroban-sdk%2022.x-blue)]()
[![Deployed](https://img.shields.io/badge/testnet-live-success)]()
[![License](https://img.shields.io/badge/license-TBD-lightgrey)]()
[![Status](https://img.shields.io/badge/status-active%20development-yellow)]()

</div>

---

## The Problem
...

Remote work and freelance contracting run on trust that often doesn't exist between strangers across borders. Clients hesitate to pay upfront. Workers hesitate to deliver without payment guarantees. The usual fix — a centralized escrow middleman — adds fees, delays, and a single point of failure.

**Trellis removes the middleman.** Funds are locked on-chain, released milestone by milestone as work is verified, with a built-in dispute process if either party disagrees. No platform holds your money. The contract does.

This matters everywhere, but especially for contributors in emerging markets — where access to reliable, low-fee, borderless payment infrastructure can be the difference between taking on international work or not.

---

## Live on Testnet

Trellis is deployed and working on Stellar testnet right now.

| | |
|---|---|
| **Contract ID** | `CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q` |
| **Network** | Stellar Testnet |
| **Explorer** | [View on Stellar Lab](https://lab.stellar.org/r/testnet/contract/CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q) |

A live test agreement exists on-chain and is queryable right now:

```bash
trellis status --agreement-id 0101010101010101010101010101010101010101010101010101010101010101
```

Full deployment details, every verified command, and step-by-step instructions for deploying your own instance are in [DEPLOYMENT.md](./DEPLOYMENT.md).

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
- Every state transition emits an on-chain event, so off-chain clients (dashboards, notifications, activity feeds) can track progress in real time without polling contract state

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
| `get_agreement` | Anyone (read-only) | Returns the full current state of an agreement |

### Tech stack

- **[Soroban](https://developers.stellar.org/docs/build/smart-contracts)** — Stellar's Rust-based smart contract platform (`#![no_std]`, compiles to WASM)
- **soroban-sdk 22.x** — contract types, storage, auth, and token interfaces
- **clap 4** (derive) — CLI argument parsing

Why Soroban: contracts are written in real Rust, compiled to WASM, and run on the Stellar network — which has fast finality, low fees, and an established USDC presence (via Circle's Stellar Asset Contract), making it well-suited for cross-border payment use cases like this one.

---

## Quickstart

### Prerequisites

- Rust (stable toolchain)
- `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- [`stellar` CLI](https://developers.stellar.org/docs/tools/cli/install-cli) 26.x+
- A funded Soroban testnet account ([friendbot](https://developers.stellar.org/docs/tools/quickstart#friendbot))

### Build and test the contract

```bash
cd contracts/trellis_core
cargo test
```

All 5 integration tests run in the Soroban sandbox and cover the happy path, double-init protection, dispute resolution, unfunded milestone cancellation, and the `get_agreement` view function.

### Build the contract WASM

```bash
cd contracts/trellis_core
cargo rustc --manifest-path=Cargo.toml --crate-type=cdylib --target=wasm32-unknown-unknown --release
```

> See [DEPLOYMENT.md](./DEPLOYMENT.md) for why this command is used instead of `stellar contract build`, and for the full deployment walkthrough.

### CLI usage

```bash
cd cli/trellis_cli
cargo build --release

# Set up environment (or use defaults for testnet)
export STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export TRELLIS_CONTRACT_ID="CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q"
export TRELLIS_SOURCE_KEY="<your stellar identity name>"

# Create a new agreement
trellis init \
  --agreement-id <hex-id> \
  --payer <payer-address> \
  --payee <payee-address> \
  --token <token-contract-address> \
  --resolver <resolver-address> \
  --milestones "1000,2000"

# Check status
trellis status --agreement-id <hex-id>

# Fund the first milestone
trellis lock-funds --agreement-id <hex-id> --milestone-id 0
```

All 8 commands — `init`, `lock-funds`, `submit-work`, `approve-release`, `raise-dispute`, `resolve-dispute`, `cancel-milestone`, and `status` — are implemented. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full command reference and which have been verified against the live testnet contract.

---

## Project Status

### ✅ Done

- Core escrow contract — all 8 entrypoints implemented and tested
- Full state machine including dispute resolution and cancellation paths
- Integration test suite — 5/5 passing in the Soroban sandbox
- Full CLI — all 8 commands implemented end-to-end
- Deployed and live on Stellar testnet
- `init` and `status` verified against the live deployed contract

### 🚧 Open for contribution

With the core contract and CLI complete, the current focus areas are:

| Area | Description | Difficulty |
|---|---|---|
| Frontend dashboard | React + Vite UI for creating and managing agreements | Beginner → Advanced (6-issue series) |
| Testnet verification | Verify remaining CLI commands against live contract | Beginner |
| Native RPC client | Replace `stellar` CLI shell-out with a native Rust HTTP client | Advanced |
| Documentation | `CONTRIBUTING.md` and contributor onboarding | Beginner |

See [Issues](../../issues) for the full, currently active task list — each issue includes exact requirements, acceptance criteria, and a suggested execution plan.

---

## Contributing

Trellis is built in the open and welcomes contributors of all experience levels.

1. Fork the repo and clone it locally
2. Check [open issues](../../issues) for tasks tagged `good first issue` or `help wanted`
3. Comment on the issue to claim it before starting work
4. Run `cargo test` in `contracts/trellis_core` to confirm your environment is set up correctly
5. Open a PR — include a description of what you changed and why, and reference the issue with `Closes #X`

If you're new to Soroban, the [official Soroban docs](https://developers.stellar.org/docs/build/smart-contracts/overview) and the `soroban-examples` repo are great references for conventions used throughout this codebase.

---
<div align="center">
## License


---

<div align="center">

Built by Allen

</div>
