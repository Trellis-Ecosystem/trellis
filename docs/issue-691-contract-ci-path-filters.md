# Issue #691 — Contract CI Path Filters Omit Files the Workflow Depends On

**Issue:** [#691](https://github.com/Trellis-Ecosystem/trellis/issues/691)  
**Scope:** `.github/workflows/contract-ci.yml`, `tests/cli_integration/README.md`

---

## Background

`contract-ci.yml` limits `push` (lines 5-13) and `pull_request` (lines 16-23) runs to:

```
contracts/**, cli/**, Cargo.toml, Cargo.lock, deny.toml,
.cargo/audit.toml, .github/workflows/contract-ci.yml
```

But the workflow also consumes files outside those paths:

| File / dir | Used by | Where |
|---|---|---|
| `tests/cli_integration/**` | `cli-integration` job runs `tests/cli_integration/run.sh` | `contract-ci.yml` ~line 180 |
| `.semgrep/**` | `semgrep` job: `semgrep scan --config .semgrep/soroban-rules.yaml` | `contract-ci.yml:57` |
| `scripts/**` | `./scripts/check-readme-entrypoints.sh` | `contract-ci.yml:68` |
| `rust-toolchain.toml` | Pins the toolchain (1.86.0) for every Rust job | repo root |

A PR that edits only one of these — e.g. breaking `run.sh`, weakening a Semgrep rule, or bumping the Rust toolchain — merges without Contract CI running at all. The breakage then surfaces on the next unrelated contract PR.

---

## Required Change

### 1. `.github/workflows/contract-ci.yml`

Add the four entries to **both** `paths:` lists (keep them identical):

```yaml
    paths:
      - 'contracts/**'
      - 'cli/**'
      - 'tests/cli_integration/**'
      - 'scripts/**'
      - '.semgrep/**'
      - 'Cargo.toml'
      - 'Cargo.lock'
      - 'rust-toolchain.toml'
      - 'deny.toml'
      - '.cargo/audit.toml'
      - '.github/workflows/contract-ci.yml'
```

Optionally add a comment above the first list: `# Keep in sync with pull_request.paths below — include every file a job reads.`

`scripts/**` is broader than strictly needed (only `check-readme-entrypoints.sh` is used today), but it is cheap and avoids the same gap when another script is wired in. If that's undesirable, use `scripts/check-readme-entrypoints.sh` explicitly.

Since `check-readme-entrypoints.sh` validates README entry points, consider also adding `README.md` — check what the script reads before deciding.

### 2. `tests/cli_integration/README.md:45-47`

Update the trigger description:

> CI runs this automatically (`.github/workflows/contract-ci.yml`, job `cli-integration`) on every push/PR touching `contracts/`, `cli/`, `tests/cli_integration/`, `rust-toolchain.toml` or the other paths listed in the workflow's `paths:` filter.

---

## Verification

| PR changes only | Expected |
|---|---|
| `tests/cli_integration/run.sh` (e.g. a comment) | Contract CI starts |
| `rust-toolchain.toml` | Contract CI starts |
| `.semgrep/soroban-rules.yaml` | Contract CI starts |
| `frontend/**` | Contract CI does **not** start (filter still narrows) |

`git diff master -- .github/workflows/contract-ci.yml` should show both lists changed identically.

---

## Files Affected

| File | Change |
|---|---|
| `.github/workflows/contract-ci.yml` | Add `tests/cli_integration/**`, `scripts/**`, `.semgrep/**`, `rust-toolchain.toml` to push and PR `paths:`. |
| `tests/cli_integration/README.md` | Correct the documented trigger. |

---

## Done When

A PR that only edits `tests/cli_integration/run.sh` or `rust-toolchain.toml` starts Contract CI.
