# End-to-End Test (#143)

Full user journey across all three layers — contract, frontend, and a real
browser: deploys `trellis_core` to a local Soroban devnet, starts the actual
frontend dev server against it, and drives a real Chromium browser (via
Playwright) through creating an agreement through the UI with a mocked
Freighter wallet, then verifies it reads back correctly on the status page.

The Playwright project itself lives in `frontend/e2e/` (config at
`frontend/playwright.config.ts`) since it's a frontend concern; this
directory holds the orchestration script that sets up everything around it.

## Prerequisites

- Docker (or another engine `stellar container` supports)
- [`stellar` CLI](https://developers.stellar.org/docs/tools/cli/install-cli) 26.x+ on `PATH`
- Rust with the `wasm32-unknown-unknown` target:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```
- Node/npm

## Running

```bash
bash tests/e2e/run.sh
```

This is self-contained and idempotent:

1. Starts a local Soroban devnet container if one isn't already running, and
   funds `payer`/`payee`/`resolver` identities if they don't exist yet (same
   identities `tests/cli_integration/run.sh` uses).
2. Builds the `trellis_core` contract (wasm32) and deploys a fresh instance,
   plus a native-XLM SAC test token (reused if already deployed).
3. Writes `frontend/.env` pointing at the local devnet (backing up and
   restoring any existing `.env` on exit) and starts `npm run dev`.
4. Runs the Playwright suite against it, passing the deployed
   contract/token IDs and test identities in as `E2E_*` env vars.
5. Tears down the dev server and restores `frontend/.env`, whether the test
   passed or failed.

Every external step that could otherwise hang indefinitely (npm install,
Chromium install, the dev server becoming reachable, the test run itself) is
wrapped in an explicit timeout, so a real failure surfaces as a fast, clear
error instead of the script stalling silently.

## The Freighter mock

`@stellar/freighter-api` talks to the real browser extension over
`window.postMessage` with a specific wire format (see
`frontend/e2e/freighter-mock.ts` for the reverse-engineered protocol and
citations). The mock intercepts those messages and answers them directly —
for everything except signing, with a fixed mock response; for signing, the
transaction XDR is handed out to the Node test process (via
`page.exposeFunction`) and signed there with the test payer's real key,
which never enters the browser context.

## CI

Runs only on manual trigger (`workflow_dispatch`), in the `e2e` job of
`.github/workflows/frontend-ci.yml` — it needs a Docker-backed local devnet
and a real browser, both far heavier than the rest of that workflow.
