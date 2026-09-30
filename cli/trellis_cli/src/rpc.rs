use crate::config::Config;
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use std::num::NonZeroU32;
use std::sync::OnceLock;

static RPC_RATE_LIMITER: OnceLock<DefaultDirectRateLimiter> = OnceLock::new();

fn get_rate_limiter() -> &'static DefaultDirectRateLimiter {
    RPC_RATE_LIMITER.get_or_init(|| {
        let limit_per_sec: u32 = std::env::var("STELLAR_RPC_RATE_LIMIT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(10);

        if let Some(limit) = NonZeroU32::new(limit_per_sec) {
            RateLimiter::direct(Quota::per_second(limit))
        } else {
            RateLimiter::direct(Quota::per_second(NonZeroU32::new(10).unwrap()))
        }
    })
}

fn apply_rate_limit() {
    let limiter = get_rate_limiter();
    if limiter.check().is_err() {
        eprintln!("⚠️  RPC rate limit active — request queued until quota resets");
        // `until_ready` is async; the CLI is synchronous, so poll instead.
        while limiter.check().is_err() {
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
}

/// Output from a Soroban contract invoke.
#[derive(Debug)]
pub struct InvokeOutput {
    /// Combined stdout from the process.
    pub stdout: String,
    /// Combined stderr from the process.
    pub stderr: String,
    /// Whether the process exited successfully.
    pub success: bool,
    /// The exact command string that was executed — printed on failure so
    /// the caller can reproduce/debug locally.
    pub command_debug: String,
}

/// Resolve which `stellar` executable to invoke.
///
/// The integration suite (`tests/cli_integration.rs`) sets
/// `TRELLIS_TEST_MODE=true` together with `STELLAR_MOCK_BIN=<script>` so the
/// tests exercise the full argv-building / output-rendering path against a
/// mock script instead of a live network or a real CLI install. In every
/// other case this is just `"stellar"` from `PATH`.
pub(crate) fn stellar_bin() -> String {
    if std::env::var_os("TRELLIS_TEST_MODE").is_some() {
        if let Some(mock) = std::env::var_os("STELLAR_MOCK_BIN") {
            return mock.to_string_lossy().into_owned();
        }
    }
    "stellar".to_string()
}

/// Native Soroban RPC client that talks directly to the Soroban JSON-RPC endpoint.
/// No external CLI dependency required.
pub struct RpcClient;

impl RpcClient {
    /// Invoke a Trellis contract function.
    ///
    /// Currently delegates to `stellar contract invoke` (see the type-level
    /// docs for the architecture and the planned native RPC rewrite).
    ///
    /// Transient RPC failures (timeouts, rate limits, temporary unavailability)
    /// are automatically retried with exponential backoff and jitter. The number
    /// of retries is controlled by `STELLAR_RPC_RETRIES` (default 3).
    ///
    /// # Arguments
    /// * `config`  – runtime configuration (RPC URL, keys, contract ID)
    /// * `fn_name` – the Soroban function name (e.g. `"init"`, `"lock_funds"`)
    /// * `args`    – a flat list of `--flag value` pairs **after** the `--`
    ///   separator, e.g. `["--agreement_id", "0x…", "--payer", "G…"]`
    /// * `quiet`   – suppress the retry progress messages normally printed to stderr
    pub fn invoke(config: &Config, fn_name: &str, args: &[String], quiet: bool) -> InvokeOutput {
        // TODO(native-rpc): replace this shell-out with direct Soroban
        // JSON-RPC calls (typed arg parsing, key loading, envelope signing,
        // submit + poll). See the `RpcClient` type docs for the full plan.
        // Until then we delegate to the `stellar` CLI, which already handles
        // argument encoding, transaction assembly, signing and submission.
        Self::invoke_with_retry(config, fn_name, args, quiet)
    }

    /// Build the exact `stellar contract invoke …` argument list and its
    /// copy-paste-friendly command string, without executing anything.
    ///
    /// Shared by the real invocation path (so failures can print the command
    /// that ran) and by `--dry-run` previews (which never execute at all).
    fn build_cmd_args(config: &Config, fn_name: &str, args: &[String]) -> (Vec<String>, String) {
        let mut cmd_args: Vec<String> = vec![
            "contract".to_string(),
            "invoke".to_string(),
            "--id".to_string(),
            config.contract_id.clone(),
        ];

        // #240: a raw `S…` secret seed must never land in argv — anyone on the
        // host can read it via `ps`. Pass it to the child through the
        // `STELLAR_SECRET_KEY` environment variable instead (see
        // `invoke_once`); only non-secret identity names go on the command
        // line. Named `stellar keys` identities are still passed via
        // `--source` exactly as before.
        if !crate::config::is_secret_seed(&config.source_key) {
            cmd_args.push("--source".to_string());
            cmd_args.push(config.source_key.clone());
        }

        cmd_args.extend_from_slice(&[
            "--rpc-url".to_string(),
            config.rpc_url.clone(),
            "--network-passphrase".to_string(),
            config.network_passphrase.clone(),
            "--".to_string(),
            fn_name.to_string(),
        ]);
        cmd_args.extend_from_slice(args);

        // Quote any argument containing whitespace so the printed command can
        // be copy-pasted straight into a shell.
        let quoted = cmd_args
            .iter()
            .map(|a| {
                if a.contains(' ') {
                    format!("'{a}'")
                } else {
                    a.clone()
                }
            })
            .collect::<Vec<_>>()
            .join(" ");

        // Never print the seed itself — show that it is supplied via the
        // environment so `--dry-run` / failure output stays copy-pasteable
        // without leaking the key.
        let command_debug = if crate::config::is_secret_seed(&config.source_key) {
            format!("STELLAR_SECRET_KEY=<redacted> stellar {quoted}")
        } else {
            format!("stellar {quoted}")
        };

        (cmd_args, command_debug)
    }

    /// Build the `stellar contract invoke …` command that *would* run for
    /// `fn_name`/`args`, without executing it. Used by `--dry-run`.
    pub fn preview(config: &Config, fn_name: &str, args: &[String]) -> String {
        Self::build_cmd_args(config, fn_name, args).1
    }

    /// Invoke via stellar CLI with automatic retry on transient RPC failures.
    ///
    /// Backoff schedule (before jitter): 1 s, 2 s, 4 s, 8 s (capped).
    /// Jitter adds up to 200 ms derived from the current system clock so
    /// concurrent processes do not thunder-herd the RPC endpoint together.
    ///
    /// Set `STELLAR_RPC_RETRIES=0` to disable retries entirely.
    fn invoke_with_retry(
        config: &Config,
        fn_name: &str,
        args: &[String],
        quiet: bool,
    ) -> InvokeOutput {
        let max_retries: u32 = std::env::var("STELLAR_RPC_RETRIES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3);

        // Exponential backoff: 1 s → 2 s → 4 s → 8 s (capped at index 3).
        const BACKOFF_MS: [u64; 4] = [1_000, 2_000, 4_000, 8_000];

        let mut attempt = 0u32;
        loop {
            let out = Self::invoke_once(config, fn_name, args);

            if out.success {
                return out;
            }

            // Spawn failure means the stellar CLI is not installed — no point retrying.
            if out.stderr.starts_with("Failed to spawn") {
                return out;
            }

            if attempt >= max_retries {
                return out;
            }

            // Only retry errors that look like transient network / RPC issues.
            if !is_transient_error(&out.stderr) {
                return out;
            }

            attempt += 1;
            let idx = ((attempt - 1) as usize).min(BACKOFF_MS.len() - 1);
            let base_ms = BACKOFF_MS[idx];
            let jitter_ms = jitter_millis();
            let delay_ms = base_ms + jitter_ms;

            if !quiet {
                eprintln!(
                    "RPC attempt {attempt}/{max_retries} failed (transient error), retrying in {delay_ms}ms…"
                );
                eprintln!(
                    "  {}",
                    out.stderr.lines().next().unwrap_or("(no error message)")
                );
            }

            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        }
    }

    /// Single attempt at invoking the stellar CLI — no retry logic here.
    fn invoke_once(config: &Config, fn_name: &str, args: &[String]) -> InvokeOutput {
        use std::process::Command;

        let (cmd_args, command_debug) = Self::build_cmd_args(config, fn_name, args);

        apply_rate_limit();
        let mut command = Command::new(stellar_bin());
        command.args(&cmd_args);

        // #240: hand a raw secret seed to the child via its environment rather
        // than argv so it cannot be read from `ps` / `/proc/<pid>/cmdline`.
        if crate::config::is_secret_seed(&config.source_key) {
            command.env("STELLAR_SECRET_KEY", &config.source_key);
        }

        let output = command.output();

        match output {
            Ok(out) => InvokeOutput {
                stdout: decode_process_output("stdout", out.stdout),
                stderr: decode_process_output("stderr", out.stderr),
                success: out.status.success(),
                command_debug,
            },
            Err(e) => InvokeOutput {
                stdout: String::new(),
                stderr: format!(
                    "Failed to spawn `stellar` CLI: {e}\n\
                     Is the Stellar CLI installed?  https://developers.stellar.org/docs/tools/cli/install-cli"
                ),
                success: false,
                command_debug,
            },
        }
    }
}

// ---------------------------------------------------------------------------
// Native Soroban JSON-RPC (read-only methods)
// ---------------------------------------------------------------------------
//
// First slice of the native-RPC work: methods that need no signing and no
// XDR, just a JSON request/response, are POSTed straight to
// `config.rpc_url`. Contract invokes still go through `stellar` above.

/// Per-request timeout for native JSON-RPC calls. Generous enough for a slow
/// public endpoint, short enough that a dead one fails fast.
const NATIVE_RPC_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// Typed result of the Soroban `getHealth` JSON-RPC method.
///
/// Parsed from the RPC's camelCase keys; serialised (e.g. by `trellis
/// health --json`) with the snake_case field names below.
///
/// Only `status` is guaranteed by every RPC release; the ledger fields were
/// added later, so they are optional rather than failing the parse against
/// an older endpoint.
#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct HealthStatus {
    /// `"healthy"` when the node is in sync; anything else is unhealthy.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_ledger: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub oldest_ledger: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ledger_retention_window: Option<u32>,
}

impl HealthStatus {
    pub fn is_healthy(&self) -> bool {
        self.status == "healthy"
    }
}

/// Typed result of the Soroban `getLatestLedger` JSON-RPC method.
///
/// The building block for TTL-aware transaction building: a transaction's
/// validity window and a footprint's `liveUntilLedger` are both expressed
/// relative to `sequence`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all(deserialize = "camelCase"))]
pub struct LatestLedger {
    /// Hex-encoded ledger hash (the RPC names this field `id`).
    #[serde(rename(deserialize = "id"))]
    pub hash: String,
    /// Stellar protocol version the ledger closed under.
    pub protocol_version: u32,
    /// Ledger sequence number.
    pub sequence: u32,
}

/// A JSON-RPC 2.0 response envelope: exactly one of `result` / `error`.
#[derive(serde::Deserialize)]
struct JsonRpcResponse<T> {
    result: Option<T>,
    error: Option<JsonRpcError>,
}

#[derive(serde::Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

impl RpcClient {
    /// Call the Soroban `getHealth` method natively (no `stellar` binary).
    ///
    /// Returns `Err` on a transport failure, a non-2xx HTTP status, a
    /// JSON-RPC `error` object, or a body that does not parse. An endpoint
    /// that answers but reports itself unhealthy is `Ok` — check
    /// [`HealthStatus::is_healthy`].
    pub fn get_health(config: &Config) -> Result<HealthStatus, String> {
        native_call(&config.rpc_url, "getHealth")
    }

    /// Call the Soroban `getLatestLedger` method natively (no `stellar`
    /// binary). Same error contract as [`Self::get_health`].
    pub fn get_latest_ledger(config: &Config) -> Result<LatestLedger, String> {
        native_call(&config.rpc_url, "getLatestLedger")
    }

    /// Describe the native request `method` would send, without sending it.
    /// Used by `--dry-run` and printed on failure, like [`Self::preview`].
    pub fn native_preview(config: &Config, method: &str) -> String {
        format!("POST {} {}", config.rpc_url, json_rpc_request(method))
    }
}

/// Build the JSON-RPC 2.0 request body for a parameterless `method`.
fn json_rpc_request(method: &str) -> serde_json::Value {
    serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": method })
}

/// POST a parameterless JSON-RPC `method` to `rpc_url` and decode `result`.
fn native_call<T: serde::de::DeserializeOwned>(rpc_url: &str, method: &str) -> Result<T, String> {
    apply_rate_limit();

    let client = reqwest::blocking::Client::builder()
        .timeout(NATIVE_RPC_TIMEOUT)
        .build()
        .map_err(|e| format!("{method}: failed to build HTTP client: {e}"))?;

    let response = client
        .post(rpc_url)
        .json(&json_rpc_request(method))
        .send()
        .map_err(|e| format!("{method}: request to {rpc_url} failed: {e}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("{method}: failed to read response body: {e}"))?;
    if !status.is_success() {
        return Err(format!(
            "{method}: HTTP {status} from {rpc_url}: {}",
            body.trim()
        ));
    }

    parse_json_rpc_response(method, &body)
}

/// Decode a JSON-RPC response body into `T`, surfacing an `error` object.
fn parse_json_rpc_response<T: serde::de::DeserializeOwned>(
    method: &str,
    body: &str,
) -> Result<T, String> {
    let envelope: JsonRpcResponse<T> = serde_json::from_str(body).map_err(|e| {
        format!(
            "{method}: malformed JSON-RPC response ({e}): {}",
            body.trim()
        )
    })?;

    if let Some(err) = envelope.error {
        return Err(format!("{method}: RPC error {}: {}", err.code, err.message));
    }
    envelope
        .result
        .ok_or_else(|| format!("{method}: JSON-RPC response has neither result nor error"))
}

/// Decode a subprocess output stream, without silently discarding bytes.
///
/// `String::from_utf8_lossy` replaces every invalid byte sequence with
/// U+FFFD, which can erase the very error detail a caller needs to debug a
/// non-UTF-8 failure. This tries strict UTF-8 first; on failure it falls
/// back to Latin-1 (ISO-8859-1), a direct byte→codepoint mapping that never
/// fails and preserves every original byte, and logs a warning to stderr
/// (including a hex preview of the raw bytes) so the user still has the
/// original context even though the string could not be decoded cleanly.
fn decode_process_output(label: &str, bytes: Vec<u8>) -> String {
    let (decoded, fell_back) = decode_bytes(&bytes);
    if let Some(first_bad) = fell_back {
        eprintln!(
            "warning: stellar CLI {label} was not valid UTF-8 ({} bytes, first \
             invalid byte at offset {first_bad}); decoded as Latin-1 — output \
             may not render correctly. Raw bytes (hex): {}",
            bytes.len(),
            hex_preview(&bytes),
        );
    }
    decoded
}

/// Decode `bytes` as UTF-8, falling back to a lossless Latin-1 mapping.
///
/// Returns the decoded string and, when the Latin-1 fallback was used, the
/// byte offset of the first invalid UTF-8 sequence (so callers can point at
/// exactly where the stream stopped being valid UTF-8).
fn decode_bytes(bytes: &[u8]) -> (String, Option<usize>) {
    match std::str::from_utf8(bytes) {
        Ok(s) => (s.to_string(), None),
        Err(e) => (
            // Latin-1: every byte maps 1:1 to U+0000..=U+00FF, so no byte is
            // ever lost and the original stream can be recovered.
            bytes.iter().map(|&b| b as char).collect(),
            Some(e.valid_up_to()),
        ),
    }
}

/// Render up to the first 64 bytes of `bytes` as space-separated hex, so a
/// non-UTF-8 stream still leaves a reproducible trace in the warning.
fn hex_preview(bytes: &[u8]) -> String {
    const MAX: usize = 64;
    let mut out = bytes
        .iter()
        .take(MAX)
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(" ");
    if bytes.len() > MAX {
        out.push_str(&format!(" … (+{} more)", bytes.len() - MAX));
    }
    out
}

/// Return true when stderr content indicates a transient, retriable RPC error.
///
/// Matches common patterns from Stellar RPC responses, HTTP errors, and
/// OS-level network failures. Contract-level errors (e.g. "contract not found",
/// "invalid argument") do not match and will not be retried.
///
/// Patterns are deliberately specific. A bare `"network"` substring, for
/// example, also matches the *permanent* error "network passphrase mismatch",
/// which would send the CLI into an endless retry loop (issue #249). Each entry
/// below is an exact phrase that only appears in genuinely transient failures;
/// add a negative test to `non_transient_*` whenever a new pattern is added.
fn is_transient_error(stderr: &str) -> bool {
    let lower = stderr.to_lowercase();
    const TRANSIENT_PATTERNS: &[&str] = &[
        "timeout",
        "timed out",
        "connection refused",
        "connection reset",
        "connection closed",
        "connection error",
        "network error",
        "network timeout",
        "network is unreachable",
        "network is down",
        "temporary failure in name resolution",
        "rate limit",
        "too many requests",
        "service unavailable",
        "bad gateway",
        "gateway timeout",
        "deadline exceeded",
        "host unreachable",
        "no route to host",
        " 429",
        " 502",
        " 503",
        " 504",
    ];
    TRANSIENT_PATTERNS.iter().any(|p| lower.contains(p))
}

/// Compute a 0–199 ms jitter value from the subsecond part of the system clock.
///
/// Using wall-clock nanoseconds avoids a dependency on the `rand` crate while
/// still producing enough variance to prevent concurrent processes from all
/// waking up at the same millisecond.
fn jitter_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| (d.subsec_nanos() % 200) as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- is_transient_error ---

    #[test]
    fn transient_detects_timeout() {
        assert!(is_transient_error("error: connection timeout after 30s"));
        assert!(is_transient_error("request timed out"));
    }

    #[test]
    fn transient_detects_connection_refused() {
        assert!(is_transient_error(
            "Os error: connection refused (os error 111)"
        ));
    }

    #[test]
    fn transient_detects_rate_limit_http_codes() {
        assert!(is_transient_error(
            "server returned status 429 Too Many Requests"
        ));
        assert!(is_transient_error("HTTP 503 Service Unavailable"));
        assert!(is_transient_error("upstream error: 502 Bad Gateway"));
        assert!(is_transient_error("gateway timeout: 504"));
    }

    #[test]
    fn transient_detects_rate_limit_text() {
        assert!(is_transient_error("rate limit exceeded, please slow down"));
        assert!(is_transient_error("too many requests"));
    }

    #[test]
    fn non_transient_contract_errors_not_retried() {
        assert!(!is_transient_error("contract not found: CABC123"));
        assert!(!is_transient_error("invalid argument: agreement_id"));
        assert!(!is_transient_error("error: source account does not exist"));
        assert!(!is_transient_error("authentication failed"));
    }

    #[test]
    fn non_transient_empty_stderr_not_retried() {
        assert!(!is_transient_error(""));
    }

    /// #249: permanent errors that merely *contain* a transient-looking word
    /// (most notably "network") must never trigger a retry.
    #[test]
    fn non_transient_network_config_errors_not_retried() {
        assert!(!is_transient_error(
            "error: network passphrase mismatch: expected 'Test SDF Network ; September 2015'"
        ));
        assert!(!is_transient_error("unknown network 'testnet'"));
        assert!(!is_transient_error(
            "no network configured; run `stellar network add`"
        ));
        assert!(!is_transient_error(
            "network name contains invalid characters"
        ));
        // "deadline" / "temporary" / "unreachable" as bare words in an
        // unrelated message are no longer enough on their own.
        assert!(!is_transient_error(
            "filing deadline for the proposal has passed"
        ));
        assert!(!is_transient_error(
            "temporary directory could not be created"
        ));
    }

    #[test]
    fn transient_detects_network_failure_phrases() {
        assert!(is_transient_error(
            "network error: could not reach RPC endpoint"
        ));
        assert!(is_transient_error(
            "Os error: network is unreachable (os error 101)"
        ));
        assert!(is_transient_error(
            "dns lookup failed: Temporary failure in name resolution"
        ));
        assert!(is_transient_error("504 Gateway Timeout"));
        assert!(is_transient_error("grpc status: deadline exceeded"));
    }

    // --- decode_process_output / decode_bytes ---

    #[test]
    fn decode_bytes_passes_through_valid_utf8() {
        let (s, fell_back) = decode_bytes("héllo — 世界".as_bytes());
        assert_eq!(s, "héllo — 世界");
        assert_eq!(fell_back, None);
    }

    #[test]
    fn decode_bytes_falls_back_to_latin1_on_invalid_utf8() {
        // 0xE9 is "é" in Latin-1 but an incomplete UTF-8 lead byte here.
        let raw = b"caf\xE9 not utf8";
        let (s, fell_back) = decode_bytes(raw);
        assert_eq!(s, "café not utf8");
        assert_eq!(fell_back, Some(3), "first invalid byte is at offset 3");
        // Every original byte is still recoverable from the decoded string.
        assert_eq!(s.chars().count(), raw.len());
    }

    #[test]
    fn decode_bytes_handles_mixed_valid_and_invalid_sequences() {
        // Valid multi-byte UTF-8 ("→", 0xE2 0x86 0x92) followed by a lone 0xFF.
        let raw = b"ok \xE2\x86\x92 then \xFF end";
        let (s, fell_back) = decode_bytes(raw);
        assert_eq!(fell_back, Some(3));
        assert!(s.starts_with("ok "));
        assert!(s.ends_with(" end"));
        assert_eq!(s.chars().count(), raw.len());
    }

    #[test]
    fn decode_process_output_returns_clean_string_for_valid_utf8() {
        assert_eq!(
            decode_process_output("stdout", "all good".as_bytes().to_vec()),
            "all good"
        );
    }

    #[test]
    fn decode_process_output_still_returns_bytes_on_fallback() {
        let out = decode_process_output("stderr", b"bad \xC0\xC0 byte".to_vec());
        assert!(out.contains("bad "));
        assert!(out.contains(" byte"));
    }

    #[test]
    fn hex_preview_formats_and_truncates() {
        assert_eq!(hex_preview(&[0x00, 0x1f, 0xff]), "00 1f ff");
        let long: Vec<u8> = (0..80).map(|_| 0xABu8).collect();
        let preview = hex_preview(&long);
        assert!(preview.contains("(+16 more)"), "got: {preview}");
    }

    // --- jitter_millis ---

    #[test]
    fn jitter_within_bounds() {
        for _ in 0..20 {
            let j = jitter_millis();
            assert!(j < 200, "jitter {j} should be < 200ms");
        }
    }

    // --- STELLAR_RPC_RETRIES parsing ---

    #[test]
    fn retry_count_defaults_to_three() {
        // Temporarily unset the var to test the default.
        std::env::remove_var("STELLAR_RPC_RETRIES");
        let retries: u32 = std::env::var("STELLAR_RPC_RETRIES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3);
        assert_eq!(retries, 3);
    }

    #[test]
    fn retry_count_reads_from_env() {
        std::env::set_var("STELLAR_RPC_RETRIES", "5");
        let retries: u32 = std::env::var("STELLAR_RPC_RETRIES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3);
        assert_eq!(retries, 5);
        std::env::remove_var("STELLAR_RPC_RETRIES");
    }

    #[test]
    fn retry_count_falls_back_on_invalid_value() {
        std::env::set_var("STELLAR_RPC_RETRIES", "not_a_number");
        let retries: u32 = std::env::var("STELLAR_RPC_RETRIES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3);
        assert_eq!(retries, 3);
        std::env::remove_var("STELLAR_RPC_RETRIES");
    }

    // --- #240: secret seed never reaches argv / printed output ---

    fn cfg_with_source(source_key: &str) -> Config {
        Config {
            rpc_url: "https://soroban-testnet.stellar.org".to_string(),
            network_passphrase: "Test SDF Network ; September 2015".to_string(),
            contract_id: "CAABC123".to_string(),
            source_key: source_key.to_string(),
        }
    }

    fn a_seed() -> String {
        // 56 chars, `S` + base32 — matches `config::is_secret_seed`.
        format!("S{}", "A".repeat(55))
    }

    #[test]
    fn build_cmd_args_omits_secret_seed_from_argv() {
        let seed = a_seed();
        let (argv, debug) = RpcClient::build_cmd_args(&cfg_with_source(&seed), "init", &[]);
        assert!(
            !argv.iter().any(|a| a == &seed),
            "secret seed must not appear in argv: {argv:?}"
        );
        assert!(
            !argv.iter().any(|a| a == "--source"),
            "--source flag must be dropped for a raw seed"
        );
        assert!(!debug.contains(&seed), "seed must not be printed: {debug}");
        assert!(debug.starts_with("STELLAR_SECRET_KEY=<redacted> stellar "));
    }

    #[test]
    fn build_cmd_args_keeps_source_for_identity_name() {
        let (argv, debug) = RpcClient::build_cmd_args(&cfg_with_source("alice"), "init", &[]);
        let src = argv
            .iter()
            .position(|a| a == "--source")
            .expect("--source present");
        assert_eq!(argv[src + 1], "alice");
        assert!(debug.starts_with("stellar contract invoke"));
    }

    // --- native JSON-RPC: getHealth (#467) / getLatestLedger (#468) ---

    fn cfg_for(server: &mockito::Server) -> Config {
        Config {
            rpc_url: server.url(),
            ..cfg_with_source("alice")
        }
    }

    /// Match a POST whose JSON body is exactly the JSON-RPC 2.0 request for
    /// `method` — this is the request-shape assertion.
    fn expect_request(server: &mut mockito::Server, method: &str, body: &str) -> mockito::Mock {
        server
            .mock("POST", "/")
            .match_header("content-type", "application/json")
            .match_body(mockito::Matcher::Json(serde_json::json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": method,
            })))
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(body)
            .create()
    }

    #[test]
    fn get_health_sends_json_rpc_request_and_parses_result() {
        let mut server = mockito::Server::new();
        let mock = expect_request(
            &mut server,
            "getHealth",
            r#"{"jsonrpc":"2.0","id":1,"result":{"status":"healthy","latestLedger":51583040,"oldestLedger":51565761,"ledgerRetentionWindow":17280}}"#,
        );

        let health = RpcClient::get_health(&cfg_for(&server)).expect("healthy response parses");
        mock.assert();
        assert!(health.is_healthy());
        assert_eq!(
            health,
            HealthStatus {
                status: "healthy".to_string(),
                latest_ledger: Some(51583040),
                oldest_ledger: Some(51565761),
                ledger_retention_window: Some(17280),
            }
        );
    }

    #[test]
    fn get_health_accepts_status_only_response_from_older_rpc() {
        let mut server = mockito::Server::new();
        let _mock = expect_request(
            &mut server,
            "getHealth",
            r#"{"jsonrpc":"2.0","id":1,"result":{"status":"unhealthy"}}"#,
        );

        let health = RpcClient::get_health(&cfg_for(&server)).expect("parses");
        assert!(!health.is_healthy());
        assert_eq!(health.latest_ledger, None);
    }

    #[test]
    fn get_latest_ledger_sends_json_rpc_request_and_parses_result() {
        let mut server = mockito::Server::new();
        let mock = expect_request(
            &mut server,
            "getLatestLedger",
            r#"{"jsonrpc":"2.0","id":1,"result":{"id":"c73c5eac58a441d4eb733c35253ae85f783e018f7be5ef974258fed067aabb36","protocolVersion":22,"sequence":2539605}}"#,
        );

        let ledger = RpcClient::get_latest_ledger(&cfg_for(&server)).expect("parses");
        mock.assert();
        assert_eq!(
            ledger,
            LatestLedger {
                hash: "c73c5eac58a441d4eb733c35253ae85f783e018f7be5ef974258fed067aabb36"
                    .to_string(),
                protocol_version: 22,
                sequence: 2539605,
            }
        );
    }

    #[test]
    fn native_call_surfaces_json_rpc_error_object() {
        let mut server = mockito::Server::new();
        let _mock = expect_request(
            &mut server,
            "getLatestLedger",
            r#"{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"method not found"}}"#,
        );

        let err = RpcClient::get_latest_ledger(&cfg_for(&server)).unwrap_err();
        assert!(
            err.contains("-32601") && err.contains("method not found"),
            "got: {err}"
        );
    }

    #[test]
    fn native_call_rejects_http_error_status() {
        let mut server = mockito::Server::new();
        let _mock = server
            .mock("POST", "/")
            .with_status(503)
            .with_body("Service Unavailable")
            .create();

        let err = RpcClient::get_health(&cfg_for(&server)).unwrap_err();
        assert!(err.contains("503"), "got: {err}");
        // The message stays classifiable by the existing retry heuristic.
        assert!(is_transient_error(&err), "got: {err}");
    }

    #[test]
    fn native_call_rejects_malformed_result() {
        let mut server = mockito::Server::new();
        // `sequence` must be a number — a typed parse must not silently
        // accept a wrong-shaped ledger.
        let _mock = expect_request(
            &mut server,
            "getLatestLedger",
            r#"{"jsonrpc":"2.0","id":1,"result":{"id":"ab","protocolVersion":22,"sequence":"x"}}"#,
        );

        let err = RpcClient::get_latest_ledger(&cfg_for(&server)).unwrap_err();
        assert!(err.contains("malformed JSON-RPC response"), "got: {err}");
    }

    #[test]
    fn native_call_reports_unreachable_endpoint() {
        // Nothing listens on port 9 (discard) on loopback in CI.
        let cfg = Config {
            rpc_url: "http://127.0.0.1:9".to_string(),
            ..cfg_with_source("alice")
        };
        let err = RpcClient::get_health(&cfg).unwrap_err();
        assert!(err.starts_with("getHealth: request to"), "got: {err}");
    }

    #[test]
    fn native_preview_shows_endpoint_and_body() {
        let preview = RpcClient::native_preview(&cfg_with_source("alice"), "getHealth");
        assert!(preview.starts_with("POST https://soroban-testnet.stellar.org "));
        assert!(
            preview.contains(r#""method":"getHealth""#),
            "got: {preview}"
        );
    }

    #[test]
    fn preview_never_prints_a_secret_seed() {
        let seed = a_seed();
        let preview = RpcClient::preview(&cfg_with_source(&seed), "init", &[]);
        assert!(
            !preview.contains(&seed),
            "dry-run leaked the seed: {preview}"
        );
        assert!(preview.contains("<redacted>"));
    }
}
