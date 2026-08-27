use clap::Subcommand;
use clap_complete::Shell;

use crate::config::Config;
use crate::rpc::{InvokeOutput, RpcClient};

// ---------------------------------------------------------------------------
// Output rendering options (#74, #76, #77)
// ---------------------------------------------------------------------------

/// Output rendering mode selected via the global `--json` / `--human-readable`
/// flags. `--json` takes priority when both are passed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OutputFormat {
    /// Raw stdout from the underlying `stellar contract invoke` call (default).
    Raw,
    /// Uniform, machine-parseable JSON envelope: `{status, result, tx_hash, events, error}`.
    Json,
    /// Parsed, colorized human-friendly summary; falls back to raw text if parsing fails.
    Human,
}

/// Global output/execution options threaded through every command handler.
#[derive(Clone, Copy, Debug)]
pub struct OutputOpts {
    pub format: OutputFormat,
    /// Suppress retry/progress messages so only the final JSON result is printed.
    /// Forces `format` to `Json` regardless of `--human-readable`.
    pub quiet: bool,
    /// Print the `stellar contract invoke` command instead of executing it.
    pub dry_run: bool,
}

// ---------------------------------------------------------------------------
// Commands enum — parsed by clap from argv
// ---------------------------------------------------------------------------

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Create a new escrow agreement on-chain.
    Init {
        /// Hex-encoded 32-byte agreement ID (64 hex chars).
        #[arg(long)]
        agreement_id: String,

        /// Stellar address of the payer (funder).
        #[arg(long)]
        payer: String,

        /// Stellar address of the payee (contractor).
        #[arg(long)]
        payee: String,

        /// SAC or token contract address used for payments.
        #[arg(long)]
        token: String,

        /// Address of the neutral dispute resolver.
        #[arg(long)]
        resolver: String,

        /// Comma-separated milestone amounts in the token's base unit.
        /// Example: --milestones "1000,2000,500"
        #[arg(long)]
        milestones: String,

        /// Skip the confirmation prompt (for scripting).
        #[arg(short = 'y', long = "yes")]
        yes: bool,
    },

    /// Lock funds for a specific milestone into the escrow contract.
    LockFunds {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,

        /// Zero-based index of the milestone to fund.
        #[arg(long)]
        milestone_id: u32,

        /// Skip the confirmation prompt (for scripting).
        #[arg(short = 'y', long = "yes")]
        yes: bool,
    },

    /// Submit proof of work for a funded milestone.
    SubmitWork {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,

        /// Zero-based index of the milestone being submitted.
        #[arg(long)]
        milestone_id: u32,

        /// URI pointing to delivery proof (e.g. "ipfs://...", GitHub PR URL).
        /// Omit the flag to submit without a proof link.
        #[arg(long)]
        proof_uri: Option<String>,

        /// Skip the confirmation prompt (for scripting).
        #[arg(short = 'y', long = "yes")]
        yes: bool,
    },

    /// Approve submitted work and release funds to the payee.
    ApproveRelease {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,

        /// Zero-based index of the milestone to approve.
        #[arg(long)]
        milestone_id: u32,

        /// Skip the confirmation prompt (for scripting).
        #[arg(short = 'y', long = "yes")]
        yes: bool,
    },

    /// Raise a dispute on a funded or work-submitted milestone.
    RaiseDispute {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,

        /// Zero-based index of the disputed milestone.
        #[arg(long)]
        milestone_id: u32,

        /// Address of the party raising the dispute (payer or payee).
        /// The contract validates the caller is one of these two roles.
        #[arg(long)]
        caller: String,

        /// Skip the confirmation prompt (for scripting).
        #[arg(short = 'y', long = "yes")]
        yes: bool,
    },

    /// Resolve a disputed milestone as the designated dispute resolver.
    ResolveDispute {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,

        /// Zero-based index of the disputed milestone.
        #[arg(long)]
        milestone_id: u32,

        /// Pass true to refund locked funds to the payer (payer wins).
        /// Pass false to release funds to the payee (payee wins).
        #[arg(long, default_value = "false")]
        refund_to_payer: bool,

        /// Skip the confirmation prompt (for scripting).
        #[arg(short = 'y', long = "yes")]
        yes: bool,
    },

    /// Cancel a milestone that was never funded (status = Pending).
    CancelMilestone {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,

        /// Zero-based index of the milestone to cancel.
        #[arg(long)]
        milestone_id: u32,

        /// Skip the confirmation prompt (for scripting).
        #[arg(short = 'y', long = "yes")]
        yes: bool,
    },

    /// Query the current state of an agreement.
    Status {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,
    },

    /// Query the current status of a single milestone (cheaper than fetching the full agreement).
    MilestoneStatus {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,

        /// Zero-based index of the milestone to query.
        #[arg(long)]
        milestone_id: u32,
    },

    /// Generate a shell completion script for bash, zsh, fish, elvish, or PowerShell.
    ///
    /// Example installation (bash):
    ///   trellis completion bash > /etc/bash_completion.d/trellis
    Completion {
        /// Target shell to generate a completion script for.
        #[arg(value_enum)]
        shell: Shell,
    },

    /// Manage Stellar secret keys securely using OS keychain or encrypted keystore.
    #[command(subcommand)]
    Keys(KeysSubcommand),
}

