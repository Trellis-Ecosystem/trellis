mod commands;
mod config;
mod rpc;
mod utils;

use clap::{CommandFactory, Parser};
use commands::{Commands, OutputFormat, OutputOpts};
use config::Network;
use std::process;

// ---------------------------------------------------------------------------
// Top-level CLI definition
// ---------------------------------------------------------------------------

/// Trellis Protocol CLI — milestone-based escrow on Stellar Soroban.
///
/// Configuration can be loaded from a `.env` file in the working directory or
/// set as environment variables.  CLI flags take highest priority, then env
/// vars, then the `.env` file.
///
/// Required variables:
///   TRELLIS_CONTRACT_ID        — Bech32 contract address (`C…`)
///   TRELLIS_SOURCE_KEY         — Stellar secret key or named identity
///
/// Optional variables (Soroban Testnet used as default):
///   STELLAR_RPC_URL            — Soroban JSON-RPC endpoint
///   STELLAR_NETWORK_PASSPHRASE — Network passphrase for transaction signing
#[derive(Parser, Debug)]
#[command(
    name = "trellis",
    version = env!("CARGO_PKG_VERSION"),
    // `--version` (long form) shows this extended string; `-V` (short form)
    // still shows the bare crate version above. Includes the on-chain
    // contract's soroban-sdk compatibility range so bug reports carry
    // enough environment context without a separate lookup.
    long_version = concat!(
        env!("CARGO_PKG_VERSION"),
        "\nsoroban-sdk compat: >=22.0.0, <23 (see contracts/trellis_core/Cargo.toml)",
    ),
    author,
    about,
    long_about = None,
    propagate_version = true,
)]
struct Cli {
    /// Network preset to connect to. `custom` requires `--rpc-url` and
    /// `--network-passphrase`.
    #[arg(long, global = true, value_enum, default_value_t = Network::Testnet)]
    network: Network,

    /// Custom Soroban RPC endpoint. Required when `--network=custom`;
    /// overrides the preset / env var for any other network.
    #[arg(long, global = true)]
    rpc_url: Option<String>,

    /// Custom network passphrase. Required when `--network=custom`;
    /// overrides the preset / env var for any other network.
    #[arg(long, global = true)]
    network_passphrase: Option<String>,

    #[command(subcommand)]
    command: Commands,

    /// Output a uniform, machine-parseable JSON envelope instead of raw
    /// command output. Takes priority over `--human-readable`.
    #[arg(long, global = true)]
    json: bool,

    /// Parse the underlying stellar CLI output into a human-friendly,
    /// colorized summary. Falls back to raw output if parsing fails.
    #[arg(short = 'H', long = "human-readable", global = true)]
    human_readable: bool,

    /// Suppress all output except the final JSON result. Implies `--json`.
    #[arg(long, global = true)]
    quiet: bool,

    /// Print the `stellar contract invoke` command that would run, without
    /// executing it or submitting anything on-chain.
    #[arg(long, global = true)]
    dry_run: bool,
}

// ---------------------------------------------------------------------------
// Environment validation (#68)
// ---------------------------------------------------------------------------

/// Verify that the `stellar` CLI binary is available in `PATH`.
///
/// This is called once at startup so users get a clear, actionable error
/// message instead of a cryptic OS-level "program not found" when the binary
/// is missing.
///
/// Returns `Ok(())` if the binary is found, or `Err(message)` with
/// installation instructions if it is not.
fn validate_environment() -> Result<(), String> {
    use std::process::Command;

    match Command::new("stellar").arg("--version").output() {
        Ok(_) => Ok(()),
        Err(_) => Err(
            "Error: `stellar` CLI not found in PATH.\n\
             \n\
             Install it with:\n\
             \n\
             \tcargo install --locked stellar-cli --features opt\n\
             \n\
             Or follow the official guide:\n\
             \thttps://developers.stellar.org/docs/tools/cli/install-cli\n\
             \n\
             After installing, run `stellar --version` to confirm the installation."
                .to_string(),
        ),
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() {
    // ── #66: Load .env file before reading any env vars ───────────────────
    // dotenvy::dotenv() looks for a `.env` file in the current directory (and
    // walks up to the workspace root).  `.ok()` silently ignores a missing
    // file — users who rely purely on exported env vars are unaffected.
    // Priority: CLI args > env vars > .env file values.
    dotenvy::dotenv().ok();

    let cli = Cli::parse();

    // ── #75: Shell completions never touch the network or the stellar
    // binary, so handle them before environment validation / dispatch. ────
    // Matched by reference (not by value) so `cli.command` is still whole
    // and movable into `dispatch` below when this arm doesn't match.
    if let Commands::Completion { shell } = &cli.command {
        let mut cmd = Cli::command();
        let bin_name = cmd.get_name().to_string();
        clap_complete::generate(*shell, &mut cmd, bin_name, &mut std::io::stdout());
        return;
    }

    // ── #68: Validate stellar binary at startup ────────────────────────────
    if let Err(msg) = validate_environment() {
        eprintln!("{msg}");
        process::exit(1);
    }

    let config = match config::Config::resolve(cli.network, cli.rpc_url, cli.network_passphrase) {
        Ok(config) => config,
        Err(msg) => {
            eprintln!("{msg}");
            process::exit(1);
        }
    };

    // ── #77/#74: --json takes priority over --human-readable; --quiet
    // forces the JSON envelope so the only stdout line is the result. ──────
    let format = if cli.json || cli.quiet {
        OutputFormat::Json
    } else if cli.human_readable {
        OutputFormat::Human
    } else {
        OutputFormat::Raw
    };
    let opts = OutputOpts {
        format,
        quiet: cli.quiet,
        dry_run: cli.dry_run,
    };

    // ── #67: Propagate errors from dispatch; exit(1) only in main ─────────
    // All cleanup (destructors, buffer flushes) runs before the exit call
    // because process::exit is only called here, never inside library code.
    if let Err(msg) = commands::dispatch(cli.command, &config, &opts) {
        if !msg.is_empty() {
            eprintln!("{msg}");
        }
        process::exit(1);
    }
}
