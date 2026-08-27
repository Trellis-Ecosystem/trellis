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

// ---------------------------------------------------------------------------
// RPC URL validation (#156)
// ---------------------------------------------------------------------------

/// Hosts that are always safe to reach over cleartext `http://`.
fn is_loopback_host(host: &str) -> bool {
    let host = host.trim_start_matches('[').trim_end_matches(']');
    host == "localhost"
        || host == "::1"
        || host == "127.0.0.1"
        || host.starts_with("127.")
        || host.ends_with(".localhost")
}

/// Validate a resolved RPC URL before the CLI makes any network call (#156).
///
/// An attacker who can plant a `.env` file could otherwise set
/// `STELLAR_RPC_URL` to an arbitrary endpoint that returns forged transaction
/// results, or to a cleartext `http://` URL that can be tampered with in
/// transit.
///
/// Rules:
/// * `https://…` — always accepted.
/// * `http://…`  — accepted only when the host is loopback
///   (`localhost` / `127.0.0.1` / `::1` / `*.localhost`), **or** when
///   `allow_insecure` is set (the `--unsafe-rpc` flag), in which case a
///   warning string is returned.
/// * no scheme, or any scheme other than http/https, or a missing host —
///   rejected.
///
/// Returns:
/// * `Ok(None)` — URL is valid and needs no warning.
/// * `Ok(Some(warning))` — URL is allowed but the caller should print the
///   warning (cleartext HTTP permitted only via `--unsafe-rpc`).
/// * `Err(message)` — URL must be refused; the caller should abort.
pub fn validate_rpc_url(url: &str, allow_insecure: bool) -> Result<Option<String>, String> {
    let url = url.trim();
    if url.is_empty() {
        return Err(
            "Error: RPC URL is empty — set --rpc-url or STELLAR_RPC_URL to an https:// endpoint"
                .to_string(),
        );
    }

    let (scheme, rest) = url.split_once("://").ok_or_else(|| {
        format!("Error: invalid RPC URL {url:?} — expected an http:// or https:// URL")
    })?;

    // Host is everything before the first '/', '?' or '#', minus any
    // `user:pass@` credentials prefix and any `:port` suffix.
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host_port = authority.rsplit('@').next().unwrap_or("");
    let host = match host_port.strip_prefix('[') {
        // Bracketed IPv6 literal: keep everything up to and including ']'.
        Some(after) => {
            let end = after.find(']').map(|i| i + 2).unwrap_or(host_port.len());
            &host_port[..end.min(host_port.len())]
        }
        None => host_port
            .rsplit_once(':')
            .map(|(h, _)| h)
            .unwrap_or(host_port),
    };

    if host.is_empty() {
        return Err(format!("Error: invalid RPC URL {url:?} — missing host"));
    }

    match scheme.to_ascii_lowercase().as_str() {
        "https" => Ok(None),
        "http" => {
            if is_loopback_host(host) {
                Ok(None)
            } else if allow_insecure {
                Ok(Some(format!(
                    "warning: using cleartext HTTP RPC endpoint {url} (--unsafe-rpc). \
                     Responses from this endpoint are not authenticated and can be \
                     tampered with — never use this against mainnet."
                )))
            } else {
                Err(format!(
                    "Error: refusing to use insecure RPC URL {url:?}. Non-localhost \
                     endpoints must use https://. Pass --unsafe-rpc to allow http:// \
                     for local development."
                ))
            }
        }
        other => Err(format!(
            "Error: unsupported RPC URL scheme {other:?} in {url:?} — expected http or https"
        )),
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

    // --- validate_rpc_url (#156) ---

    #[test]
    fn rpc_url_https_testnet_passes_without_warning() {
        assert_eq!(
            validate_rpc_url("https://soroban-testnet.stellar.org", false),
            Ok(None)
        );
    }

    #[test]
    fn rpc_url_https_with_port_and_path_passes() {
        assert_eq!(
            validate_rpc_url("https://rpc.example.com:8443/soroban/rpc", false),
            Ok(None)
        );
    }

    #[test]
    fn rpc_url_rejects_non_url_string() {
        let err = validate_rpc_url("not-a-url", false).unwrap_err();
        assert!(err.contains("expected an http:// or https:// URL"));
    }

    #[test]
    fn rpc_url_rejects_unsupported_scheme() {
        let err = validate_rpc_url("ftp://example.com", false).unwrap_err();
        assert!(err.contains("unsupported RPC URL scheme"));
    }

    #[test]
    fn rpc_url_rejects_empty() {
        assert!(validate_rpc_url("   ", false).is_err());
    }

    #[test]
    fn rpc_url_rejects_missing_host() {
        assert!(validate_rpc_url("https:///path-only", false).is_err());
    }

    #[test]
    fn rpc_url_http_localhost_passes_without_flag() {
        assert_eq!(validate_rpc_url("http://localhost:8000", false), Ok(None));
        assert_eq!(
            validate_rpc_url("http://127.0.0.1:8000/rpc", false),
            Ok(None)
        );
        assert_eq!(validate_rpc_url("http://[::1]:8000", false), Ok(None));
    }

    #[test]
    fn rpc_url_http_non_localhost_rejected_without_flag() {
        let err = validate_rpc_url("http://evil.example.com", false).unwrap_err();
        assert!(err.contains("refusing to use insecure RPC URL"));
        assert!(err.contains("--unsafe-rpc"));
    }

    #[test]
    fn rpc_url_http_non_localhost_warns_with_unsafe_flag() {
        let warning = validate_rpc_url("http://devnet.internal:8000", true)
            .unwrap()
            .expect("expected a warning for cleartext http");
        assert!(warning.contains("cleartext HTTP"));
    }

    #[test]
    fn rpc_url_http_localhost_does_not_warn_even_with_unsafe_flag() {
        assert_eq!(validate_rpc_url("http://localhost:8000", true), Ok(None));
    }
}
