# #695 — npm-audit allowlist is documented but read by nothing

**Area:** `.github/workflows/npm-audit.yml`, `frontend/.audit-allowlist.json`, `README.md` · **Type:** CI bug / misleading docs

## Problem

The workflow header (`.github/workflows/npm-audit.yml:8-11`) says reviewed
advisories are suppressed through `.npmrc` (`audit-level`), `npm audit --omit`,
or `overrides` in `package.json`, and recorded in
`frontend/.audit-allowlist.json`. The failure step tells contributors to add
false positives to that file, and `README.md:581` repeats it.

What is actually in the repo:

- No `.npmrc` is tracked.
- `frontend/.audit-allowlist.json` contains `"allowlist": []`, and no script
  or workflow reads it. `git grep audit-allowlist` finds only comments and docs.
- The audit step runs `npm audit` twice (once for JSON, once for the exit
  code) and fails on any high or critical advisory:

  ```yaml
  npm audit --audit-level=high --json > audit-report.json || true
  npm audit --audit-level=high
  ```

So there is no way to accept a reviewed false positive. The scheduled run on
2026-10-12 failed at the "Run npm audit" step.

## Fix (recommended: make the allowlist real)

Add `frontend/scripts/check-audit.mjs`:

```js
// Usage: node scripts/check-audit.mjs audit-report.json .audit-allowlist.json
import { readFileSync } from "node:fs";

const [reportPath, allowPath] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const { allowlist = [] } = JSON.parse(readFileSync(allowPath, "utf8"));
const today = new Date().toISOString().slice(0, 10);

const allowed = new Map();
for (const e of allowlist) {
  if (e.recheck_after && e.recheck_after < today) {
    console.log(`::warning::allowlist entry ${e.id} expired (recheck_after ${e.recheck_after}); not honoured`);
    continue;
  }
  allowed.set(e.id, e);
}

const failing = [];
for (const [pkg, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via ?? []) {
    if (typeof via !== "object") continue;          // transitive reference
    if (!["high", "critical"].includes(via.severity)) continue;
    const id = via.url?.split("/").pop();           // GHSA-xxxx-xxxx-xxxx
    if (allowed.has(id)) {
      console.log(`ignored ${id} (${pkg}): ${allowed.get(id).reason}`);
    } else {
      failing.push(`${via.severity.toUpperCase()} ${id} in ${pkg}: ${via.title}`);
    }
  }
}

if (failing.length) {
  console.log(`::error::${failing.length} unallowlisted high/critical advisories`);
  failing.forEach((f) => console.log("  " + f));
  process.exit(1);
}
console.log("npm audit: no unallowlisted high/critical advisories");
```

Then replace the audit step so `npm audit` runs once:

```yaml
- name: Run npm audit (high/critical)
  id: audit
  run: |
    npm audit --json > audit-report.json || true
    node scripts/check-audit.mjs audit-report.json .audit-allowlist.json
```

Then update the comments:

- Rewrite lines 8-11 of the workflow to describe the allowlist script. Remove
  the mentions of `.npmrc` and `--omit`.
- In the failure message and `README.md:581`, say that an allowlist entry is
  enough on its own. An `overrides` entry is only needed when a patched
  version exists.
- Allowlist entry format (already described in the file's `_format`):

  ```json
  { "id": "GHSA-xxxx-xxxx-xxxx", "reason": "...", "reviewed_by": "@handle",
    "reviewed_date": "2026-11-20", "recheck_after": "2027-02-20" }
  ```

### Alternative (minimal)

If nobody wants to own an allowlist, delete `frontend/.audit-allowlist.json`
and remove every mention of `.npmrc`, `--omit` and the allowlist from the
workflow and README. The documented way to handle a finding then becomes
"fix it, or add an `overrides` entry". Also drop the duplicate `npm audit` run.

## Verification

1. Locally: `npm audit --json > r.json; node scripts/check-audit.mjs r.json .audit-allowlist.json`.
2. Add the GHSA ID of a current high advisory to the allowlist. The script
   should exit 0 and print `ignored GHSA-...`.
3. Remove the entry, or set `recheck_after` to a past date. The script should
   exit 1.
4. Push a branch and confirm the workflow behaves the same way in CI.

## Done when

Adding a GHSA ID to `frontend/.audit-allowlist.json` makes the workflow ignore
that advisory, and a high advisory that is not listed still fails the workflow.
