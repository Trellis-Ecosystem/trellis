# CLI Integration Tests

This directory contains integration tests for the Trellis CLI using a mock `stellar` binary.

## Overview

The tests verify:
- Argument parsing for all commands
- Error handling (missing args, invalid formats, missing env vars)
- Output formatting (JSON, human-readable, quiet mode)
- Success and error paths for each entrypoint

## Running Tests

```bash
# Run all CLI integration tests
cd cli/trellis_cli
cargo test --test cli_integration

# Run specific test
cargo test --test cli_integration test_json_output_format

# Run with verbose output
cargo test --test cli_integration -- --nocapture
```

## Mock Stellar Binary

The tests use platform-specific mock scripts that simulate `stellar` CLI responses:

- **Unix/Linux/macOS**: `mock_stellar.sh`
- **Windows**: `mock_stellar.bat`

The mock returns controlled responses based on command arguments, enabling:
- Tests without a live Soroban network
- Fast, deterministic test execution
- Coverage of error paths

## Environment Variables

The test suite sets:
- `TRELLIS_TEST_MODE=true` — CLI detects test mode
- `STELLAR_MOCK_BIN=./tests/mock_stellar.sh` — Path to mock binary
- `TRELLIS_CONTRACT_ID` — Mock contract address
- `TRELLIS_SOURCE_KEY` — Mock signing key

## Adding New Tests

### Command Success Path

```rust
#[test]
fn test_new_command_success() {
    let output = trellis_cmd()
        .args([
            "new-command",
            "--required-arg", "value",
            "--dry-run"
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "new-command should succeed\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}
```

### Command Error Path

```rust
#[test]
fn test_new_command_missing_required_arg() {
    let output = trellis_cmd()
        .args(["new-command"])
        .output()
        .expect("failed to execute trellis");

    assert!(
        !output.status.success(),
        "new-command without required arg should fail"
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("required-arg"),
        "error should mention missing argument"
    );
}
```

### Mock Response

Update `mock_stellar.sh` and `mock_stellar.bat`:

```bash
# mock_stellar.sh
case "$FUNC_NAME" in
    new_function)
        echo '{"result": "success"}'
        exit 0
        ;;
```

## Test Categories

### Argument Parsing
- `test_init_parses_all_required_args`
- `test_lock_funds_parses_required_args`
- `test_status_requires_agreement_id`

### Output Formats
- `test_json_output_format`
- `test_quiet_mode_suppresses_non_result_output`

### Error Paths
- `test_missing_stellar_binary_error`
- `test_invalid_hex_agreement_id`
- `test_missing_required_env_vars`

### Command-Specific
- `test_init_with_multiple_milestones`
- `test_submit_work_with_proof_uri`
- `test_raise_dispute_requires_caller`
- `test_batch_lock_with_multiple_ids`

## Troubleshooting

### Mock script not executing

**Unix**: Ensure the script is executable:
```bash
chmod +x tests/mock_stellar.sh
```

**Windows**: Check file associations and permissions.

### Tests fail with "stellar not found"

The mock path may be incorrect. Verify `STELLAR_MOCK_BIN` points to the right script:

```rust
fn mock_stellar_path() -> String {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    format!("{}/tests/mock_stellar.sh", manifest_dir)
}
```

### JSON parsing errors

Check that the mock script outputs valid JSON:

```bash
./tests/mock_stellar.sh contract invoke -- get_agreement | jq .
```

## CI Integration

```yaml
test-cli:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions-rust-lang/setup-rust-toolchain@v1
    
    - name: Make mock executable
      run: chmod +x cli/trellis_cli/tests/mock_stellar.sh
    
    - name: Run CLI tests
      working-directory: cli/trellis_cli
      run: cargo test --test cli_integration
```

## Future Enhancements

- [ ] Add tests for network-specific behavior (testnet vs mainnet)
- [ ] Mock RPC error responses (rate limits, network errors)
- [ ] Test transaction simulation mode
- [ ] Add performance benchmarks for CLI operations
- [ ] Test shell completion generation for all supported shells
