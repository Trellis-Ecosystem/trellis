# Trellis — Testnet Deployment

## Live Contract

| Network | Contract ID |
|---|---|
| Stellar Testnet | `CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q` |

### Explorer Links

- **Contract:** https://lab.stellar.org/r/testnet/contract/CAUAO7CYKULE2K4EJMQ6LLRUHP7Y7JYOH6G2VBXKYG7PTETE3UZ3DU7Q
- **Deploy TX:** https://stellar.expert/explorer/testnet/tx/8587efcf3c302c878eccca0d6e00fb06cb8e09d535675a10f35f98541835d63f

---

## Network Configuration

| | Value |
|---|---|
| Network | Stellar Testnet |
| RPC URL | `https://soroban-testnet.stellar.org` |
| Network Passphrase | `Test SDF Network ; September 2015` |
| Soroban SDK Version | `22.x` (Protocol 26 compatible) |
| Explorer | https://stellar.expert/explorer/testnet |

---

## Deploying Your Own Instance

### Prerequisites

- Rust stable toolchain
- `wasm32-unknown-unknown` target:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```
- stellar CLI 26.x+:
  https://developers.stellar.org/docs/tools/cli/install-cli

### Step 1 — Create and fund a testnet identity

```bash
stellar keys generate trellis-deployer --network testnet
stellar keys fund trellis-deployer --network testnet --rpc-url https://soroban-testnet.stellar.org
```

### Step 2 — Build the contract WASM

```bash
cd contracts/trellis_core
cargo rustc --manifest-path=Cargo.toml --crate-type=cdylib --target=wasm32-unknown-unknown --release
```

> **Note:** Use `cargo rustc` with `--target=wasm32-unknown-unknown` rather than
> `stellar contract build` — the latter targets `wasm32v1-none` which requires
> soroban-sdk 22.x+ and a newer toolchain. The manual `cargo rustc` command gives
> you full control over the target.

The compiled WASM will be at:
```
target/wasm32-unknown-unknown/release/trellis_core.wasm
```

### Step 3 — Deploy to testnet

```bash
stellar contract deploy \
  --wasm ../../target/wasm32-unknown-unknown/release/trellis_core.wasm \
  --source trellis-deployer \
  --network testnet
```

This returns a `C...` contract address. Save it — you'll need it for all CLI commands.

### Step 4 — Set environment variables

```bash
export STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export TRELLIS_CONTRACT_ID="<your contract ID>"
export TRELLIS_SOURCE_KEY="<your stellar identity name>"
```

### Step 5 — Build the CLI

```bash
cd cli/trellis_cli
cargo build --release
```

Binary will be at: `target/release/trellis.exe` (Windows) or `target/release/trellis` (Linux/Mac)

---

## CLI Usage

### Create an agreement

```bash
trellis init \
  --agreement-id <64-char hex string> \
  --payer <payer G... address> \
  --payee <payee G... address> \
  --token <USDC SAC contract address> \
  --resolver <dispute resolver G... address> \
  --milestones "1000,2000"
```

> The `--milestones` flag accepts comma-separated amounts in stroops.
> Multiple milestones: `--milestones "1000,2000,3000"`

### Check agreement status

```bash
trellis status --agreement-id <hex>
```

### Fund a milestone

```bash
trellis lock-funds --agreement-id <hex> --milestone-id 0
```

> Must be signed by the payer identity (`TRELLIS_SOURCE_KEY=trellis-payer`)

### Submit work proof

```bash
trellis submit-work \
  --agreement-id <hex> \
  --milestone-id 0 \
  --proof-uri "ipfs://your-proof-hash"
```

> Must be signed by the payee identity

### Approve and release payment

```bash
trellis approve-release --agreement-id <hex> --milestone-id 0
```

> Must be signed by the payer identity

### Raise a dispute

```bash
trellis raise-dispute \
  --agreement-id <hex> \
  --milestone-id 0 \
  --caller <payer or payee address>
```

> Can be called by either the payer or the payee

### Resolve a dispute

```bash
trellis resolve-dispute \
  --agreement-id <hex> \
  --milestone-id 0 \
  --refund-to-payer true
```

> Must be signed by the dispute resolver identity.
> `--refund-to-payer true` returns funds to payer.
> `--refund-to-payer false` releases funds to payee.

### Cancel an unfunded milestone

```bash
trellis cancel-milestone --agreement-id <hex> --milestone-id 0
```

> Must be signed by the payer. Only works on milestones still in `Pending` status.

---

## Testnet Token (USDC)

The USDC Stellar Asset Contract address on testnet:

```
CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```

To derive it yourself:
```bash
stellar contract id asset \
  --network testnet \
  --asset USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

To get testnet USDC, visit the Stellar testnet faucet:
https://developers.stellar.org/docs/tools/quickstart#friendbot

---

## Verified Test Agreement

A live test agreement was created on testnet during initial deployment verification:

| Field | Value |
|---|---|
| Agreement ID | `0101010101010101010101010101010101010101010101010101010101010101` |
| Payer | `GDTFKGGBI4GGHSZ6ILTTJJTXOA4CIKCT6J2DRC3Q3OT3YMWGB7TBLXMK` |
| Payee | `GCGX32T5547AE57PUIAX5CDQWKHHEQFYOPIGXH7O3CENKDX3FR6U67RY` |
| Milestone 0 | 1000 stroops, status: Pending |

Verify it live:
```bash
trellis status --agreement-id 0101010101010101010101010101010101010101010101010101010101010101
```

---

## Verified CLI Commands

| Command | Status | Notes |
|---|---|---|
| `init` | ✅ Verified on testnet | Agreement created on-chain |
| `status` | ✅ Verified on testnet | Returns full agreement state as JSON |
| `lock-funds` | ✅ Implemented | Requires payer USDC balance |
| `submit-work` | ✅ Implemented | Requires milestone in Funded state |
| `approve-release` | ✅ Implemented | Releases funds to payee |
| `raise-dispute` | ✅ Implemented | Callable by payer or payee |
| `resolve-dispute` | ✅ Implemented | Callable by dispute resolver only |
| `cancel-milestone` | ✅ Implemented | Cancels unfunded milestones |

---

## Known Issues & Notes

- **Auth per command:** Each CLI command must be signed by the correct identity.
  Change `TRELLIS_SOURCE_KEY` to match the required signer per operation
  (payer for `init`, `lock-funds`, `approve-release`; payee for `submit-work`;
  resolver for `resolve-dispute`).

- **WASM build target:** Use `wasm32-unknown-unknown` via `cargo rustc` rather
  than `stellar contract build` until the project upgrades to a toolchain that
  fully supports `wasm32v1-none`.

- **Windows paths:** On Windows Git Bash, use the full path to the binary:
  `C:\Users\<you>\Documents\Trellis\target\release\trellis.exe`
