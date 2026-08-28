/// Network preset selectable via the CLI's `--network` flag.
#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
#[value(rename_all = "lower")]
pub enum Network {
    Testnet,
    Mainnet,
    Futurenet,
    Custom,
}

/// Known RPC URL and network passphrase for a non-custom `Network`.
pub struct NetworkPreset {
    pub rpc_url: &'static str,
    pub network_passphrase: &'static str,
}

impl Network {
    /// Returns the known RPC URL / passphrase pair for this network, or
    /// `None` for `Custom`, which has no built-in preset.
    pub fn preset(self) -> Option<NetworkPreset> {
        match self {
            Network::Testnet => Some(NetworkPreset {
                rpc_url: "https://soroban-testnet.stellar.org",
                network_passphrase: "Test SDF Network ; September 2015",
            }),
            Network::Mainnet => Some(NetworkPreset {
                rpc_url: "https://mainnet.sorobanrpc.com",
                network_passphrase: "Public Global Stellar Network ; September 2015",
            }),
            Network::Futurenet => Some(NetworkPreset {
                rpc_url: "https://rpc-futurenet.stellar.org",
                network_passphrase: "Test SDF Future Network ; October 2022",
            }),
            Network::Custom => None,
        }
    }
}

/// Trellis CLI configuration.
///
/// Values are loaded from environment variables with Soroban Testnet defaults
/// so the tool works out-of-the-box for local development.
#[derive(Debug, Clone)]
pub struct Config {
    /// Soroban RPC endpoint.
    /// Env: `STELLAR_RPC_URL`
    /// Default: Soroban Testnet public RPC.
    pub rpc_url: String,

    /// Stellar network passphrase used to sign transactions.
    /// Env: `STELLAR_NETWORK_PASSPHRASE`
    /// Default: Testnet passphrase.
    pub network_passphrase: String,

    /// Bech32-encoded Trellis contract address (`C...`).
    /// Env: `TRELLIS_CONTRACT_ID`
    pub contract_id: String,

    /// Stellar secret key (`S...`) or named identity understood by the
    /// `stellar` CLI (e.g. `alice`).
    /// Env: `TRELLIS_SOURCE_KEY`
    pub source_key: String,
}

impl Config {
    /// Resolve configuration from a `--network` preset plus optional CLI
    /// overrides for RPC URL / passphrase.
    ///
    /// Priority (highest to lowest): CLI flags > env vars > network preset.
    /// `Network::Custom` has no preset, so it requires the RPC URL and
    /// passphrase to come from a CLI flag or env var — returns `Err` naming
    /// whichever is still missing.
    ///
    /// The source key is resolved with the same priority, reading from a file
    /// first so a raw `S…` secret seed never has to be placed in an
    /// environment variable that leaks into `/proc/<pid>/environ` or shell
    /// history (see #240):
    ///   `--source-key-file` > `TRELLIS_SOURCE_KEY_FILE` > `TRELLIS_SOURCE_KEY`.
    pub fn resolve(
        network: Network,
        cli_rpc_url: Option<String>,
        cli_network_passphrase: Option<String>,
        cli_source_key_file: Option<String>,
    ) -> Result<Self, String> {
        let preset = network.preset();

        let rpc_url = cli_rpc_url
            .or_else(|| std::env::var("STELLAR_RPC_URL").ok())
            .or_else(|| preset.as_ref().map(|p| p.rpc_url.to_string()))
            .ok_or_else(|| {
                "Error: --network=custom requires --rpc-url (or STELLAR_RPC_URL)".to_string()
            })?;

        let network_passphrase = cli_network_passphrase
            .or_else(|| std::env::var("STELLAR_NETWORK_PASSPHRASE").ok())
            .or_else(|| preset.as_ref().map(|p| p.network_passphrase.to_string()))
            .ok_or_else(|| {
                "Error: --network=custom requires --network-passphrase (or STELLAR_NETWORK_PASSPHRASE)"
                    .to_string()
            })?;

        let contract_id = std::env::var("TRELLIS_CONTRACT_ID")
            .unwrap_or_else(|_| "UNSET_CONTRACT_ID".to_string());

        let source_key =
            match cli_source_key_file.or_else(|| std::env::var("TRELLIS_SOURCE_KEY_FILE").ok()) {
                Some(path) => read_source_key_file(&path)?,
                None => std::env::var("TRELLIS_SOURCE_KEY")
                    .unwrap_or_else(|_| "UNSET_SOURCE_KEY".to_string()),
            };

        Ok(Config {
            rpc_url,
            network_passphrase,
            contract_id,
            source_key,
        })
    }