#[derive(Subcommand, Debug)]
pub enum KeysSubcommand {
    /// Store a Stellar secret key in the OS keychain for a named identity.
    Add {
        /// Identity name (e.g., "alice", "bob").
        identity: String,

        /// Stellar secret key (S...).
        key: String,
    },

    /// Remove a Stellar secret key from the OS keychain.
    Remove {
        /// Identity name to remove.
        identity: String,
    },

    /// List all Stellar secret keys stored in the keychain.
    List,
}

// ---------------------------------------------------------------------------
// Dispatch — route each command to its handler
// ---------------------------------------------------------------------------

pub fn dispatch(cmd: Commands, config: &Config, opts: &OutputOpts) -> Result<(), String> {
    match cmd {
        Commands::Init {
            agreement_id,
            payer,
            payee,
            token,
            resolver,
            milestones,
            yes,
        } => run_init(
            config,
            agreement_id,
            payer,
            payee,
            token,
            resolver,
            milestones,
            opts,
        ),

        Commands::LockFunds {
            agreement_id,
            milestone_id,
        } => run_lock_funds(config, agreement_id, milestone_id, opts),

        Commands::SubmitWork {
            agreement_id,
            milestone_id,
            proof_uri,
        } => run_submit_work(config, agreement_id, milestone_id, proof_uri, opts),

        Commands::ApproveRelease {
            agreement_id,
            milestone_id,
        } => run_approve_release(config, agreement_id, milestone_id, opts),

        Commands::RaiseDispute {
            agreement_id,
            milestone_id,
            caller,
        } => run_raise_dispute(config, agreement_id, milestone_id, caller, opts),

        Commands::ResolveDispute {
            agreement_id,
            milestone_id,
            refund_to_payer,
        } => run_resolve_dispute(config, agreement_id, milestone_id, refund_to_payer, opts),

        Commands::CancelMilestone {
            agreement_id,
            milestone_id,
        } => run_cancel_milestone(config, agreement_id, milestone_id, opts),

        Commands::Status { agreement_id } => run_status(config, agreement_id, opts),

        Commands::MilestoneStatus {
            agreement_id,
            milestone_id,
        } => run_milestone_status(config, agreement_id, milestone_id, opts),

        // Handled in main() before dispatch is ever reached — completions
        // need the clap `Command` object, not a `Config`.
        Commands::Completion { .. } => Ok(()),

        Commands::Keys(subcmd) => run_keys(subcmd),
    }
}

