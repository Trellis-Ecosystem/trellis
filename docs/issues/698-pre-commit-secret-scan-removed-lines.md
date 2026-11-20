# #698 — Fallback secret scan blocks commits that *remove* a secret

**Area:** `.githooks/pre-commit` · **Type:** bug (developer tooling)

## Problem

If `gitleaks` is not installed, the pre-commit hook falls back to a regex scan
(`.githooks/pre-commit:150-151`):

```bash
SECRET_PATTERN='(PRIVATE KEY|-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE|ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{48}|AKIA[0-9A-Z]{16}|xoxb-[0-9]+-[A-Za-z0-9-]+)'
if git diff --cached -U0 | grep -qE "${SECRET_PATTERN}" 2>/dev/null; then
```

`git diff --cached -U0` prints the whole diff: added lines (`+`), removed lines
(`-`), and the `---`/`+++`/`@@` headers. Because `grep` runs over all of it:

1. **Removing a leaked secret fails.** The removed line shows up as
   `-AKIA...`, which matches, so you cannot commit the fix.
2. **Editing the hook trips the hook.** The `SECRET_PATTERN` line contains the
   literal text `PRIVATE KEY`, so any change to that line matches.

## Fix

Scan only added lines, and leave the hook file out of the scan:

```bash
if git diff --cached -U0 -- . ':(exclude).githooks/pre-commit' \
     | grep -E '^\+[^+]' \
     | grep -qE "${SECRET_PATTERN}"; then
```

- `'^\+[^+]'` keeps added lines and drops the `+++ b/file` header.
- The `:(exclude)` pathspec keeps the hook's own pattern line out of the diff.
- Remove the `2>/dev/null` after `grep -q`. It hides nothing useful, and if
  `grep` errored it would quietly count as "no secrets found".

Edge case: an added line whose content starts with `+` (so the diff shows
`++foo`) is skipped. For a fallback scanner that is an acceptable loss; gitleaks
still covers it when installed.

## Verification

```bash
# make gitleaks unavailable for this shell
PATH=$(echo "$PATH" | tr ':' '\n' | grep -v gitleaks | paste -sd:)
command -v gitleaks || echo "gitleaks hidden"

# 1. Adding a fake key must FAIL
echo 'key = "AKIAABCDEFGHIJKLMNOP"' > fake.txt
git add fake.txt && git commit -m "test: add" ; echo "exit=$?"   # expect non-zero

# 2. Removing it must SUCCEED
SKIP_SECRETS=1 git commit -m "test: add (bypass)"
git rm fake.txt && git commit -m "test: remove" ; echo "exit=$?"  # expect 0

# 3. Editing the hook's SECRET_PATTERN line must SUCCEED
```

Clean up the test commits afterwards (`git reset --hard HEAD~2` on a throwaway branch).

## Done when

With gitleaks uninstalled, a commit that removes a fake `AKIA...` line succeeds
and a commit that adds one still fails.
