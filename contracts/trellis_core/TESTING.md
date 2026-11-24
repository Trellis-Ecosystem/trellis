# Testing Guide

This document describes the comprehensive test suite for the Trellis escrow contract.

## Test Categories

### 1. Example-Based Tests (`src/test.rs`)

Traditional unit tests covering specific scenarios:

```bash
cargo test
```

**Coverage includes:**
- Happy path (init → lock → submit → approve → release)
- Error paths (double init, invalid state transitions)
- Dispute flows (raise → resolve)
- Multi-milestone agreements
- Batch operations

### 2. Property-Based Tests (`src/test_properties.rs`)

Randomized tests that verify invariants across thousands of input combinations using `proptest`:

```bash
# Run with default case count (256)
cargo test test_properties

# Run with expanded case count for thorough coverage
PROPTEST_CASES=10000 cargo test test_properties
```

**Invariants verified:**
1. **Balance conservation** — contract balance always equals locked funds
2. **State machine integrity** — transitions follow valid paths
3. **Zero/negative amount rejection** — invalid milestones always fail
4. **Total amount integrity** — sum matches pre-computed total
5. **Milestone state isolation** — operations on one milestone don't affect others

### 3. Gas Cost Benchmarks (`benches/contract_bench.rs`)

Measures CPU and memory costs for all contract entrypoints:

```bash
cargo bench --bench contract_bench
```

**Output format:**
```json
[
  {"benchmark":"init_1_milestone","cpu_instructions":12345,"memory_bytes":6789},
  {"benchmark":"lock_funds","cpu_instructions":23456,"memory_bytes":7890},
  ...
]
```

Use this JSON output in CI to detect gas regressions (>10% increase).

**Benchmarked operations:**
- `init` (1 milestone and 10 milestones)
- `lock_funds` (1 milestone and 10 milestones — the 10-milestone case is the
  regression guard for #401: a milestone state transition must cost the same
  regardless of how many milestones the agreement has)
- `submit_work`
- `approve_and_release`
- `raise_dispute`
- `resolve_dispute`
- `batch_lock_funds` (5 milestones)
- `get_agreement`
- `release_partial` (writes two ledger entries)
- `resolve_dispute_split` (two token transfers)
- `cancel_unfunded_milestone`

### 4. Mutation Testing (`mutants.toml`)

Verifies test suite effectiveness by introducing code mutations and checking if tests catch them:

```bash
# Install cargo-mutants
cargo install --locked cargo-mutants

# Run mutation testing (targets >80% kill rate)
cargo mutants

# Run on specific files
cargo mutants --file src/lib.rs

# Run with timeout adjustment
cargo mutants --timeout 120
```

**Configuration:**
- Focused on `src/lib.rs`, `src/errors.rs`, `src/types.rs`
- Excludes infrastructure code (`events.rs`, `storage.rs`)
- 60-second timeout per mutant
- Release mode for faster feedback

**Interpreting results:**
- **Caught mutants** — tests correctly detect the mutation (good)
- **Missed mutants** — mutation not detected, indicates weak test coverage
- **Timeout mutants** — mutation caused tests to hang
- **Build failed** — mutation broke compilation

**Target:** >80% mutation kill rate

### 5. Snapshot Files (`test_snapshots/`)

The Soroban SDK test environment writes a JSON snapshot under
`test_snapshots/` for every test that uses the default `Env`. In this crate
that means the hand-written suites (`test.rs`, `test_storage.rs`). Snapshots
are regenerated automatically on each `cargo test` run — there is no separate
update command or tool to install.

Property and panic-boundary tests do **not** write snapshots: their shared
fixture `setup_mocked` uses `EnvTestConfig { capture_snapshot_at_drop: false }`,
because one file per generated case added thousands of tracked files.

**Reviewing snapshot diffs:** after `cargo test`, inspect any changed JSON in
`test_snapshots/` and confirm it reflects the intended ledger-state change
(e.g. new storage keys, changed balances, or altered event data). Commit the
updated snapshots alongside the code change that caused them. CI fails on
stale snapshots, so a forgotten update will surface as a failing check.

## CI Integration

