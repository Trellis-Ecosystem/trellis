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
    pub fn resolve(
        network: Network,
        cli_rpc_url: Option<String>,
        cli_network_passphrase: Option<String>,
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

        let source_key = std::env::var("TRELLIS_SOURCE_KEY")
            .unwrap_or_else(|_| "UNSET_SOURCE_KEY".to_string());

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

    #[test]
    fn resolve_then_validate_catches_unset_values() {
        // #246: a config resolved with the required env vars absent must be
        // rejected by validate() rather than passing through with placeholders.
        std::env::remove_var("TRELLIS_CONTRACT_ID");
        std::env::remove_var("TRELLIS_SOURCE_KEY");

        let cfg = Config::resolve(Network::Testnet, None, None).expect("preset resolves");
        let missing = cfg.validate().unwrap_err();

        assert!(missing.contains(&"TRELLIS_CONTRACT_ID".to_string()));
        assert!(missing.contains(&"TRELLIS_SOURCE_KEY".to_string()));
    }
}
