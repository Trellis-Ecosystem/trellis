# Issue #687 — `compare_gas_costs.py` Documents `--threshold 10` but Only Takes a Bare Positional and Crashes on Bad JSON

**Issue:** [#687](https://github.com/Trellis-Ecosystem/trellis/issues/687)  
**Branch:** `fix/compare-gas-costs-argparse`  
**Scope:** `scripts/compare_gas_costs.py`, new `scripts/test_compare_gas_costs.py`

---

## Background

`scripts/compare_gas_costs.py` compares two gas-benchmark JSON files (baseline vs. current) and exits 1 if CPU or memory cost regressed by more than a threshold percentage. It is meant to back the PR gas-regression check in `advanced-testing.yml`, which is still a commented-out TODO (`gas-benchmarks` job, "Compare with baseline" step).

---

## Current State

### 1. Usage text and argument parsing disagree

The docstring (line 6) says:

```
python compare_gas_costs.py baseline.json current.json [--threshold 10]
```

but `main()` (line 101) does:

```python
threshold = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
```

So the documented form fails:

```console
$ python scripts/compare_gas_costs.py a.json b.json --threshold 5
ValueError: could not convert string to float: '--threshold'
```

### 2. Malformed input produces a traceback

`load_benchmarks` (lines 17–28) assumes the file is a JSON **array** of objects that each have `benchmark`, `cpu_instructions` and `memory_bytes`. Anything else raises:

| Input | Exception |
|---|---|
| Entry missing a key | `KeyError` |
| Top level is an object, number or `null` | `TypeError` / `AttributeError`-style failure while iterating or indexing |
| Entry is a string instead of an object | `TypeError` |

Only `FileNotFoundError` and `json.JSONDecodeError` are caught (lines 103–110), so these surface as raw tracebacks.

### 3. No tests, not wired into CI

There is no test for the script, and `advanced-testing.yml` never calls it.

---

## Required Change

### Switch to `argparse`

```python
import argparse

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Compare gas costs between baseline and current benchmark runs.")
    p.add_argument("baseline", help="Baseline benchmark JSON file")
    p.add_argument("current", help="Current benchmark JSON file")
    p.add_argument("--threshold", type=float, default=10.0,
                   help="Regression threshold in percent (default: 10)")
    return p.parse_args(argv)
```

Update the module docstring to match (and document exit code 1 for malformed input).

### Validate input and fail cleanly

Either validate inside `load_benchmarks` or catch the errors in `main()`:

```python
    except (KeyError, TypeError) as e:
        print(f"Error: malformed benchmark file: {e}", file=sys.stderr)
        sys.exit(1)
```

Raising a descriptive `ValueError` from `load_benchmarks` (naming the file and the offending entry index/key) gives a better message; if so, catch `ValueError` in `main()` as well. Print errors to **stderr**.

`main()` should accept an optional `argv` so tests can call it without patching `sys.argv`.

### Add tests

New file `scripts/test_compare_gas_costs.py` (pytest), using `tmp_path` to write fixtures:

| Test | Expectation |
|---|---|
| `--threshold 5` with a 7% regression | exit 1, "REGRESSION DETECTED" |
| `--threshold 10` (or default) with a 7% regression | exit 0 |
| Entry missing `memory_bytes` | exit 1, stderr contains "malformed benchmark file", no traceback |
| Top-level JSON object instead of array | exit 1, readable error |
| Missing file | exit 1 |

Run with: `python -m pytest scripts/test_compare_gas_costs.py`.

### CI (optional, follow-up)

Wiring the script into the `gas-benchmarks` job needs a committed or downloaded baseline and is out of scope here; at minimum, add a step that runs the pytest file so the script can't silently regress.

---

## Files Affected

| File | Change |
|---|---|
| `scripts/compare_gas_costs.py` | `argparse` with `--threshold` (default 10); catch/raise clear errors for malformed files; exit 1; fix docstring |
| `scripts/test_compare_gas_costs.py` | New pytest covering `--threshold` parsing and malformed-input handling |

---

## Done When

- `python scripts/compare_gas_costs.py a.json b.json --threshold 5` runs and applies a 5% threshold.
- A benchmark file with a missing key exits **1** with a readable `malformed benchmark file` message instead of a traceback.
- `python -m pytest scripts/test_compare_gas_costs.py` passes.
- PR description contains `Closes #687`.
