# Issue #689 — Only One Workflow Job Sets `timeout-minutes`; a Hung Devnet or Mutation Job Runs for 6 Hours

**Issue:** [#689](https://github.com/Trellis-Ecosystem/trellis/issues/689)  
**Branch:** `fix/workflow-job-timeouts`  
**Scope:** every file in `.github/workflows/*.yml`

---

## Background

GitHub Actions' default job timeout is **360 minutes**. A job that hangs — a Docker-backed devnet that never becomes healthy, a `cargo install` stuck on the network, a mutant that loops forever — keeps the runner busy for six hours before it is killed. That burns CI minutes, blocks concurrency slots, and delays the failure signal for the PR author.

---

## Current State

```console
$ git grep -n timeout-minutes -- .github
.github/workflows/e2e-testnet.yml:17:    timeout-minutes: 30
```

There are 12 workflow files with 27 jobs between them; only `e2e-testnet.yml` → `lifecycle` declares a timeout. The jobs most likely to hang have none:

| Job | Location | Why it can hang |
|---|---|---|
| `cli-integration` | `contract-ci.yml:171` | Starts a local Soroban devnet in Docker (`tests/cli_integration/run.sh`) |
| `e2e` | `frontend-ci.yml:111` | Docker devnet **plus** a Playwright browser |
| `mutation-tests` | `advanced-testing.yml:94` | `cargo install cargo-mutants` + `cargo mutants` over the whole crate |
| `test-coverage` | `advanced-testing.yml:203` | `cargo install cargo-llvm-cov` (unlocked) + instrumented build |
| `build-cli` / `build-contract` | `release.yml:200`, `release.yml:158` | Cross-platform release builds |

---

## Required Change

Add `timeout-minutes` at the **job** level (sibling of `runs-on`) for every job. Suggested values:

| Workflow | Job | `timeout-minutes` |
|---|---|---|
| `advanced-testing.yml` | `property-tests` | 30 |
| | `gas-benchmarks` | 20 |
| | `mutation-tests` | 120 |
| | `cli-integration-tests` (matrix) | 30 |
| | `test-coverage` | 30 |
| | `test-summary` | 5 |
| `cargo-audit.yml` | `audit` | 15 |
| `codeql-analysis.yml` | `analyze` | 30 |
| `contract-ci.yml` | `semgrep` | 15 |
| | `readme-entrypoints` | 10 |
| | `supply-chain` | 15 |
| | `verify` | 30 |
| | `cli-integration` | 30 |
| `deploy-mainnet.yml` | `deploy` | 30 |
| `e2e-testnet.yml` | `lifecycle` | 30 *(already set)* |
| `frontend-ci.yml` | `verify` | 15 |
| | `e2e` | 30 |
| `npm-audit.yml` | `npm-audit` | 10 |
| `release.yml` | `changelog` | 10 |
| | `verify-version` | 10 |
| | `verify` | 30 |
| | `build-contract` | 30 |
| | `build-cli` (matrix) | 45 |
| | `release` | 15 |
| `test-count-badge.yml` | `update-badge` | 15 |
| `testnet-health.yml` | `probe` | 10 |
| `ttl-keeper.yml` | `extend-ttl` | 15 |

Rule of thumb: **15** for lint/audit/test jobs, **30** for anything that boots a devnet or does a full build, **120** for mutation testing. Values should be roughly 2–3× a normal run's duration — tight enough to catch a hang, loose enough not to flake on a cold cache.

Example:

```yaml
  cli-integration:
    name: CLI integration tests (local devnet)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: verify
```

For matrix jobs, the timeout applies **per leg**, which is what we want.

---

## Verification

Add a check (locally, or as a step in `contract-ci.yml` → `readme-entrypoints`/a new lint job) that fails if any job lacks a timeout:

```bash
#!/usr/bin/env bash
# scripts/check-workflow-timeouts.sh
set -euo pipefail
missing=0
for f in .github/workflows/*.yml; do
  for job in $(yq '.jobs | keys | .[]' "$f"); do
    if [ "$(yq ".jobs.\"$job\".timeout-minutes" "$f")" = "null" ]; then
      echo "::error file=$f::job '$job' has no timeout-minutes"
      missing=1
    fi
  done
done
exit "$missing"
```

`yq` (mikefarah v4) is preinstalled on `ubuntu-latest` runners.

---

## Files Affected

| File | Change |
|---|---|
| `.github/workflows/*.yml` (11 files) | Add job-level `timeout-minutes` to every job without one |
| `scripts/check-workflow-timeouts.sh` *(optional)* | Script that fails when any job is missing `timeout-minutes` |

---

## Done When

- Every job in `.github/workflows/*.yml` declares `timeout-minutes`.
- `scripts/check-workflow-timeouts.sh` (or an equivalent one-liner) reports no job without one.
- PR description contains `Closes #689`.