    /// Validate that all required env vars are set to real values.
    ///
    /// Returns `Err` listing the names of every missing variable. Call this
    /// at startup before dispatching any command so users see a clear error
    /// instead of a cryptic RPC failure deep in the pipeline.
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut missing = Vec::new();

        if self.contract_id == "UNSET_CONTRACT_ID" {
            missing.push("TRELLIS_CONTRACT_ID".to_string());
        }
        if self.source_key == "UNSET_SOURCE_KEY" {
            missing.push("TRELLIS_SOURCE_KEY".to_string());
        }

        if missing.is_empty() {
            Ok(())
        } else {
            Err(missing)
        }
    }
}

/// Read a source key from `path`, trimming surrounding whitespace / newlines.
///
/// Keeping the secret in a file (ideally mode `0600`) instead of an argv
/// entry or exported env var is the mitigation for #240: file contents are
/// never visible in `ps` output.
fn read_source_key_file(path: &str) -> Result<String, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|e| format!("Error: cannot read --source-key-file {path:?}: {e}"))?;
    let key = raw.trim().to_string();
    if key.is_empty() {
        return Err(format!("Error: --source-key-file {path:?} is empty"));
    }
    Ok(key)
}

/// True when `s` looks like a Stellar strkey secret seed (`S…`, 56 base32
/// chars). Such values must never be passed on a command line — see
/// `crate::rpc` and #240.
pub fn is_secret_seed(s: &str) -> bool {
    s.len() == 56
        && s.starts_with('S')
        && s.bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config_with(contract_id: &str, source_key: &str) -> Config {
        Config {
            rpc_url: "https://soroban-testnet.stellar.org".to_string(),
            network_passphrase: "Test SDF Network ; September 2015".to_string(),
            contract_id: contract_id.to_string(),
            source_key: source_key.to_string(),
        }
    }

    #[test]
    fn validate_passes_when_all_vars_set() {
        let cfg = config_with("CAABC123", "SABC123");
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn validate_fails_on_unset_contract_id() {
        let cfg = config_with("UNSET_CONTRACT_ID", "SABC123");
        let err = cfg.validate().unwrap_err();
        assert!(err.contains(&"TRELLIS_CONTRACT_ID".to_string()));
        assert!(!err.contains(&"TRELLIS_SOURCE_KEY".to_string()));
    }

    #[test]
    fn validate_fails_on_unset_source_key() {
        let cfg = config_with("CAABC123", "UNSET_SOURCE_KEY");
        let err = cfg.validate().unwrap_err();
        assert!(err.contains(&"TRELLIS_SOURCE_KEY".to_string()));
        assert!(!err.contains(&"TRELLIS_CONTRACT_ID".to_string()));
    }

    #[test]
    fn validate_reports_all_missing_vars() {
        let cfg = config_with("UNSET_CONTRACT_ID", "UNSET_SOURCE_KEY");
        let err = cfg.validate().unwrap_err();
        assert_eq!(err.len(), 2);
        assert!(err.contains(&"TRELLIS_CONTRACT_ID".to_string()));
        assert!(err.contains(&"TRELLIS_SOURCE_KEY".to_string()));
    }

    // --- Config::resolve() priority + Custom network (#242) ---------------
    //
    // `resolve()` reads process-wide env vars, so these tests serialise on a
    // shared lock and clear every variable they depend on up front. Each test
    // restores nothing because the next one re-clears what it cares about.

    use std::sync::{Mutex, MutexGuard};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    /// Lock the environment and wipe every var `resolve()` consults so a test
    /// starts from a known-empty state.
    fn env_guard() -> MutexGuard<'static, ()> {
        let guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        for k in [
            "STELLAR_RPC_URL",
            "STELLAR_NETWORK_PASSPHRASE",
            "TRELLIS_CONTRACT_ID",
            "TRELLIS_SOURCE_KEY",
            "TRELLIS_SOURCE_KEY_FILE",
        ] {
            std::env::remove_var(k);
        }
        guard
    }

    fn temp_path(tag: &str) -> std::path::PathBuf {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("trellis_{tag}_{}_{nanos}", std::process::id()))
    }

    #[test]
    fn resolve_uses_testnet_preset_when_no_flags_or_env() {
        let _g = env_guard();
        let cfg = Config::resolve(Network::Testnet, None, None, None).unwrap();
        let preset = Network::Testnet.preset().unwrap();
        assert_eq!(cfg.rpc_url, preset.rpc_url);
        assert_eq!(cfg.network_passphrase, preset.network_passphrase);
        // Unset optional vars fall back to the sentinel values.
        assert_eq!(cfg.contract_id, "UNSET_CONTRACT_ID");
        assert_eq!(cfg.source_key, "UNSET_SOURCE_KEY");
    }

    #[test]
    fn resolve_env_var_overrides_preset() {
        let _g = env_guard();
        std::env::set_var("STELLAR_RPC_URL", "https://env.example/rpc");
        let cfg = Config::resolve(Network::Testnet, None, None, None).unwrap();
        assert_eq!(cfg.rpc_url, "https://env.example/rpc");
        // Passphrase still comes from the preset.
        assert_eq!(
            cfg.network_passphrase,
            Network::Testnet.preset().unwrap().network_passphrase
        );
    }

    #[test]
    fn resolve_flag_overrides_env_and_preset() {
        let _g = env_guard();
        std::env::set_var("STELLAR_RPC_URL", "https://env.example/rpc");
        let cfg = Config::resolve(
            Network::Testnet,
            Some("https://flag.example/rpc".to_string()),
            None,
            None,
        )
        .unwrap();
        assert_eq!(cfg.rpc_url, "https://flag.example/rpc");
    }

    #[test]
    fn resolve_custom_network_missing_rpc_url_is_err() {
        let _g = env_guard();
        let err = Config::resolve(Network::Custom, None, None, None).unwrap_err();
        assert!(err.contains("--rpc-url"), "got: {err}");
    }

    #[test]
    fn resolve_custom_network_missing_passphrase_is_err() {
        let _g = env_guard();
        let err = Config::resolve(
            Network::Custom,
            Some("https://custom.example/rpc".to_string()),
            None,
            None,
        )
        .unwrap_err();
        assert!(err.contains("--network-passphrase"), "got: {err}");
    }

    #[test]
    fn resolve_custom_network_with_all_flags_ok() {
        let _g = env_guard();
        let cfg = Config::resolve(
            Network::Custom,
            Some("https://custom.example/rpc".to_string()),
            Some("Custom Passphrase".to_string()),
            None,
        )
        .unwrap();
        assert_eq!(cfg.rpc_url, "https://custom.example/rpc");
        assert_eq!(cfg.network_passphrase, "Custom Passphrase");
    }

    #[test]
    fn resolve_custom_network_reads_from_env() {
        let _g = env_guard();
        std::env::set_var("STELLAR_RPC_URL", "https://env.example/rpc");
        std::env::set_var("STELLAR_NETWORK_PASSPHRASE", "Env Passphrase");
        let cfg = Config::resolve(Network::Custom, None, None, None).unwrap();
        assert_eq!(cfg.rpc_url, "https://env.example/rpc");
        assert_eq!(cfg.network_passphrase, "Env Passphrase");
    }

    #[test]
    fn resolve_then_validate_rejects_unset_required_vars() {
        let _g = env_guard();
        let cfg = Config::resolve(Network::Testnet, None, None, None).unwrap();
        let missing = cfg.validate().unwrap_err();
        assert!(missing.contains(&"TRELLIS_CONTRACT_ID".to_string()));
        assert!(missing.contains(&"TRELLIS_SOURCE_KEY".to_string()));
    }

    #[test]
    fn resolve_then_validate_passes_when_required_vars_present() {
        let _g = env_guard();
        std::env::set_var("TRELLIS_CONTRACT_ID", "CAABC123");
        std::env::set_var("TRELLIS_SOURCE_KEY", "alice");
        let cfg = Config::resolve(Network::Testnet, None, None, None).unwrap();
        assert_eq!(cfg.contract_id, "CAABC123");
        assert_eq!(cfg.source_key, "alice");
        assert!(cfg.validate().is_ok());
    }

    // --- source key file resolution (#240) ------------------------------

    #[test]
    fn resolve_reads_source_key_from_file_flag() {
        let _g = env_guard();
        let path = temp_path("key_flag");
        // Trailing whitespace / newline must be trimmed off.
        std::fs::write(&path, "  SECRET-SEED-VALUE  \n").unwrap();
        let cfg = Config::resolve(
            Network::Testnet,
            None,
            None,
            Some(path.to_string_lossy().into_owned()),
        )
        .unwrap();
        std::fs::remove_file(&path).ok();
        assert_eq!(cfg.source_key, "SECRET-SEED-VALUE");
    }

    #[test]
    fn resolve_source_key_file_flag_beats_env_var() {
        let _g = env_guard();
        let path = temp_path("key_priority");
        std::fs::write(&path, "from-file").unwrap();
        std::env::set_var("TRELLIS_SOURCE_KEY", "from-env");
        let cfg = Config::resolve(
            Network::Testnet,
            None,
            None,
            Some(path.to_string_lossy().into_owned()),
        )
        .unwrap();
        std::fs::remove_file(&path).ok();
        assert_eq!(cfg.source_key, "from-file");
    }

    #[test]
    fn resolve_reads_source_key_file_from_env_var() {
        let _g = env_guard();
        let path = temp_path("key_envfile");
        std::fs::write(&path, "keyed-by-env-file").unwrap();
        std::env::set_var(
            "TRELLIS_SOURCE_KEY_FILE",
            path.to_string_lossy().into_owned(),
        );
        let cfg = Config::resolve(Network::Testnet, None, None, None).unwrap();
        std::fs::remove_file(&path).ok();
        assert_eq!(cfg.source_key, "keyed-by-env-file");
    }

    #[test]
    fn resolve_missing_source_key_file_is_err() {
        let _g = env_guard();
        let err = Config::resolve(
            Network::Testnet,
            None,
            None,
            Some("/no/such/trellis/key/file".to_string()),
        )
        .unwrap_err();
        assert!(err.contains("source-key-file"), "got: {err}");
    }

    #[test]
    fn resolve_empty_source_key_file_is_err() {
        let _g = env_guard();
        let path = temp_path("key_empty");
        std::fs::write(&path, "   \n").unwrap();
        let err = Config::resolve(
            Network::Testnet,
            None,
            None,
            Some(path.to_string_lossy().into_owned()),
        )
        .unwrap_err();
        std::fs::remove_file(&path).ok();
        assert!(err.contains("empty"), "got: {err}");
    }

    // --- is_secret_seed ------------------------------------------------

    #[test]
    fn is_secret_seed_matches_strkey_shape() {
        // Stellar secret seeds are exactly 56 base32 chars starting with `S`.
        let seed = format!("S{}", "A".repeat(55));
        assert_eq!(seed.len(), 56);
        assert!(is_secret_seed(&seed));
    }

    #[test]
    fn is_secret_seed_rejects_identity_names_and_public_keys() {
        assert!(!is_secret_seed("alice"));
        assert!(!is_secret_seed("UNSET_SOURCE_KEY"));
        // Public key: right length + base32, wrong `G` prefix.
        assert!(!is_secret_seed(&format!("G{}", "A".repeat(55))));
        // Lowercase is not valid strkey.
        assert!(!is_secret_seed(&format!("s{}", "a".repeat(55))));
        // Right prefix, wrong length.
        assert!(!is_secret_seed("SABC123"));
    }
}