fn run_keys(subcmd: KeysSubcommand) -> Result<(), String> {
    use crate::keystore::Keystore;

    let keystore = Keystore::new();

    match subcmd {
        KeysSubcommand::Add { identity, key } => {
            keystore
                .store_in_keychain(&identity, &key)
                .map_err(|e| format!("Failed to store key: {}", e))?;
            println!("✓ Key stored for identity '{}'", identity);
            Ok(())
        }
        KeysSubcommand::Remove { identity } => {
            keystore
                .remove_from_keychain(&identity)
                .map_err(|e| format!("Failed to remove key: {}", e))?;
            println!("✓ Key removed for identity '{}'", identity);
            Ok(())
        }
        KeysSubcommand::List => {
            let identities = keystore.list_keychain_identities();
            if identities.is_empty() {
                println!("No keys stored. Use 'trellis keys add <identity> <key>' to store one.");
            } else {
                println!("Stored identities:");
                for identity in identities {
                    println!("  - {}", identity);
                }
            }
            Ok(())
        }
    }
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/// Validate an agreement ID: must be exactly 64 lowercase or uppercase hex chars.
///
/// Rejects any value that could be used to inject additional CLI flags or
/// smuggle shell metacharacters through the argument list.
fn validate_agreement_id(id: &str) -> Result<(), String> {
    if crate::utils::is_valid_hex(id, 64) {
        return Ok(());
    }
    if id.len() != 64 {
        return Err(format!(
            "agreement_id must be exactly 64 hex characters, got {}",
            id.len()
        ));
    }
    Err("agreement_id must contain only hexadecimal characters (0-9, a-f, A-F)".to_string())
}

/// Validate a proof URI: printable, non-empty, within a reasonable length cap.
///
/// Control characters (including newlines) are rejected so they cannot be
/// used to confuse argument parsing downstream.
fn validate_proof_uri(uri: &str) -> Result<(), String> {
    if uri.is_empty() {
        return Err("proof_uri must not be empty".to_string());
    }
    if uri.len() > 2048 {
        return Err(format!(
            "proof_uri must not exceed 2048 characters, got {}",
            uri.len()
        ));
    }
    if uri.chars().any(|c| c.is_control()) {
        return Err("proof_uri must not contain control characters".to_string());
    }
    Ok(())
}

/// Print a validation error and exit with code 1.
fn fail_validation(msg: &str) -> ! {
    eprintln!("error: {msg}");
    std::process::exit(1);
}

// ---------------------------------------------------------------------------
// Active command implementations
// ---------------------------------------------------------------------------

/// `stellar contract invoke … -- init …`
///
/// Final call signature:
/// ```
/// stellar contract invoke --id <C> --source <key> --rpc-url <url>
///   --network-passphrase <p> -- init
///   --agreement-id <hex> --payer <G> --payee <G>
///   --token <C> --milestones <JSON> --dispute-resolver <G>
/// ```
fn run_init(
    config: &Config,
    agreement_id: String,
    payer: String,
    payee: String,
    token: String,
    resolver: String,
    milestones_csv: String,
    opts: &OutputOpts,
) -> Result<(), String> {
    let milestones_json = build_milestones_json(&milestones_csv).unwrap_or_else(|e| {
        eprintln!("Error: {e}");
        std::process::exit(1);
    });

    confirm_action(
        &format!(
            "This will create agreement {agreement_id} (payer={payer}, payee={payee}, \
             token={token}, resolver={resolver}, milestones={milestones_csv})."
        ),
        yes,
    )?;

    let args = vec![
        "--agreement-id".to_string(),
        agreement_id,
        "--payer".to_string(),
        payer,
        "--payee".to_string(),
        payee,
        "--token".to_string(),
        token,
        "--milestones".to_string(),
        milestones_json,
        "--dispute-resolver".to_string(),
        resolver,
    ];

    execute(config, "init", &args, opts)
}

/// `stellar contract invoke … -- lock_funds …`
///
/// Final call signature:
/// ```
/// stellar contract invoke … -- lock_funds
///   --agreement-id <hex> --milestone-id <u32>
/// ```
fn run_lock_funds(
    config: &Config,
    agreement_id: String,
    milestone_id: u32,
    opts: &OutputOpts,
) -> Result<(), String> {
    let args = vec![
        "--agreement-id".to_string(),
        agreement_id,
        "--milestone-id".to_string(),
        milestone_id.to_string(),
    ];

    execute(config, "lock_funds", &args, opts)
}

/// `stellar contract invoke … -- submit_work …`
///
/// Final call signature:
/// ```
/// stellar contract invoke … -- submit_work
///   --agreement-id <hex> --milestone-id <u32> [--proof-uri <string>]
/// ```
///
/// The contract types `proof_uri` as `Option<String>`, so omitting the flag
/// sends `None` — the canonical "no proof submitted" value. Passing an empty
/// string would create a `Some("")`, which the contract does not treat as
/// absent, so the flag is dropped entirely rather than sent empty.
fn run_submit_work(
    config: &Config,
    agreement_id: String,
    milestone_id: u32,
    proof_uri: Option<String>,
    opts: &OutputOpts,
) -> Result<(), String> {
    confirm_action(
        &format!("This will submit work for milestone {milestone_id} of agreement {agreement_id}."),
        yes,
    )?;

    let mut args = vec![
        "--agreement-id".to_string(),
        agreement_id,
        "--milestone-id".to_string(),
        milestone_id.to_string(),
    ];

    if let Some(uri) = proof_uri.filter(|u| !u.is_empty()) {
        if let Err(e) = validate_proof_uri(&uri) {
            fail_validation(&e);
        }
        args.push("--proof-uri".to_string());
        args.push(uri);
    }

    execute(config, "submit_work", &args, opts)
}

/// `stellar contract invoke … -- approve_and_release …`
///
/// Final call signature:
/// ```
/// stellar contract invoke … -- approve_and_release
///   --agreement-id <hex> --milestone-id <u32>
/// ```
fn run_approve_release(
    config: &Config,
    agreement_id: String,
    milestone_id: u32,
    opts: &OutputOpts,
) -> Result<(), String> {
    let args = vec![
        "--agreement-id".to_string(),
        agreement_id,
        "--milestone-id".to_string(),
        milestone_id.to_string(),
    ];

    execute(config, "approve_and_release", &args, opts)
}

/// `stellar contract invoke … -- raise_dispute …`
///
/// Final call signature:
/// ```
/// stellar contract invoke … -- raise_dispute
///   --agreement-id <hex> --milestone-id <u32> --caller <G>
/// ```
///
/// `caller` is passed explicitly because the contract checks it against
/// both `agreement.payer` and `agreement.payee` before calling
/// `caller.require_auth()`, so either party can autonomously open a dispute.
fn run_raise_dispute(
    config: &Config,
    agreement_id: String,
    milestone_id: u32,
    caller: String,
    opts: &OutputOpts,
) -> Result<(), String> {
    let args = vec![
        "--agreement-id".to_string(),
        agreement_id,
        "--milestone-id".to_string(),
        milestone_id.to_string(),
        "--caller".to_string(),
        caller,
    ];

    execute(config, "raise_dispute", &args, opts)
}

/// `stellar contract invoke … -- resolve_dispute …`
///
/// Final call signature:
/// ```
/// stellar contract invoke … -- resolve_dispute
///   --agreement-id <hex> --milestone-id <u32> --refund-to-payer <true|false>
/// ```
fn run_resolve_dispute(
    config: &Config,
    agreement_id: String,
    milestone_id: u32,
    refund_to_payer: bool,
    opts: &OutputOpts,
) -> Result<(), String> {
    let outcome = if refund_to_payer {
        "refund locked funds to the payer"
    } else {
        "release funds to the payee"
    };
    confirm_action(
        &format!(
            "This will resolve the dispute on milestone {milestone_id} of agreement {agreement_id} and {outcome}."
        ),
        yes,
    )?;

    let args = vec![
        "--agreement-id".to_string(),
        agreement_id,
        "--milestone-id".to_string(),
        milestone_id.to_string(),
        "--refund-to-payer".to_string(),
        refund_to_payer.to_string(), // "true" or "false"
    ];

    execute(config, "resolve_dispute", &args, opts)
}

/// `stellar contract invoke … -- cancel_unfunded_milestone …`
///
/// Final call signature:
/// ```
/// stellar contract invoke … -- cancel_unfunded_milestone
///   --agreement-id <hex> --milestone-id <u32>
/// ```
fn run_cancel_milestone(
    config: &Config,
    agreement_id: String,
    milestone_id: u32,
    opts: &OutputOpts,
) -> Result<(), String> {
    let args = vec![
        "--agreement-id".to_string(),
        agreement_id,
        "--milestone-id".to_string(),
        milestone_id.to_string(),
    ];

    execute(config, "cancel_unfunded_milestone", &args, opts)
}

/// `stellar contract invoke … -- get_agreement …`
///
/// Final call signature:
/// ```
/// stellar contract invoke … -- get_agreement
///   --agreement-id <hex>
/// ```
///
/// The stellar CLI calls the contract's `get_agreement` view function and
/// returns the full Agreement struct as JSON, which is printed to stdout.
fn run_status(config: &Config, agreement_id: String, opts: &OutputOpts) -> Result<(), String> {
    let args = vec!["--agreement-id".to_string(), agreement_id];

    execute(config, "get_agreement", &args, opts)
}

/// `stellar contract invoke … -- get_milestone …`
///
/// Final call signature:
/// ```
/// stellar contract invoke … -- get_milestone
///   --agreement-id <hex> --milestone-id <u32>
/// ```
///
/// Queries a single milestone by index without fetching the full Agreement,
/// reducing deserialization cost for agreements with many milestones.
fn run_milestone_status(
    config: &Config,
    agreement_id: String,
    milestone_id: u32,
    opts: &OutputOpts,
) -> Result<(), String> {
    let args = vec![
        "--agreement-id".to_string(),
        format!("\"{}\"", agreement_id),
        "--milestone-id".to_string(),
        milestone_id.to_string(),
    ];

    execute(config, "get_milestone", &args, opts)
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Convert a comma-separated amount string like `"1000,2000"` into the JSON
/// array format the `stellar` CLI accepts for a `Vec<Milestone>` argument.
///
/// Amounts are parsed as `i128` to match the contract's `Milestone.amount` type.
/// Values that are not valid integers, are zero, or are negative are rejected
/// with a descriptive error — the entire command fails rather than silently
/// producing a malformed milestone list.
///
/// Each milestone is given:
/// - `id`        – its 0-based position in the list
/// - `amount`    – the parsed `i128` amount (quoted, per Soroban i128 JSON encoding)
/// - `status`    – `{"Pending":null}` (XDR union tag for EscrowStatus::Pending)
/// - `proof_uri` – `null` (XDR `Void`, i.e. `None` — no proof submitted yet)
///
/// Example output for `"1000,2000"`:
/// ```json
/// [{"id":0,"amount":"1000","status":{"Pending":null},"proof_uri":null},
///  {"id":1,"amount":"2000","status":{"Pending":null},"proof_uri":null}]
/// ```
fn build_milestones_json(csv: &str) -> Result<String, String> {
    let entries: Vec<String> = csv
        .split(',')
        .enumerate()
        .map(|(idx, part)| -> Result<String, String> {
            let trimmed = part.trim();
            let amount: i128 = trimmed.parse().map_err(|_| {
                format!(
                    "invalid milestone amount {:?} at index {} — expected a positive integer",
                    trimmed, idx
                )
            })?;
            if amount <= 0 {
                return Err(format!(
                    "milestone amount at index {} must be a positive integer, got {amount}",
                    idx
                ));
            }
            Ok(format!(
                r#"{{"id":{idx},"amount":"{amount}","status":{{"Pending":null}},"proof_uri":null}}"#,
            ))
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(format!("[{}]", entries.join(",")))
}

/// Run an RPC invocation (or preview it, under `--dry-run`) and render the
/// result according to `opts.format`.
///
/// This is the single entry point every command handler funnels through, so
/// `--dry-run`, `--json`, `--human-readable`, and `--quiet` behave
/// consistently across all commands (#74, #76, #77).
fn execute(config: &Config, fn_name: &str, args: &[String], opts: &OutputOpts) -> Result<(), String> {
    if opts.dry_run {
        println!("{}", RpcClient::preview(config, fn_name, args));
        return Ok(());
    }

    let out = RpcClient::invoke(config, fn_name, args, opts.quiet);
    render_output(&out, opts)
}

/// Dispatch to the renderer selected by `opts.format`.
fn render_output(out: &InvokeOutput, opts: &OutputOpts) -> Result<(), String> {
    match opts.format {
        OutputFormat::Json => render_json(out),
        OutputFormat::Human => render_human(out),
        OutputFormat::Raw => render_raw(out),
    }
}

/// Default renderer: print the raw command output verbatim (original behavior).
///
/// On failure, prints the full verbatim command so the user can reproduce it.
/// Returns `Ok(())` on success or `Err(message)` on failure so that callers
/// (i.e. `main`) can run any cleanup before exiting with a non-zero exit code.
/// This avoids calling `std::process::exit` inside a library function, which
/// would skip destructors and flush buffers unsafely.
fn render_raw(out: &InvokeOutput) -> Result<(), String> {
    if out.success {
        println!("{}", out.stdout.trim());
        Ok(())
    } else {
        let mut msg = format!(
            "── Transaction failed ──────────────────────────────────\nCommand: {}",
            out.command_debug
        );
        if !out.stdout.is_empty() {
            msg.push_str(&format!("\nstdout:\n{}", out.stdout.trim()));
        }
        if !out.stderr.is_empty() {
            msg.push_str(&format!("\nstderr:\n{}", out.stderr.trim()));
        }
        Err(msg)
    }
}

/// `--json` renderer (#77): a single line of uniform, machine-parseable JSON.
///
/// Schema: `{"status": "success"|"error", "result", "tx_hash", "events", "error"}`.
/// `result` holds the parsed stdout payload (or the raw string if it isn't
/// valid JSON). `tx_hash`/`events` are extracted on a best-effort basis since
/// the underlying `stellar contract invoke` shell-out does not expose a
/// structured transaction envelope.
fn render_json(out: &InvokeOutput) -> Result<(), String> {
    let envelope = json_envelope(out);
    println!("{}", serde_json::to_string(&envelope).unwrap_or_default());

    if out.success {
        Ok(())
    } else {
        // Error detail is already in the JSON envelope above; returning an
        // empty message tells main() to exit(1) without printing it again.
        Err(String::new())
    }
}

fn json_envelope(out: &InvokeOutput) -> serde_json::Value {
    let trimmed_stdout = out.stdout.trim();

    if out.success {
        let result = serde_json::from_str::<serde_json::Value>(trimmed_stdout)
            .unwrap_or_else(|_| serde_json::Value::String(trimmed_stdout.to_string()));

        serde_json::json!({
            "status": "success",
            "result": result,
            "tx_hash": extract_tx_hash(&out.stdout, &out.stderr),
            "events": extract_events(&out.stderr),
            "error": null,
        })
    } else {
        let mut error = out.stderr.trim().to_string();
        if error.is_empty() {
            error = trimmed_stdout.to_string();
        }

        serde_json::json!({
            "status": "error",
            "result": null,
            "tx_hash": null,
            "events": null,
            "error": error,
        })
    }
}

/// `--human-readable` / `-H` renderer (#74): parse the stellar CLI JSON output
/// and print a colorized, formatted summary. Falls back to raw text if the
/// output isn't valid JSON.
fn render_human(out: &InvokeOutput) -> Result<(), String> {
    const GREEN: &str = "\x1b[32m";
    const RED: &str = "\x1b[31m";
    const BOLD: &str = "\x1b[1m";
    const RESET: &str = "\x1b[0m";

    let trimmed = out.stdout.trim();

    if out.success {
        println!("{GREEN}{BOLD}\u{2714} Success{RESET}");
        match serde_json::from_str::<serde_json::Value>(trimmed) {
            Ok(serde_json::Value::Object(map)) if !map.is_empty() => {
                for (key, value) in map {
                    println!("  {BOLD}{key}{RESET}: {}", format_json_value(&value));
                }
            }
            Ok(other) if !trimmed.is_empty() => println!("  {}", format_json_value(&other)),
            _ if !trimmed.is_empty() => println!("  {trimmed}"),
            _ => {}
        }

        if let serde_json::Value::Array(events) = extract_events(&out.stderr) {
            println!("  {BOLD}events{RESET}:");
            for event in events {
                println!("    - {}", format_json_value(&event));
            }
        }
        Ok(())
    } else {
        println!("{RED}{BOLD}\u{2718} Failed{RESET}");
        println!("  {BOLD}command{RESET}: {}", out.command_debug);
        if !trimmed.is_empty() {
            println!("  {BOLD}stdout{RESET}: {trimmed}");
        }
        if !out.stderr.trim().is_empty() {
            println!("  {BOLD}stderr{RESET}: {}", out.stderr.trim());
        }
        Err(String::new())
    }
}

fn format_json_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

/// Best-effort extraction of a transaction hash from stdout/stderr: a
/// standalone 64-character hex token. The stellar CLI shell-out does not
/// expose a structured tx envelope, so this scans text output; returns
/// `null` when nothing hex-shaped of the right length is found.
fn extract_tx_hash(stdout: &str, stderr: &str) -> Option<String> {
    for text in [stdout, stderr] {
        for token in text.split(|c: char| c.is_whitespace()) {
            let cleaned = token.trim_matches(|c: char| !c.is_ascii_alphanumeric());
            if cleaned.len() == 64 && cleaned.chars().all(|c| c.is_ascii_hexdigit()) {
                return Some(cleaned.to_lowercase());
            }
        }
    }
    None
}

/// Best-effort extraction of event diagnostics from stderr: any line
/// mentioning "event" (case-insensitive). Returns `null` when none are found.
fn extract_events(stderr: &str) -> serde_json::Value {
    let events: Vec<serde_json::Value> = stderr
        .lines()
        .filter(|line| line.to_lowercase().contains("event"))
        .map(|line| serde_json::Value::String(line.trim().to_string()))
        .collect();

    if events.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::Value::Array(events)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // --- build_milestones_json ---

    #[test]
    fn test_build_milestones_json_happy_path() {
        let json = build_milestones_json("1000,2000,500").unwrap();
        assert_eq!(
            json,
            r#"[{"id":0,"amount":"1000","status":{"Pending":null},"proof_uri":null},{"id":1,"amount":"2000","status":{"Pending":null},"proof_uri":null},{"id":2,"amount":"500","status":{"Pending":null},"proof_uri":null}]"#
        );
    }

    #[test]
    fn test_build_milestones_json_max_i128() {
        let max = i128::MAX.to_string();
        let json = build_milestones_json(&max).unwrap();
        assert!(
            json.contains(&format!("\"amount\":\"{}\"", i128::MAX)),
            "max i128 value should be preserved verbatim"
        );
    }

    #[test]
    fn test_build_milestones_json_zero_rejects() {
        let result = build_milestones_json("0");
        assert!(result.is_err(), "zero amount must be rejected");
    }

    #[test]
    fn test_build_milestones_json_negative_rejects() {
        let result = build_milestones_json("-500");
        assert!(result.is_err(), "negative amount must be rejected");
    }

    #[test]
    fn test_build_milestones_json_non_numeric_rejects() {
        let result = build_milestones_json("abc");
        assert!(result.is_err(), "non-numeric input must be rejected");
    }

    #[test]
    fn test_build_milestones_json_whitespace_trimmed() {
        let json = build_milestones_json(" 100 , 200 ").unwrap();
        assert!(json.contains("\"amount\":\"100\""));
        assert!(json.contains("\"amount\":\"200\""));
    }

    #[test]
    fn test_build_milestones_json_single_milestone() {
        let json = build_milestones_json("42").unwrap();
        assert_eq!(
            json,
            r#"[{"id":0,"amount":"42","status":{"Pending":null},"proof_uri":null}]"#
        );
    }

    // --- validate_agreement_id ---

    #[test]
    fn agreement_id_valid_lowercase_hex() {
        let id = "a".repeat(64);
        assert!(validate_agreement_id(&id).is_ok());
    }

    #[test]
    fn agreement_id_valid_uppercase_hex() {
        let id = "F".repeat(64);
        assert!(validate_agreement_id(&id).is_ok());
    }

    #[test]
    fn agreement_id_valid_mixed_hex() {
        let id = "0123456789abcdefABCDEF0123456789abcdefABCDEF0123456789abcdefABCD";
        assert_eq!(id.len(), 64);
        assert!(validate_agreement_id(id).is_ok());
    }

    #[test]
    fn agreement_id_rejects_wrong_length() {
        assert!(validate_agreement_id("abc").is_err());
        assert!(validate_agreement_id(&"a".repeat(63)).is_err());
        assert!(validate_agreement_id(&"a".repeat(65)).is_err());
    }

    #[test]
    fn agreement_id_rejects_non_hex_chars() {
        // space injection attempt
        let id = format!("{} --extra-flag x {}", "a".repeat(30), "b".repeat(30));
        assert!(validate_agreement_id(&id).is_err());
    }

    #[test]
    fn agreement_id_rejects_quotes_and_backslash() {
        let id = format!("{}\"{}\\{}", "a".repeat(21), "b".repeat(21), "c".repeat(20));
        assert!(validate_agreement_id(&id).is_err());
    }

    #[test]
    fn agreement_id_rejects_null_byte() {
        let mut id = "a".repeat(64);
        // Replace one char with null byte representation
        id = id.replacen('a', "\0", 1);
        assert!(validate_agreement_id(&id).is_err());
    }

    // --- validate_proof_uri ---

    #[test]
    fn proof_uri_valid_ipfs() {
        assert!(validate_proof_uri("ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco").is_ok());
    }

    #[test]
    fn proof_uri_valid_https() {
        assert!(validate_proof_uri("https://github.com/org/repo/pull/42").is_ok());
    }

    #[test]
    fn proof_uri_rejects_empty() {
        assert!(validate_proof_uri("").is_err());
    }

    #[test]
    fn proof_uri_rejects_control_characters() {
        assert!(validate_proof_uri("https://example.com/\nX-Injected: bad").is_err());
        assert!(validate_proof_uri("https://example.com/\x00null").is_err());
        assert!(validate_proof_uri("https://example.com/\t tab").is_err());
    }

    #[test]
    fn proof_uri_rejects_oversized() {
        let uri = "a".repeat(2049);
        assert!(validate_proof_uri(&uri).is_err());
    }

    #[test]
    fn proof_uri_accepts_max_length() {
        let uri = "a".repeat(2048);
        assert!(validate_proof_uri(&uri).is_ok());
    }

    // --- extract_tx_hash / extract_events ---

    #[test]
    fn extract_tx_hash_finds_standalone_hex() {
        let hash = "a".repeat(64);
        let text = format!("submitted tx {hash} ok");
        assert_eq!(extract_tx_hash(&text, ""), Some(hash));
    }

    #[test]
    fn extract_tx_hash_none_when_absent() {
        assert_eq!(extract_tx_hash("no hash here", ""), None);
    }

    #[test]
    fn extract_events_none_when_absent() {
        assert_eq!(extract_events("plain log line"), serde_json::Value::Null);
    }

    #[test]
    fn extract_events_collects_matching_lines() {
        let stderr = "info: starting\nEvent: transfer occurred\ndone";
        let events = extract_events(stderr);
        assert!(matches!(events, serde_json::Value::Array(ref a) if a.len() == 1));
    }
}
