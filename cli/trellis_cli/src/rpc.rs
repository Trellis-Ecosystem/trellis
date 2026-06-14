use std::process::Command;

use crate::config::Config;

/// Output from a `stellar contract invoke` shell-out.
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

/// Minimal RPC wrapper that delegates to the `stellar` CLI binary.
///
/// This avoids pulling in a Rust Soroban RPC crate and keeps the CLI
/// dependency-light.  Every call translates into:
///
/// ```text
/// stellar contract invoke
///     --id        <contract_id>
///     --source    <source_key>
///     --rpc-url   <rpc_url>
///     --network-passphrase <passphrase>
///     -- <fn_name> [arg1 arg2 …]
/// ```
pub struct RpcClient;

impl RpcClient {
    /// Invoke a Trellis contract function via the `stellar` CLI.
    ///
    /// # Arguments
    /// * `config`  – runtime configuration (RPC URL, keys, contract ID)
    /// * `fn_name` – the Soroban function name (e.g. `"init"`, `"lock_funds"`)
    /// * `args`    – a flat list of `--flag value` pairs **after** the `--`
    ///               separator, e.g. `["--agreement_id", "0x…", "--payer", "G…"]`
    pub fn invoke(config: &Config, fn_name: &str, args: &[String]) -> InvokeOutput {
        // Build the argument list so we can log it on failure.
        let mut cmd_args: Vec<String> = vec![
            "contract".to_string(),
            "invoke".to_string(),
            "--id".to_string(),
            config.contract_id.clone(),
            "--source".to_string(),
            config.source_key.clone(),
            "--rpc-url".to_string(),
            config.rpc_url.clone(),
            "--network-passphrase".to_string(),
            config.network_passphrase.clone(),
            "--".to_string(),
            fn_name.to_string(),
        ];
        cmd_args.extend_from_slice(args);

        // Human-readable version of the full command for debug output.
        let command_debug = format!("stellar {}", cmd_args.join(" "));

        let output = Command::new("stellar").args(&cmd_args).output();

        match output {
            Ok(out) => InvokeOutput {
                stdout: String::from_utf8_lossy(&out.stdout).to_string(),
                stderr: String::from_utf8_lossy(&out.stderr).to_string(),
                success: out.status.success(),
                command_debug,
            },
            Err(e) => InvokeOutput {
                stdout: String::new(),
                stderr: format!(
                    "Failed to spawn `stellar` CLI: {e}\n\
                     Is the Stellar CLI installed?  https://stellar.org/docs/tools/developer-tools/cli/install-cli"
                ),
                success: false,
                command_debug,
            },
        }
    }
}
