# Issue #692 — No CI Job Runs gitleaks

**Issue:** [#692](https://github.com/Trellis-Ecosystem/trellis/issues/692)  
**Scope:** `.github/workflows/`, `CONTRIBUTING.md`

---

## Background

Secret scanning exists only in the local pre-commit hook (`.githooks/pre-commit:135-157`). That hook is:

- **opt-in per clone** — it only runs after `scripts/install-hooks.sh` / `git config core.hooksPath .githooks`;
- **bypassable** — `SKIP_HOOKS=1` or `SKIP_SECRETS=1` skips it, as does `git commit --no-verify`.

`git grep gitleaks -- .github` returns nothing, so `.gitleaks.toml` is never exercised in CI. Meanwhile `CONTRIBUTING.md:135` says of the bypass flags: *"CI will still catch the same issues"* — true for lint and tests, false for secrets.

---

## Required Change

### 1. New workflow `.github/workflows/gitleaks.yml`

Use the pinned release binary rather than `gitleaks/gitleaks-action`: the action requires a paid `GITLEAKS_LICENSE` on organisation-owned repositories.

```yaml
name: Secret Scan

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: gitleaks-${{ github.ref }}
  cancel-in-progress: true

jobs:
  gitleaks:
    name: gitleaks
    runs-on: ubuntu-24.04   # see #690 — bump deliberately
    steps:
      - name: Check out repository (full history)
        uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - name: Install gitleaks (pinned)
        env:
          GITLEAKS_VERSION: 8.27.2
          # sha256 of gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz from the
          # release's checksums.txt — update together with the version.
          GITLEAKS_SHA256: <fill-in-from-checksums.txt>
        run: |
          curl -sSfL -o gitleaks.tgz \
            "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
          echo "${GITLEAKS_SHA256}  gitleaks.tgz" | sha256sum -c -
          tar -xzf gitleaks.tgz gitleaks
          sudo install -m 0755 gitleaks /usr/local/bin/gitleaks
          gitleaks version

      - name: Scan commits
        env:
          BASE: ${{ github.event.pull_request.base.sha || github.event.before }}
        run: |
          # PRs / pushes: scan only the new commits. Manual runs or the first
          # push of a branch (before = 000…0): scan full history.
          if [ -n "$BASE" ] && [ "$BASE" != "0000000000000000000000000000000000000000" ]; then
            RANGE="--log-opts=${BASE}..${GITHUB_SHA}"
          else
            RANGE=""
          fi
          gitleaks detect --source . --config .gitleaks.toml \
            --redact --no-banner --exit-code 1 $RANGE
```

Design notes:
- `fetch-depth: 0` is required — gitleaks scans `git log`, and a shallow clone hides the commits being reviewed.
- `--redact` keeps any real secret out of the public job log.
- `--config .gitleaks.toml` makes CI use exactly the same rules/allowlists as the hook (including the Stellar rule from [#693](issue-693-stellar-seed-secret-scanning.md)).
- No path filters: a secret can land in any file.
- Pin `GITLEAKS_VERSION` to the same version `CONTRIBUTING.md:130` recommends, so local and CI results agree.

### 2. Branch protection

After the first green run, a maintainer should add **Secret Scan / gitleaks** as a required status check on `master`.

### 3. `CONTRIBUTING.md:135`

Make the claim accurate, e.g.:

> Use bypass flags sparingly — CI runs the same lint, test and secret-scan (gitleaks) checks, so anything skipped locally will still fail the PR.

### 4. Baseline (if needed)

Before merging, run a full-history scan locally:

```bash
gitleaks detect --config .gitleaks.toml --redact --no-banner
```

If it reports historical findings that are confirmed false positives, add them to `.gitleaks.toml` (per-rule allowlist) or a committed `.gitleaksignore` with fingerprints. Real historical secrets must be **rotated**, not just ignored.

---

## Verification

| Case | Steps | Expected |
|---|---|---|
| Leak | Open a PR adding a fabricated `aws_access_key_id = AKIA…` (`AKIA` + 16 random `[A-Z2-7]` chars) plus a 40-char secret to any file | `Secret Scan / gitleaks` fails; log shows `REDACTED` |
| Clean | Open a PR touching only docs | Check passes |
| Fixture | Full-history scan on `master` | Passes (no unallowlisted findings) |

Use a fabricated key that is not one of AWS's documented `AKIAIOSFODNN7EXAMPLE` values — gitleaks allowlists those by default.

---

## Files Affected

| File | Change |
|---|---|
| `.github/workflows/gitleaks.yml` | New workflow running pinned gitleaks with `.gitleaks.toml`. |
| `CONTRIBUTING.md` | Correct the "CI will still catch the same issues" claim. |
| `.gitleaks.toml` / `.gitleaksignore` | Only if the baseline scan finds false positives. |

---

## Done When

A PR that adds a fake AWS key fails the new check, and a clean PR passes it.
