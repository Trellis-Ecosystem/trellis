# Issue #693 — Secret Scanning Has No Rule for Stellar Secret Seeds (`S…`)

**Issue:** [#693](https://github.com/Trellis-Ecosystem/trellis/issues/693)  
**Scope:** `.gitleaks.toml`, `.githooks/pre-commit`

---

## Background

`TRELLIS_SOURCE_KEY` accepts either a named `stellar keys` identity or a raw 56-character Stellar secret seed (`SECURITY.md:60-70`, `cli/trellis_cli/.env.example:24-26`). A raw seed is the project's most likely leaked credential, yet neither secret scanner targets it:

- **gitleaks** — `.gitleaks.toml` only sets `[extend] useDefault = true` and an allowlist. It defines no `[[rules]]`, and the default gitleaks ruleset has no Stellar rule.
- **Hook fallback** — when gitleaks isn't installed, `.githooks/pre-commit:150` falls back to `SECRET_PATTERN`, which covers PEM private keys, `ghp_`, `sk-`, `AKIA` and `xoxb-` only.

A committed `TRELLIS_SOURCE_KEY=SB…` therefore passes both scanners.

---

## Seed Format

A Stellar secret seed is a StrKey: a version byte (`18 << 3`, which encodes as `S`) followed by a 32-byte ed25519 seed and a 2-byte CRC16 checksum, all base32-encoded (RFC 4648 alphabet `A-Z2-7`, no padding). That gives:

- exactly **56** characters,
- first character always `S`,
- second character always one of `A`–`D` (the top bits of the first seed byte),
- the remaining 54 characters from `[A-Z2-7]`.

Pattern: `\bS[A-D][A-Z2-7]{54}\b`

---

## Required Changes

### 1. `.gitleaks.toml` — add a custom rule

Add after the `[extend]` block:

```toml
[[rules]]
id = "stellar-secret-seed"
description = "Stellar secret seed (StrKey S…), e.g. a raw TRELLIS_SOURCE_KEY"
regex = '''\bS[A-D][A-Z2-7]{54}\b'''
keywords = ["s"]
tags = ["stellar", "key", "secret"]

  # Known non-secret fixtures. Keep this list tight and justify each entry.
  [[rules.allowlists]]
  description = "All-A dummy seed used in CLI unit tests"
  regexes = ['''SA{55}''']
```

Notes:
- `keywords` is a lowercase pre-filter; `"s"` is broad but the regex is strict, so it does not cause false positives — it simply keeps the rule from being skipped.
- `cli/trellis_cli/src/main.rs:462` contains the dummy seed `SAAAA…A` (all `A`). It matches the pattern, so it must be allowlisted (above) or marked with a trailing `// gitleaks:allow` comment.
- If the installed gitleaks predates v8.21 (no `[[rules.allowlists]]`), use the older single-table form `[rules.allowlist]`.

### 2. `.githooks/pre-commit` — extend the fallback regex

Line 150 becomes:

```bash
SECRET_PATTERN='(PRIVATE KEY|-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE|ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{48}|AKIA[0-9A-Z]{16}|xoxb-[0-9]+-[A-Za-z0-9-]+|\bS[A-D][A-Z2-7]{54}\b)'
```

`grep -E` (GNU and BSD) supports `\b`. The fallback scans `git diff --cached -U0`, which includes the `+++`/`@@` header lines; these cannot match the seed pattern, so no extra filtering is needed.

The fallback has no allowlist, so the all-`A` fixture only trips it if that line is re-staged. If that becomes a nuisance, filter it out before matching:

```bash
git diff --cached -U0 | grep -vE 'SA{55}' | grep -qE "${SECRET_PATTERN}"
```

### 3. Docs

`CONTRIBUTING.md` (secret scan section) — mention that Stellar `S…` seeds are scanned by both gitleaks and the fallback, and that test fixtures must use the all-`A` dummy seed or carry `gitleaks:allow`.

---

## Verification

Generate a real-looking seed without touching a keystore:

```bash
SEED=$(python3 -c "import base64,os,struct
def crc(d):
    c=0
    for b in d:
        c^=b<<8
        for _ in range(8): c=((c<<1)^0x1021)&0xffff if c&0x8000 else (c<<1)&0xffff
    return c
p=bytes([18<<3])+os.urandom(32); print(base64.b32encode(p+struct.pack('<H',crc(p))).decode())")
```

(Or simply use any seed from `stellar keys show <name>` on a throwaway identity.)

| Case | Steps | Expected |
|---|---|---|
| With gitleaks | `echo "TRELLIS_SOURCE_KEY=$SEED" > leak.env && git add leak.env && git commit -m test` | Blocked, rule `stellar-secret-seed` |
| Without gitleaks | Same, with gitleaks removed from `PATH` (e.g. `PATH=/usr/bin:/bin git commit …`) | Blocked by the basic regex scan |
| Fixture | `gitleaks detect --no-banner` on a clean checkout | No finding for `cli/trellis_cli/src/main.rs:462` |
| Identity name | Stage `TRELLIS_SOURCE_KEY=alice` | Not blocked |

Clean up with `git reset leak.env && rm leak.env`.

---

## Files Affected

| File | Change |
|---|---|
| `.gitleaks.toml` | Add `stellar-secret-seed` rule with allowlist for the all-`A` test fixture. |
| `.githooks/pre-commit` | Append `\bS[A-D][A-Z2-7]{54}\b` to `SECRET_PATTERN`. |
| `CONTRIBUTING.md` | Note that Stellar seeds are scanned and how to write fixtures. |

---

## Done When

Staging a file containing a syntactically valid Stellar secret seed is blocked both with and without gitleaks installed.

Related: [#692](issue-692-gitleaks-ci-workflow.md) runs the same `.gitleaks.toml` in CI, so this rule is also enforced for contributors who bypass the hook.
