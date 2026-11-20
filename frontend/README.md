# Trellis Frontend

React + TypeScript + Vite single-page app for Trellis, a Soroban escrow contract for milestone-based agreements on Stellar. The frontend lets payers and payees create agreements, lock funds, submit work proofs, and manage disputes through a browser wallet (Freighter).

## Architecture

- **React 19 + React Router** for the SPA, with client-side routing (see [DEPLOYMENT.md](../DEPLOYMENT.md#frontend-spa-routing) for host routing fallback config).
- **`@stellar/stellar-sdk`** to build and submit Soroban transactions against the RPC endpoint.
- **`@stellar/freighter-api`** to connect the user's Freighter wallet and request signatures.
- Source layout under `src/`: `pages/` for routes, `components/` for shared UI, `hooks/` and `context/` for wallet/contract state, `lib/` for Stellar SDK helpers.

## Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Description |
|---|---|
| `VITE_CONTRACT_ID` | Deployed Trellis contract ID (see [DEPLOYMENT.md](../DEPLOYMENT.md) for the current testnet contract). |
| `VITE_RPC_URL` | Soroban RPC endpoint, e.g. `https://soroban-testnet.stellar.org`. |
| `VITE_NETWORK_PASSPHRASE` | Network passphrase, e.g. `Test SDF Network ; September 2015`. |

## Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` by default. Freighter must be installed in your browser and set to the same network as `VITE_NETWORK_PASSPHRASE`.

### Connecting to testnet

1. Set the env vars above to point at Stellar testnet (defaults in `.env.example` already do).
2. Install [Freighter](https://www.freighter.app/) and switch it to Testnet.
3. Fund a testnet account via [Friendbot](https://developers.stellar.org/docs/tools/quickstart#friendbot) if you need test XLM.

### Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR. |
| `npm run build` | Type-check (`tsc -b`) and build for production into `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run Oxlint. |
| `npm run typecheck` | Run TypeScript in check-only mode. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Run Vitest with coverage report. |
| `npm run test:e2e` | Run the Playwright end-to-end suite in `e2e/` (needs a deployed contract and `E2E_*` env vars; see [End-to-end tests](#end-to-end-tests)). |

### End-to-end tests

The Playwright suite in [`e2e/`](./e2e) drives a real Chromium browser through the full user journey (creating an agreement through the UI with a mocked Freighter wallet, then checking the status page) against a contract deployed to a local Soroban devnet.

The easiest way to run it is the wrapper script, run from the repository root:

```bash
bash tests/e2e/run.sh
```

**Prerequisites:** Docker, the `stellar` CLI (26.x+) on `PATH`, the `wasm32-unknown-unknown` Rust target, and Node/npm.

[`tests/e2e/run.sh`](../tests/e2e/run.sh) then:

1. Starts the local devnet container (`stellar container start local`) if it isn't already healthy.
2. Generates and funds `payer`, `payee` and `resolver` identities.
3. Builds `trellis_core` to wasm, resolves the native XLM SAC as the test token and deploys the contract.
4. Writes a temporary `frontend/.env` pointing at the devnet (your existing `.env` is backed up and restored on exit).
5. Runs `npm install`, installs Playwright's Chromium if missing, and starts `npm run dev` on port 5173.
6. Runs `npm run test:e2e` with the `E2E_*` variables below set.

To run `npm run test:e2e` directly against your own deployment, set these yourself:

| Variable | Description |
|---|---|
| `E2E_BASE_URL` | URL of the running frontend. Optional; defaults to `http://localhost:5173` (see `playwright.config.ts`). |
| `E2E_PAYER_ADDRESS` | Payer account public key (`G...`). |
| `E2E_PAYER_SECRET` | Payer secret key (`S...`), used by the mocked Freighter wallet to sign. |
| `E2E_PAYEE_ADDRESS` | Payee account public key. |
| `E2E_PAYEE_SECRET` | Payee secret key (used by `full-lifecycle.spec.ts`). |
| `E2E_RESOLVER_ADDRESS` | Dispute resolver account public key. |
| `E2E_TOKEN_ADDRESS` | Token contract address used for escrow. |
| `E2E_RPC_URL` | Soroban RPC endpoint, e.g. `http://localhost:8000/soroban/rpc`. |
| `E2E_NETWORK_PASSPHRASE` | Network passphrase, e.g. `Standalone Network ; February 2017`. |

The frontend under test must also be built with `VITE_CONTRACT_ID`, `VITE_RPC_URL` and `VITE_NETWORK_PASSPHRASE` pointing at the same deployment. Only use throwaway devnet/testnet keys here.

**CI:** the `e2e` job in [`.github/workflows/frontend-ci.yml`](../.github/workflows/frontend-ci.yml) runs `tests/e2e/run.sh`, but only on a manual `workflow_dispatch` of the Frontend CI workflow. It does not run on pushes or PRs. On failure it uploads `frontend/test-results` as the `playwright-report` artifact.

### Building for production

```bash
npm run build
```

Output is written to `dist/`. Serve it with any static host; see [DEPLOYMENT.md](../DEPLOYMENT.md#frontend-spa-routing) for SPA routing fallback configuration required on nginx/Apache/Netlify/Vercel.

### Lint rules

Oxlint is configured in [`.oxlintrc.json`](./.oxlintrc.json). The `typescript/no-explicit-any` rule is enabled as a **warning** (not an error) so a type-safety regression cannot be merged silently, while leaving room to migrate any remaining untyped code.

Migration path when a warning appears:

1. **Model the shape.** For RPC responses, declare an `interface` with the fields actually read — see `src/test/mocks/handlers.ts` for the `RpcRequestBody` pattern.
2. **Prefer `unknown` over `any`** for values you only pass through or narrow later; narrow with a type guard or `instanceof` rather than a cast.
3. **When a type is genuinely external and unmodelled**, use a narrowly-scoped intersection type instead of widening the whole value — see `createAbortSignalFallback` in `src/lib/abort.ts` for the `AbortSignal & { _timeoutId?: ... }` pattern.
4. **Do not silence the rule with an inline disable** unless the case is unavoidable and commented with why. Once the warning count reaches zero, the rule should be promoted to `error`.

`src/` currently has no `any` usages, so a new one is always a regression rather than pre-existing debt.


## Contributing

See the root [CONTRIBUTING.md](../CONTRIBUTING.md) for repository-wide setup and PR guidelines. For Stellar/Freighter API details, see the [Stellar developer docs](https://developers.stellar.org/) and [Freighter docs](https://docs.freighter.app/).
