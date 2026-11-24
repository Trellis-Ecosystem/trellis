// CLI integration tests using a mock stellar binary.
//
// These tests verify argument parsing, error handling, output formatting,
// and JSON serialization without requiring a live Soroban network.
//
// Run with:
//   cargo test --test cli_integration

use std::env;
use std::process::Command;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// Path to the mock stellar binary script
fn mock_stellar_path() -> String {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let script = if cfg!(windows) {
        "mock_stellar.bat"
    } else {
        "mock_stellar.sh"
    };
    format!("{}/tests/{}", manifest_dir, script)
}

/// Build a trellis CLI invocation with the mock stellar binary
fn trellis_cmd() -> Command {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_trellis"));
    cmd.env("TRELLIS_TEST_MODE", "true")
        .env("STELLAR_MOCK_BIN", mock_stellar_path())
        .env(
            "TRELLIS_CONTRACT_ID",
            "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        )
        .env(
            "TRELLIS_SOURCE_KEY",
            "SBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        );
    cmd
}

// ---------------------------------------------------------------------------
// Argument parsing tests
// ---------------------------------------------------------------------------

#[test]
fn test_init_parses_all_required_args() {
    let output = trellis_cmd()
        .args([
            "init",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--payer",
            "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
            "--payee",
            "GZYXWVUTSRQPONMLKJIHGFEDCBA234567ZYXWVUTSRQPONMLKJIHGFED",
            "--token",
            "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
            "--resolver",
            "GRESOLVABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ",
            "--amounts",
            "1000,2000,3000",
            "--dry-run",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "init with all required args should succeed (dry-run)\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn test_lock_funds_parses_required_args() {
    let output = trellis_cmd()
        .args([
            "lock-funds",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
            "--dry-run",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "lock with required args should succeed (dry-run)\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn test_status_requires_agreement_id() {
    let output = trellis_cmd()
        .args(["status"])
        .output()
        .expect("failed to execute trellis");

    assert!(
        !output.status.success(),
        "status without --agreement-id should fail"
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("agreement-id") || stderr.contains("required"),
        "error message should mention missing agreement-id"
    );
}

// ---------------------------------------------------------------------------
// Output format tests
// ---------------------------------------------------------------------------

#[test]
fn test_json_output_format() {
    let output = trellis_cmd()
        .args([
            "status",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--json",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "status --json should succeed\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains('{') && stdout.contains('}'),
        "JSON output should contain braces"
    );

    // Validate it's parseable JSON
    let result: Result<serde_json::Value, _> = serde_json::from_str(&stdout);
    assert!(
        result.is_ok(),
        "JSON output should be valid JSON\nstdout: {}",
        stdout
    );
}

#[test]
fn test_quiet_mode_suppresses_non_result_output() {
    let output = trellis_cmd()
        .args([
            "status",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--quiet",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "status --quiet should succeed\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    // In quiet mode, we should only get the JSON result, no other messages
    assert!(
        !stdout.contains("Invoking") && !stdout.contains("Success"),
        "quiet mode should suppress non-result messages"
    );
}

// ---------------------------------------------------------------------------
// Error path tests
// ---------------------------------------------------------------------------

#[test]
fn test_missing_stellar_binary_error() {
    // Temporarily unset the mock binary to simulate stellar not being in PATH
    let output = Command::new(env!("CARGO_BIN_EXE_trellis"))
        .args(["status", "--agreement-id", "0001"])
        .env_remove("STELLAR_MOCK_BIN")
        .env_remove("PATH") // Remove PATH to ensure stellar is not found
        .env(
            "TRELLIS_CONTRACT_ID",
            "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        )
        .output()
        .expect("failed to execute trellis");

    let stderr = String::from_utf8_lossy(&output.stderr);

    // The error should mention stellar CLI not being found
    assert!(
        stderr.contains("stellar") || stderr.contains("not found") || stderr.contains("install"),
        "error should mention stellar CLI\nstderr: {}",
        stderr
    );
}

#[test]
fn test_invalid_hex_agreement_id() {
    let output = trellis_cmd()
        .args(["status", "--agreement-id", "not-valid-hex", "--dry-run"])
        .output()
        .expect("failed to execute trellis");

    // Should fail with helpful error about hex format
    assert!(
        !output.status.success(),
        "invalid hex agreement-id should fail"
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("hex") || stderr.contains("invalid") || stderr.contains("format"),
        "error should mention invalid hex format\nstderr: {}",
        stderr
    );
}

/// #646: the confirmation prompt goes to stderr, so a `--json` run answered
/// with `n` leaves stdout free of prompt text.
#[test]
fn test_json_confirmation_prompt_goes_to_stderr() {
    use std::io::Write;
    use std::process::Stdio;

    let mut child = trellis_cmd()
        .args([
            "--json",
            "lock-funds",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to execute trellis");
    child
        .stdin
        .take()
        .expect("stdin is piped")
        .write_all(b"n\n")
        .expect("failed to write to stdin");
    let output = child.wait_with_output().expect("failed to wait for trellis");

    assert!(!output.status.success(), "answering `n` should abort");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.trim().is_empty() || serde_json::from_str::<serde_json::Value>(stdout.trim()).is_ok(),
        "stdout must be empty or a JSON envelope\nstdout: {stdout}"
    );
    assert!(!stdout.contains("Continue?"), "prompt leaked to stdout: {stdout}");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("Continue? [y/N]"),
        "prompt should be on stderr\nstderr: {stderr}"
    );
}

#[test]
fn test_missing_required_env_vars() {
    let output = Command::new(env!("CARGO_BIN_EXE_trellis"))
        .args(["status", "--agreement-id", "0001"])
        .env_remove("TRELLIS_CONTRACT_ID")
        .env_remove("TRELLIS_SOURCE_KEY")
        .output()
        .expect("failed to execute trellis");

    let stderr = String::from_utf8_lossy(&output.stderr);

    assert!(
        stderr.contains("TRELLIS_CONTRACT_ID") || stderr.contains("environment"),
        "error should mention missing environment variable\nstderr: {}",
        stderr
    );
}

// ---------------------------------------------------------------------------
// Command-specific tests
// ---------------------------------------------------------------------------

#[test]
fn test_init_with_multiple_milestones() {
    let output = trellis_cmd()
        .args([
            "init",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000002",
            "--payer",
            "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
            "--payee",
            "GZYXWVUTSRQPONMLKJIHGFEDCBA234567ZYXWVUTSRQPONMLKJIHGFED",
            "--token",
            "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
            "--resolver",
            "GRESOLVABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ",
            "--amounts",
            "1000,2000,3000,4000,5000",
            "--json",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "init with multiple milestones should succeed\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn test_submit_work_with_proof_uri() {
    let output = trellis_cmd()
        .args([
            "submit-work",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
            "--proof-uri",
            "ipfs://QmTest123",
            "--dry-run",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "submit with proof-uri should succeed (dry-run)\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn test_raise_dispute_requires_caller() {
    let output = trellis_cmd()
        .args([
            "raise-dispute",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
            "--caller",
            "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
            "--dry-run",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "dispute with caller should succeed (dry-run)\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn test_resolve_dispute_refund_flag() {
    let output = trellis_cmd()
        .args([
            "resolve-dispute",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
            "--refund-to-payer",
            "--dry-run",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "resolve with refund flag should succeed (dry-run)\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn test_batch_lock_with_multiple_ids() {
    let output = trellis_cmd()
        .args([
            "batch-lock-funds",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-ids",
            "0,1,2,3",
            "--dry-run",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "batch-lock with multiple IDs should succeed (dry-run)\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn test_completion_command_generates_shell_completions() {
    let output = trellis_cmd()
        .args(["completion", "bash"])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "completion should succeed\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("_trellis") || stdout.contains("complete"),
        "bash completion should contain completion function"
    );
}

// ---------------------------------------------------------------------------
// #406: --dry-run must not require the stellar binary
// ---------------------------------------------------------------------------

/// Confirms that `--dry-run` prints a command preview and exits 0 even when
/// the `stellar` binary is completely absent from PATH.
///
/// This is the core regression test for issue #406: `validate_environment()`
/// must be skipped for dry-run invocations.
#[test]
fn test_dry_run_works_without_stellar_binary() {
    let output = Command::new(env!("CARGO_BIN_EXE_trellis"))
        .args([
            "lock",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
            "--dry-run",
        ])
        // Wipe PATH so the stellar binary genuinely cannot be found.
        .env("PATH", "")
        .env(
            "TRELLIS_CONTRACT_ID",
            "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        )
        .env(
            "TRELLIS_SOURCE_KEY",
            "SBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        )
        .current_dir(env::var("CARGO_MANIFEST_DIR").unwrap())
        .output()
        .expect("failed to spawn trellis process");

    assert!(
        output.status.success(),
        "--dry-run should succeed even when stellar is not in PATH
stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("stellar") || stdout.contains("contract") || stdout.contains("invoke"),
        "--dry-run output should contain a stellar command preview
stdout: {}",
        stdout
    );
}

/// Adjacent regression test: without `--dry-run`, the binary check must still
/// fire and produce a clear error message when stellar is absent from PATH.
///
/// This guards against accidentally removing the check for non-dry-run paths
/// while fixing #406.
#[test]
fn test_non_dry_run_still_requires_stellar_binary() {
    let output = Command::new(env!("CARGO_BIN_EXE_trellis"))
        .args([
            "status",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
        ])
        // Wipe PATH so the stellar binary cannot be found.
        .env("PATH", "")
        .env(
            "TRELLIS_CONTRACT_ID",
            "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        )
        .env(
            "TRELLIS_SOURCE_KEY",
            "SBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        )
        .current_dir(env::var("CARGO_MANIFEST_DIR").unwrap())
        .output()
        .expect("failed to spawn trellis process");

    assert!(
        !output.status.success(),
        "non-dry-run should fail when stellar is not in PATH"
    );

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("stellar") || stderr.contains("not found") || stderr.contains("install"),
        "error message should mention the missing stellar binary
stderr: {}",
        stderr
    );
}

// ---------------------------------------------------------------------------
// Native RPC health probe (#467 / #468)
// ---------------------------------------------------------------------------

/// `trellis health` calls getHealth + getLatestLedger directly over HTTP
/// (no `stellar` binary) and reports both through the usual `--json`
/// envelope.
#[test]
fn test_health_reports_native_rpc_results() {
    let mut server = mockito::Server::new();
    let _health = server
        .mock("POST", "/")
        .match_body(mockito::Matcher::PartialJson(
            serde_json::json!({"method": "getHealth"}),
        ))
        .with_body(r#"{"jsonrpc":"2.0","id":1,"result":{"status":"healthy","latestLedger":100,"oldestLedger":1,"ledgerRetentionWindow":17280}}"#)
        .create();
    let _ledger = server
        .mock("POST", "/")
        .match_body(mockito::Matcher::PartialJson(
            serde_json::json!({"method": "getLatestLedger"}),
        ))
        .with_body(r#"{"jsonrpc":"2.0","id":1,"result":{"id":"abcd","protocolVersion":22,"sequence":100}}"#)
        .create();

    let output = trellis_cmd()
        // Prove the stellar binary is not needed for a native call.
        .env("STELLAR_MOCK_BIN", "/nonexistent/stellar")
        .args(["--rpc-url", &server.url(), "--json", "health"])
        .output()
        .expect("failed to execute trellis");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        output.status.success(),
        "health should succeed\nstdout: {stdout}\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let envelope: serde_json::Value =
        serde_json::from_str(stdout.trim()).expect("--json prints one JSON envelope");
    assert_eq!(envelope["status"], "success");
    assert_eq!(envelope["result"]["health"]["status"], "healthy");
    assert_eq!(envelope["result"]["latest_ledger"]["sequence"], 100);
    assert_eq!(envelope["result"]["latest_ledger"]["protocol_version"], 22);
    assert_eq!(envelope["result"]["latest_ledger"]["hash"], "abcd");
}

/// An endpoint that answers but reports itself unhealthy must fail the
/// command, and getLatestLedger is never attempted.
#[test]
fn test_health_fails_on_unhealthy_endpoint() {
    let mut server = mockito::Server::new();
    let _health = server
        .mock("POST", "/")
        .match_body(mockito::Matcher::PartialJson(
            serde_json::json!({"method": "getHealth"}),
        ))
        .with_body(r#"{"jsonrpc":"2.0","id":1,"result":{"status":"unhealthy"}}"#)
        .create();
    let ledger = server
        .mock("POST", "/")
        .match_body(mockito::Matcher::PartialJson(
            serde_json::json!({"method": "getLatestLedger"}),
        ))
        .expect(0)
        .create();

    let output = trellis_cmd()
        .args(["--rpc-url", &server.url(), "--json", "health"])
        .output()
        .expect("failed to execute trellis");

    assert!(
        !output.status.success(),
        "unhealthy endpoint must exit non-zero"
    );
    let envelope: serde_json::Value =
        serde_json::from_str(String::from_utf8_lossy(&output.stdout).trim()).expect("JSON");
    assert_eq!(envelope["status"], "error");
    assert!(
        envelope["error"]
            .as_str()
            .unwrap_or("")
            .contains("unhealthy"),
        "got: {envelope}"
    );
    ledger.assert();
}

fn dry_run(args: &[&str]) -> std::process::Output {
    trellis_cmd()
        .args(args)
        .args([
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
            "--dry-run",
        ])
        .output()
        .expect("failed to execute trellis")
}

#[test]
fn test_resolve_split_dry_run() {
    let out = dry_run(&["resolve", "--payer-amount", "30", "--payee-amount", "70"]);
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert!(String::from_utf8_lossy(&out.stdout).contains("resolve_dispute_split"));
}

#[test]
fn test_resolve_split_rejects_mixed_and_negative_flags() {
    let mixed = dry_run(&[
        "resolve-dispute",
        "--refund-to-payer",
        "--payer-amount",
        "1",
        "--payee-amount",
        "1",
    ]);
    assert!(!mixed.status.success());
    let lone = dry_run(&["resolve", "--payer-amount", "1"]);
    assert!(!lone.status.success());
    let negative = dry_run(&["resolve", "--payer-amount", "-1", "--payee-amount", "1"]);
    assert!(!negative.status.success());
}

#[test]
fn test_release_partial_dry_run() {
    let out = dry_run(&["release-partial", "--amount", "500"]);
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert!(String::from_utf8_lossy(&out.stdout).contains("release_partial"));
}

#[test]
fn test_release_partial_rejects_bad_amounts() {
    for bad in ["0", "-5", "abc"] {
        let out = dry_run(&["release-partial", "--amount", bad]);
        assert!(!out.status.success(), "amount {bad} should be rejected");
    }
}

// ---------------------------------------------------------------------------
// Native account sequence-number lookup (#470)
// ---------------------------------------------------------------------------

/// A base64-encoded `AccountEntry` XDR whose `seq_num` is 42.
///
/// Layout: AccountEntry { accountID (PublicKey), balance (int64), seqNum
/// (int64), numSubEntries (uint32), ... }. The sequence number is the 8-byte
/// big-endian value at byte offset 40 (4-byte discriminant + 32-byte ed25519
/// key, then the 8-byte balance, then the 8-byte seq_num).
fn account_entry_xdr_with_seq(seq: i64) -> String {
    let mut bytes = Vec::new();
    // AccountEntry discriminant (0).
    bytes.extend_from_slice(&0i32.to_be_bytes());
    // PublicKey discriminant (0 = ed25519) + 32-byte key.
    bytes.extend_from_slice(&0i32.to_be_bytes());
    bytes.extend_from_slice(&[7u8; 32]);
    // balance (int64)
    bytes.extend_from_slice(&1_000_0000i64.to_be_bytes());
    // seqNum (int64)
    bytes.extend_from_slice(&seq.to_be_bytes());
    // numSubEntries (uint32)
    bytes.extend_from_slice(&0u32.to_be_bytes());
    // flags (uint32)
    bytes.extend_from_slice(&0u32.to_be_bytes());
    // homeDomain (string, empty)
    bytes.extend_from_slice(&0u32.to_be_bytes());
    // thresholds (4 bytes)
    bytes.extend_from_slice(&[1u8, 0, 0, 0]);
    // signers (empty vec)
    bytes.extend_from_slice(&0u32.to_be_bytes());
    // ext (v0)
    bytes.extend_from_slice(&0i32.to_be_bytes());

    base64_encode(&bytes)
}

/// Minimal base64 encoder (standard alphabet, padded) so the test does not
/// depend on an extra dev-dependency.
fn base64_encode(input: &[u8]) -> String {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in input.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        out.push(ALPHABET[((triple >> 18) & 0x3f) as usize] as char);
        out.push(ALPHABET[((triple >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[((triple >> 6) & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(triple & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// Found case: `getLedgerEntries` returns the account entry and the decoded
/// sequence number is surfaced through the `--json` envelope.
#[test]
fn test_account_sequence_lookup_found() {
    let xdr = account_entry_xdr_with_seq(42);
    let mut server = mockito::Server::new();
    let _entries = server
        .mock("POST", "/")
        .match_body(mockito::Matcher::PartialJson(
            serde_json::json!({"method": "getLedgerEntries"}),
        ))
        .with_body(format!(
            r#"{{"jsonrpc":"2.0","id":1,"result":{{"entries":[{{"key":"AAAAAA==","xdr":"{xdr}","lastModifiedLedgerSeq":100,"liveUntilLedgerSeq":null}}],"latestLedger":100}}}}"#
        ))
        .create();

    let output = trellis_cmd()
        // Prove the stellar binary is not needed for a native call.
        .env("STELLAR_MOCK_BIN", "/nonexistent/stellar")
        .args([
            "--rpc-url",
            &server.url(),
            "--json",
            "account",
            "sequence",
            "--account",
            "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        ])
        .output()
        .expect("failed to execute trellis");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        output.status.success(),
        "sequence lookup should succeed\nstdout: {stdout}\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let envelope: serde_json::Value =
        serde_json::from_str(stdout.trim()).expect("--json prints one JSON envelope");
    assert_eq!(envelope["status"], "success");
    assert_eq!(envelope["result"]["sequence"], 42);
}

/// Not-found case: an empty `entries` array means the account is unfunded and
/// must produce a clear error rather than a panic or a bogus sequence.
#[test]
fn test_account_sequence_lookup_not_found() {
    let mut server = mockito::Server::new();
    let _entries = server
        .mock("POST", "/")
        .match_body(mockito::Matcher::PartialJson(
            serde_json::json!({"method": "getLedgerEntries"}),
        ))
        .with_body(r#"{"jsonrpc":"2.0","id":1,"result":{"entries":[],"latestLedger":100}}"#)
        .create();

    let output = trellis_cmd()
        .args([
            "--rpc-url",
            &server.url(),
            "--json",
            "account",
            "sequence",
            "--account",
            "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        !output.status.success(),
        "missing account must exit non-zero"
    );
    let envelope: serde_json::Value =
        serde_json::from_str(String::from_utf8_lossy(&output.stdout).trim()).expect("JSON");
    assert_eq!(envelope["status"], "error");
    let message = envelope["error"].as_str().unwrap_or("").to_lowercase();
    assert!(
        message.contains("not found") || message.contains("not funded"),
        "error should explain the account is missing, got: {envelope}"
    );
}

// ---------------------------------------------------------------------------
// Payee-side decline of an unfunded milestone (#464)
// ---------------------------------------------------------------------------

/// `decline-unfunded-milestone` must be available to the payee and preview the
/// correct contract entrypoint under `--dry-run`.
#[test]
fn test_decline_unfunded_milestone_dry_run() {
    let out = dry_run(&["decline-unfunded-milestone"]);
    assert!(
        out.status.success(),
        "decline-unfunded-milestone dry-run should succeed\nstderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(
        stdout.contains("decline_unfunded_milestone"),
        "dry-run should preview the decline_unfunded_milestone entrypoint\nstdout: {stdout}"
    );
}

/// The `--json` envelope for the decline command reports success and echoes the
/// milestone it acted on.
#[test]
fn test_decline_unfunded_milestone_json_output() {
    let out = trellis_cmd()
        .args([
            "decline-unfunded-milestone",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
            "--dry-run",
            "--json",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        out.status.success(),
        "decline-unfunded-milestone --json should succeed\nstderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let envelope: serde_json::Value =
        serde_json::from_str(String::from_utf8_lossy(&out.stdout).trim()).expect("JSON");
    assert_eq!(envelope["status"], "success");
}

// ---------------------------------------------------------------------------
// #652: every handler that takes --agreement-id must validate it
// ---------------------------------------------------------------------------

/// Every command whose handler must call `validate_agreement_id` first, with
/// the other arguments clap requires for it. When adding a command that takes
/// an agreement ID, add it here too.
fn agreement_id_commands() -> Vec<(&'static str, Vec<&'static str>)> {
    vec![
        (
            "init",
            vec![
                "--payer",
                "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
                "--payee",
                "GZYXWVUTSRQPONMLKJIHGFEDCBA234567ZYXWVUTSRQPONMLKJIHGFED",
                "--token",
                "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
                "--resolver",
                "GRESOLVABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ",
                "--milestones",
                "1000",
            ],
        ),
        ("lock-funds", vec!["--milestone-id", "0"]),
        ("submit-work", vec!["--milestone-id", "0"]),
        ("approve-release", vec!["--milestone-id", "0"]),
        (
            "raise-dispute",
            vec![
                "--milestone-id",
                "0",
                "--caller",
                "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
            ],
        ),
        ("resolve-dispute", vec!["--milestone-id", "0"]),
        ("cancel-milestone", vec!["--milestone-id", "0"]),
        ("status", vec![]),
        ("milestone-status", vec!["--milestone-id", "0"]),
    ]
}

/// Drives every handler without `--dry-run` with an agreement ID carrying an
/// injected suffix. Each must exit 1 with an `agreement_id` error before
/// anything is invoked, so removing the `validate_agreement_id` call from any
/// one handler lets the value through to the mock and fails this test.
#[test]
fn test_injected_agreement_id_rejected_by_every_command() {
    let injected = format!("{};x", "0".repeat(64));

    for (command, extra_args) in agreement_id_commands() {
        let output = trellis_cmd()
            .arg(command)
            .args(["--agreement-id", &injected])
            .args(&extra_args)
            .output()
            .expect("failed to execute trellis");

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        assert_eq!(
            output.status.code(),
            Some(1),
            "{command} must reject the injected agreement ID\nstdout: {stdout}\nstderr: {stderr}"
        );
        assert!(
            stderr.contains("agreement_id"),
            "{command} should report an agreement_id error\nstderr: {stderr}"
        );
        // Nothing reached `stellar contract invoke`, so there is no result.
        assert!(
            stdout.trim().is_empty(),
            "{command} must not invoke stellar\nstdout: {stdout}"
        );
    }
}

// ---------------------------------------------------------------------------
// #650: end-to-end runs against the mock (no --dry-run)
// ---------------------------------------------------------------------------

#[test]
fn test_status_runs_against_mock() {
    let output = trellis_cmd()
        .args([
            "status",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "status should succeed against the mock\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("agreement_id"));
}

#[test]
fn test_milestone_status_runs_against_mock() {
    let output = trellis_cmd()
        .args([
            "milestone-status",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000001",
            "--milestone-id",
            "0",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "milestone-status should succeed against the mock\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("Pending"));
}

#[test]
fn test_init_runs_against_mock() {
    let output = trellis_cmd()
        .args([
            "init",
            "--agreement-id",
            "0000000000000000000000000000000000000000000000000000000000000003",
            "--payer",
            "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
            "--payee",
            "GZYXWVUTSRQPONMLKJIHGFEDCBA234567ZYXWVUTSRQPONMLKJIHGFED",
            "--token",
            "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX",
            "--resolver",
            "GRESOLVABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQ",
            "--milestones",
            "1000,2000",
            "--yes",
        ])
        .output()
        .expect("failed to execute trellis");

    assert!(
        output.status.success(),
        "init should succeed against the mock\nstderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}