### GitHub Actions Example

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    # Example-based and property tests
    - name: Run tests
      run: cargo test
    
    # Property tests with expanded case count
    - name: Run property tests (extended)
      run: PROPTEST_CASES=8192 cargo test test_properties
    
    # Gas benchmarks (save for comparison)
    - name: Run gas benchmarks
      run: cargo bench --bench contract_bench > gas_costs.json
    
    # Mutation testing (weekly schedule)
    - name: Run mutation tests
      if: github.event.schedule == '0 0 * * 0'  # Sundays only
      run: |
        cargo install --locked cargo-mutants
        # --output names a directory; results land in mutants-out/mutants.out/outcomes.json
        cargo mutants --output mutants-out
    
    # Gas regression check
    - name: Check gas costs
      run: |
        python scripts/compare_gas_costs.py baseline.json gas_costs.json
```

### Gas Regression Check in CI

On every pull request the `gas-benchmarks` job runs
`cargo bench --bench contract_bench` and then invokes
`scripts/compare_gas_costs.py` with a 10% threshold, comparing the freshly
produced `contracts/trellis_core/gas_costs.json` against the committed
baseline at `contracts/trellis_core/baseline_gas_costs.json`. A pull request
that raises any benchmarked entrypoint's CPU cost by more than 10% fails the
job.

### Regenerating the Baseline

After an intentional performance change (or when adding a benchmark), refresh
the committed baseline from a clean run on the target commit:

```bash
cd contracts/trellis_core
cargo bench --bench contract_bench > baseline_gas_costs.json
git add baseline_gas_costs.json
git commit -m "chore: refresh gas baseline"
```

Review the diff before committing — only the expected benchmarks should move.

## Test Development Guidelines

### When to Add Example-Based Tests

- New entrypoint or command
- Specific bug fix (regression test)
- Complex business logic path
- Integration of multiple components

### When to Add Property-Based Tests

- Invariants that should hold for all inputs
- State machine correctness across random sequences
- Balance/amount calculations
- Cross-milestone interactions

### When to Update Benchmarks

- New entrypoint added
- Significant algorithm change
- After optimization work
- Before/after SDK upgrades

## Performance Targets

The committed baseline (`contracts/trellis_core/baseline_gas_costs.json`) is
the source of truth for per-operation costs. CI flags any pull request that
exceeds a benchmarked entrypoint's baseline CPU cost by more than 10%.

| Operation | CPU (baseline) | Memory (baseline) |
|-----------|----------------|-------------------|
| init (1 milestone) | see `baseline_gas_costs.json` | see `baseline_gas_costs.json` |
| lock_funds | see `baseline_gas_costs.json` | see `baseline_gas_costs.json` |
| approve_and_release | see `baseline_gas_costs.json` | see `baseline_gas_costs.json` |
| release_partial | see `baseline_gas_costs.json` | see `baseline_gas_costs.json` |
| resolve_dispute_split | see `baseline_gas_costs.json` | see `baseline_gas_costs.json` |
| cancel_unfunded_milestone | see `baseline_gas_costs.json` | see `baseline_gas_costs.json` |

Regenerate the baseline with `cargo bench --bench contract_bench` as described
above whenever costs change intentionally.

## Debugging Failed Tests

### Property Test Failures

Proptest automatically shrinks failing inputs to minimal reproducible cases:

```bash
# Failed test shows:
# thread 'prop_balance_conservation_happy_path' panicked at ...
# minimal failing input: amounts = [1, 2]

# Re-run with a different RNG seed (decimal u64). The suites use a fixed
# seed (0x5454_5454) by default so runs and snapshots are reproducible;
# PROPTEST_RNG_SEED overrides it. (proptest does not read `PROPTEST_SEED`.)
PROPTEST_RNG_SEED=12345 cargo test prop_balance_conservation_happy_path

# Raise the number of cases per property (default 256)
PROPTEST_CASES=1000 cargo test test_properties
```

### Gas Regression Failures

```bash
# Run benchmark on both commits
git checkout master
cargo bench --bench contract_bench > baseline.json

git checkout feature-branch
cargo bench --bench contract_bench > current.json

# Compare
diff baseline.json current.json
```

### Mutation Test Failures (Missed Mutants)

Example: Mutant changes `if status == Pending` to `if status != Pending` and tests still pass.

**Fix:** Add test covering the Pending status specifically:

```rust
#[test]
fn test_cancel_only_works_on_pending() {
    // ... setup ...
    client.lock_funds(&id, &0);  // Now Funded, not Pending
    
    let result = client.try_cancel_unfunded_milestone(&id, &0);
    assert_eq!(result, Err(Ok(TrellisError::InvalidStateTransition)));
}
```

## Resources

- [proptest documentation](https://docs.rs/proptest/)
- [cargo-mutants guide](https://mutants.rs/)
- [Soroban testing guide](https://developers.stellar.org/docs/smart-contracts/testing)
