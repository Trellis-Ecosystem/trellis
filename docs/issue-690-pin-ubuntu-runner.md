# Issue #690 — Pin the Runner Image Instead of `ubuntu-latest`

**Issue:** [#690](https://github.com/Trellis-Ecosystem/trellis/issues/690)  
**Scope:** every file in `.github/workflows/`

---

## Background

GitHub is migrating the `ubuntu-latest` label to Ubuntu 26 starting **2026-10-19** (annotation on contract-ci run 38257667792, 2026-10-12). The pipeline already pins the Rust toolchain (`rust-toolchain.toml`, 1.86.0) and `stellar-cli`, so the OS image is the last unpinned moving part: a silent image change can alter system libraries, preinstalled tools (Docker, Node, Python) and default compiler versions underneath the WASM build and the release artefacts.

> The issue text counts 23 occurrences; on current `master` there are **27** across 12 workflow files.

---

## Current Occurrences

`git grep -n ubuntu-latest -- .github`:

| File | Lines |
|---|---|
| `advanced-testing.yml` | 40, 62, 96, **183 (matrix `os:` list)**, 205, 232 |
| `cargo-audit.yml` | 17 |
| `codeql-analysis.yml` | 40 |
| `contract-ci.yml` | 45, 61, 72, 123, 173 |
| `deploy-mainnet.yml` | 17 |
| `e2e-testnet.yml` | 16 |
| `frontend-ci.yml` | 33, 116 |
| `npm-audit.yml` | 45 |
| `release.yml` | 36, 102, 140, 161, **208 (matrix `include: - os:`)**, 255 |
| `test-count-badge.yml` | 23 |
| `testnet-health.yml` | 33 |
| `ttl-keeper.yml` | 33 |

The two matrix entries matter: they are not `runs-on:` lines, so a search for `runs-on: ubuntu-latest` alone would miss them.

---

## Required Change

### 1. Replace every occurrence with `ubuntu-24.04`

```bash
git grep -l ubuntu-latest -- .github | xargs sed -i 's/ubuntu-latest/ubuntu-24.04/g'
```

### 2. Mark where to bump

Add a short comment at the first `runs-on:` of each workflow (or above each matrix), e.g.:

```yaml
    # Runner image pinned (#690). Bump all workflows together:
    #   git grep -l ubuntu-24.04 -- .github | xargs sed -i 's/ubuntu-24.04/ubuntu-26.04/g'
    runs-on: ubuntu-24.04
```

Optionally document the policy once in `CONTRIBUTING.md` (CI section): runner images are pinned and upgraded in a dedicated PR after checking GitHub's runner-images changelog.

### 3. Out of scope (note only)

`macos-latest` and `windows-latest` (in `advanced-testing.yml:183` and the `release.yml` matrix) have the same problem. They aren't required by this issue, but pinning them (e.g. `macos-15`, `windows-2025`) in the same PR is reasonable and keeps release builds reproducible — mention it in the PR description if done.

---

## Verification

```bash
git grep ubuntu-latest -- .github      # must print nothing
git grep -c ubuntu-24.04 -- .github    # should total 27
```

Then confirm every workflow still passes on the pinned image:

- PR-triggered: Contract CI, Frontend CI, CodeQL, cargo-audit, npm-audit — run on the PR.
- Manual/scheduled (`advanced-testing`, `e2e-testnet`, `testnet-health`, `ttl-keeper`, `test-count-badge`, `release`, `deploy-mainnet`): trigger via `workflow_dispatch` on the branch where safe. **Do not** dispatch `deploy-mainnet.yml` or a real `release.yml` publish to test this — verify those by YAML review (`actionlint`) and let the next real run confirm.

---

## Files Affected

| File | Change |
|---|---|
| All 12 files in `.github/workflows/` | `ubuntu-latest` → `ubuntu-24.04`, including matrix entries; bump comment. |
| `CONTRIBUTING.md` (optional) | Runner-pinning policy. |

---

## Done When

`git grep ubuntu-latest -- .github` returns nothing and all workflows still pass on `ubuntu-24.04`.
