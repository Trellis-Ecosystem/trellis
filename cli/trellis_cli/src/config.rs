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
    /// Load configuration from environment variables, falling back to
    /// Soroban Testnet defaults where applicable.
    pub fn from_env() -> Self {
        Config {
            rpc_url: std::env::var("STELLAR_RPC_URL")
                .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".to_string()),

            network_passphrase: std::env::var("STELLAR_NETWORK_PASSPHRASE")
                .unwrap_or_else(|_| "Test SDF Network ; September 2015".to_string()),

            contract_id: std::env::var("TRELLIS_CONTRACT_ID")
                .unwrap_or_else(|_| "UNSET_CONTRACT_ID".to_string()),

            source_key: std::env::var("TRELLIS_SOURCE_KEY")
                .unwrap_or_else(|_| "UNSET_SOURCE_KEY".to_string()),
        }
    }
}
