# Issue #688 — Release Workflow's `dry_run` Rehearsal Still Pushes a Regenerated CHANGELOG.md to the Default Branch

**Issue:** [#688](https://github.com/Trellis-Ecosystem/trellis/issues/688)  
**Branch:** `fix/release-dry-run-changelog-push`  
**Scope:** `.github/workflows/release.yml` (lines 13–17, 34–98, 253)

---

## Background

`release.yml` can be triggered two ways:

1. **Tag push** (`v*`) — the real release.
2. **`workflow_dispatch`** — a manual rehearsal. The header comment (lines 13–17) promises that with `dry_run: true` (the default) *"a rehearsal never publishes"*.

That promise is only half kept. The `release` job is gated (line 253):

```yaml
if: ${{ github.event_name != 'workflow_dispatch' || inputs.dry_run == false }}
```

…but the `changelog` job is not, and it **writes to the repository**.

---

## Current State

The `changelog` job (line 34) has `contents: write` (line 39). Its last step, `Commit updated CHANGELOG.md` (lines 83–98), runs unconditionally:

```yaml
      - name: Commit updated CHANGELOG.md
        run: |
          ...
          git commit -m "chore(release): update CHANGELOG.md for ${GITHUB_REF_NAME}"
          git pull --rebase origin "$DEFAULT_BRANCH"
          git push origin "HEAD:$DEFAULT_BRANCH"
```

On a `workflow_dispatch` dry run from any branch:

- git-cliff regenerates `CHANGELOG.md` from **that branch's** history (which may contain unmerged commits).
- The commit message uses `GITHUB_REF_NAME`, which is the **branch name** (e.g. `update CHANGELOG.md for feat/foo`), not a version tag.
- The result is pushed straight to `master`.

So a "rehearsal" mutates the default branch with a changelog that may reference work that was never merged.

---

## Required Change

Gate the push step on the same condition the `release` job already uses:

```yaml
      # Committed changelog — only on a real release. A dry-run rehearsal must
      # not touch the default branch (#688).
      - name: Regenerate committed CHANGELOG.md
        if: ${{ github.event_name != 'workflow_dispatch' || inputs.dry_run == false }}
        uses: orhun/git-cliff-action@a9a95522b26fe6403f7bb24031f21fb573d0f5ff # v4.9.1
        with:
          config: cliff.toml
          args: --output CHANGELOG.md
        env:
          OUTPUT: CHANGELOG.md

      - name: Commit updated CHANGELOG.md
        if: ${{ github.event_name != 'workflow_dispatch' || inputs.dry_run == false }}
        run: |
          ...
```

Notes:

- On a tag push `inputs.dry_run` is empty, so the first clause is true — tag releases are unaffected.
- Guarding the **regeneration** step too keeps the dry run honest: the `changelog` artifact uploaded earlier (`--latest --strip header`) is still produced, so the rehearsal still exercises git-cliff.
- Optionally, use `${{ needs.changelog.outputs.version }}` / `steps.version.outputs.version` in the commit message instead of `GITHUB_REF_NAME`, so a non-dry manual run commits `for v0.2.0` rather than `for master`.
- Optionally, update the comment at lines 13–17 to say the dry run also skips the CHANGELOG.md push.

`contents: write` can stay on the job; it is still needed for real releases.

---

## Files Affected

| File | Change |
|---|---|
| `.github/workflows/release.yml` | Add the `dry_run` `if:` guard to the `Regenerate committed CHANGELOG.md` and `Commit updated CHANGELOG.md` steps; optionally fix the commit message and header comment |

---

## Done When

- A `workflow_dispatch` run with `dry_run=true` completes and **no commit** appears on `master` (the two guarded steps show as skipped).
- A real `v*` tag push still regenerates and pushes `CHANGELOG.md`.
- PR description contains `Closes #688`.
