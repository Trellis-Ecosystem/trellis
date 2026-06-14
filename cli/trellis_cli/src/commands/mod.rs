use clap::Subcommand;

use crate::config::Config;
use crate::rpc::RpcClient;

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
    },

    /// Lock funds for a specific milestone into the escrow contract.
    LockFunds {
        /// Agreement ID (hex-encoded, 64 chars).
        #[arg(long)]
        agreement_id: String,

        /// Zero-based index of the milestone to fund.
        #[arg(long)]
        milestone_id: u32,
    },

    /// Submit proof of work for a funded milestone.
    SubmitWork {
        #[arg(long)]
        agreement_id: String,
        #[arg(long)]
        milestone_id: u32,
        #[arg(long)]
        proof_uri: String,
    },

    /// Approve submitted work and release funds to the payee.
    ApproveRelease {
        #[arg(long)]
        agreement_id: String,
        #[arg(long)]
        milestone_id: u32,
    },

    /// Raise a dispute on a funded or work-submitted milestone.
    RaiseDispute {
        #[arg(long)]
        agreement_id: String,
        #[arg(long)]
        milestone_id: u32,
        /// Address of the party raising the dispute (payer or payee).
        #[arg(long)]
        caller: String,
    },

    /// Resolve a disputed milestone as the designated resolver.
    ResolveDispute {
        #[arg(long)]
        agreement_id: String,
        #[arg(long)]
        milestone_id: u32,
        /// Pass --refund-to-payer to return funds to payer; omit to release to payee.
        #[arg(long, default_value = "false")]
        refund_to_payer: bool,
    },

    /// Cancel a milestone that was never funded (status = Pending).
    CancelMilestone {
        #[arg(long)]
        agreement_id: String,
        #[arg(long)]
        milestone_id: u32,
    },

    /// Query the current state of an agreement (not yet implemented).
    Status {
        #[arg(long)]
        agreement_id: String,
    },
}

// ---------------------------------------------------------------------------
// Dispatch — route each command to its handler
// ---------------------------------------------------------------------------

pub fn dispatch(cmd: Commands, config: &Config) {
    match cmd {
        Commands::Init {
            agreement_id,
            payer,
            payee,
            token,
            resolver,
            milestones,
        } => run_init(config, agreement_id, payer, payee, token, resolver, milestones),

        Commands::LockFunds {
            agreement_id,
            milestone_id,
        } => run_lock_funds(config, agreement_id, milestone_id),

        // ── Stubbed commands ──────────────────────────────────────────────
        Commands::SubmitWork { .. }
        | Commands::ApproveRelease { .. }
        | Commands::RaiseDispute { .. }
        | Commands::ResolveDispute { .. }
        | Commands::CancelMilestone { .. }
        | Commands::Status { .. } => {
            println!("Not yet implemented — contributions welcome, see issue #1");
        }
    }
}

// ---------------------------------------------------------------------------
// Active command implementations
// ---------------------------------------------------------------------------

/// Build and execute `stellar contract invoke … -- init …`
fn run_init(
    config: &Config,
    agreement_id: String,
    payer: String,
    payee: String,
    token: String,
    resolver: String,
    milestones_csv: String,
) {
    // Parse "1000,2000,500" → Vec<u64> → JSON array for the stellar CLI.
    // EscrowStatus::Pending = discriminant 0 in the XDR enum encoding.
    let milestones_json = build_milestones_json(&milestones_csv);

    // The stellar CLI expects XDR-encoded arguments.  Struct fields are
    // passed as JSON which the CLI converts to XDR before invoking.
    let args = vec![
        "--agreement_id".to_string(),
        format!("\"{}\"", agreement_id),
        "--payer".to_string(),
        payer,
        "--payee".to_string(),
        payee,
        "--token".to_string(),
        token,
        "--milestones".to_string(),
        milestones_json,
        "--dispute_resolver".to_string(),
        resolver,
    ];

    let out = RpcClient::invoke(config, "init", &args);
    print_output(&out);
}

/// Build and execute `stellar contract invoke … -- lock_funds …`
fn run_lock_funds(config: &Config, agreement_id: String, milestone_id: u32) {
    let args = vec![
        "--agreement_id".to_string(),
        format!("\"{}\"", agreement_id),
        "--milestone_id".to_string(),
        milestone_id.to_string(),
    ];

    let out = RpcClient::invoke(config, "lock_funds", &args);
    print_output(&out);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/// Convert a comma-separated amount string like `"1000,2000"` into the JSON
/// array format the `stellar` CLI accepts for a `Vec<Milestone>` argument.
///
/// Each milestone is given:
/// - `id`       – its 0-based position in the list
/// - `amount`   – the parsed amount
/// - `status`   – `{"Pending": null}` (XDR union encoding for discriminant 0)
/// - `proof_uri`– empty string (no proof yet)
///
/// Example output:
/// ```json
/// [{"id":0,"amount":1000,"status":{"Pending":null},"proof_uri":""},
///  {"id":1,"amount":2000,"status":{"Pending":null},"proof_uri":""}]
/// ```
fn build_milestones_json(csv: &str) -> String {
    let entries: Vec<String> = csv
        .split(',')
        .enumerate()
        .filter_map(|(idx, part)| {
            let trimmed = part.trim();
            match trimmed.parse::<u64>() {
                Ok(amount) => Some(format!(
                    r#"{{"id":{idx},"amount":{amount},"status":{{"Pending":null}},"proof_uri":""}}"#,
                )),
                Err(_) => {
                    eprintln!(
                        "Warning: skipping invalid milestone amount {:?} at index {}",
                        trimmed, idx
                    );
                    None
                }
            }
        })
        .collect();

    format!("[{}]", entries.join(","))
}

/// Print the result of an RPC call.
/// On failure, also prints the full command so the user can reproduce it.
fn print_output(out: &crate::rpc::InvokeOutput) {
    if out.success {
        println!("{}", out.stdout.trim());
    } else {
        eprintln!("── Transaction failed ──────────────────────────────────");
        eprintln!("Command: {}", out.command_debug);
        if !out.stdout.is_empty() {
            eprintln!("stdout:\n{}", out.stdout.trim());
        }
        if !out.stderr.is_empty() {
            eprintln!("stderr:\n{}", out.stderr.trim());
        }
        std::process::exit(1);
    }
}
