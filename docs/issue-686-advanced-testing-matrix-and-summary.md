# Issue #686 — Advanced Testing CLI Matrix Cancels macOS/Windows Legs on First Failure and `test-summary` Ignores Two Jobs

**Issue:** [#686](https://github.com/Trellis-Ecosystem/trellis/issues/686)  
**Branch:** `fix/advanced-testing-fail-fast-summary`  
**Scope:** `.github/workflows/advanced-testing.yml` (lines 179–184, 230–244)

---

## Background

`advanced-testing.yml` runs the heavy suites — property tests, gas benchmarks, mutation tests, a cross-OS CLI integration matrix and coverage — and ends with a `test-summary` job meant to give one pass/fail signal for the whole workflow. Two problems make that signal unreliable.

---

## Current State

### 1. Matrix uses the default `fail-fast: true`

```yaml
  cli-integration-tests:
    name: CLI Integration Tests
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
```

With no `fail-fast` key, GitHub cancels every remaining leg as soon as one fails. In run [38105449697](https://github.com/Trellis-Ecosystem/trellis/actions/runs/38105449697) the ubuntu leg failed and the macOS and Windows legs were reported **cancelled** at `Setup Rust` — so there was no information about whether the failure was Linux-specific. The whole point of the matrix is cross-OS signal.

### 2. `test-summary` doesn't depend on every job

```yaml
  test-summary:
    needs: [property-tests, gas-benchmarks, cli-integration-tests]
    if: always()
```

`test-coverage` and `mutation-tests` are missing. A failure in either never reaches the summary, which still prints **"✅ All tests passed"** — misleading anyone (or any branch protection rule) that looks only at the summary.

`mutation-tests` is conditional (`if: github.event_name == 'schedule' || inputs.run_mutation_tests`), so on ordinary push/PR runs its result is `skipped`. The summary must treat that as acceptable.

---

## Required Change

### Disable fail-fast on the matrix

```yaml
  cli-integration-tests:
    name: CLI Integration Tests
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
```

This matches `codeql-analysis.yml`, `frontend-ci.yml` and `release.yml` → `build-cli`, which already set `fail-fast: false`.

### Make `test-summary` cover every job

```yaml
  test-summary:
    name: Test Summary
    runs-on: ubuntu-latest
    needs: [property-tests, gas-benchmarks, mutation-tests, cli-integration-tests, test-coverage]
    if: always()
    steps:
      - name: Check all tests passed
        env:
          PROPERTY: ${{ needs.property-tests.result }}
          GAS: ${{ needs.gas-benchmarks.result }}
          MUTATION: ${{ needs.mutation-tests.result }}
          CLI: ${{ needs.cli-integration-tests.result }}
          COVERAGE: ${{ needs.test-coverage.result }}
        run: |
          fail=0
          for pair in "property-tests:$PROPERTY" "gas-benchmarks:$GAS" \
                      "cli-integration-tests:$CLI" "test-coverage:$COVERAGE"; do
            name="${pair%%:*}"; result="${pair#*:}"
            echo "$name: $result"
            [ "$result" = "success" ] || fail=1
          done
          # mutation-tests only runs on the weekly schedule or on request.
          echo "mutation-tests: $MUTATION"
          case "$MUTATION" in success|skipped) ;; *) fail=1 ;; esac

          if [ "$fail" -ne 0 ]; then
            echo "❌ Some tests failed"
            exit 1
          fi
          echo "✅ All tests passed"
```

Passing results through `env:` rather than interpolating `${{ }}` into the script is the safer pattern and makes the per-job outcome visible in the log.

---

## Files Affected

| File | Change |
|---|---|
| `.github/workflows/advanced-testing.yml` | Add `fail-fast: false` to the `cli-integration-tests` matrix; add `mutation-tests` and `test-coverage` to `test-summary.needs` and check their results (`skipped` allowed for mutation tests) |

---

## Done When

- A failing ubuntu leg no longer cancels the macOS and Windows legs; all three report their own result.
- `test-summary` fails when `test-coverage` fails.
- `test-summary` still passes on a normal push/PR where `mutation-tests` is skipped.
- PR description contains `Closes #686`.
