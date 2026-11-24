use serde::Deserialize;
/// Network preset selectable via the CLI's `--network` flag.
#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
#[value(rename_all = "lower")]
pub enum Network {
    Testnet,
    Mainnet,
    Futurenet,
    Custom,
}

/// Escrow role whose identity should sign a command, selected with `--as`.
///
/// Each role reads its key from its own env vars (typically set once in
/// `.env`), so one config can hold the payer, payee and resolver identities
/// together instead of re-exporting `TRELLIS_SOURCE_KEY` before every command
/// (#483).
#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
#[value(rename_all = "lower")]
pub enum Role {
    Payer,
    Payee,
    Resolver,
}

impl Role {
    /// Env var holding this role's key (secret seed or `stellar` identity).
    pub fn key_var(self) -> &'static str {
        match self {
            Role::Payer => "TRELLIS_PAYER_KEY",
            Role::Payee => "TRELLIS_PAYEE_KEY",
            Role::Resolver => "TRELLIS_RESOLVER_KEY",
        }
    }

    /// Env var holding a path to a file containing this role's key.
    pub fn key_file_var(self) -> &'static str {
        match self {
            Role::Payer => "TRELLIS_PAYER_KEY_FILE",
            Role::Payee => "TRELLIS_PAYEE_KEY_FILE",
            Role::Resolver => "TRELLIS_RESOLVER_KEY_FILE",
        }
    }

    fn name(self) -> &'static str {
        match self {
            Role::Payer => "payer",
            Role::Payee => "payee",
            Role::Resolver => "resolver",
        }
    }
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
#[derive(Clone)]
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

    /// Where `source_key` was read from: `--source-key-file`,
    /// `TRELLIS_SOURCE_KEY_FILE`, `TRELLIS_SOURCE_KEY`, or `unset`. Only
    /// used for diagnostics (`trellis config`, #485).
    pub source_key_origin: &'static str,
}

/// Written by hand so a `{:?}` of a `Config` never prints a raw secret seed
/// (#641). Named `stellar keys` identities are not secret and are shown.
impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let source_key = if is_secret_seed(&self.source_key) {
            "<redacted>"
        } else {
            self.source_key.as_str()
        };
        f.debug_struct("Config")
            .field("rpc_url", &self.rpc_url)
            .field("network_passphrase", &self.network_passphrase)
            .field("contract_id", &self.contract_id)
            .field("source_key", &source_key)
            .field("source_key_origin", &self.source_key_origin)
            .finish()
    }
}

/// Number of characters in a Stellar strkey address (`C…` / `G…` / `S…`),
/// including the one-character type prefix.
const STRKEY_LEN: usize = 56;

/// Validate the format of a Stellar contract address (`C…`).
///
/// A contract ID is a strkey-encoded value: exactly [`STRKEY_LEN`] characters,
/// beginning with `C`, containing only RFC 4648 base32 characters (`A`–`Z`,
/// `2`–`7`). This is a cheap structural check — it does not verify the trailing
/// CRC16 checksum — but it catches the overwhelmingly common mistakes (a
/// truncated paste, a stray space, the wrong key type such as an `S…` secret)
/// before they turn into a confusing failure deep inside the Stellar CLI.
pub fn validate_contract_id(id: &str) -> Result<(), String> {
    if !id.starts_with('C') {
        return Err(format!(
            "TRELLIS_CONTRACT_ID must be a Stellar contract address starting with 'C' \
             (e.g. CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ); got {id:?}"
        ));
    }
    if id.len() != STRKEY_LEN {
        return Err(format!(
            "TRELLIS_CONTRACT_ID must be exactly {STRKEY_LEN} characters, got {}",
            id.len()
        ));
    }
    if !id
        .chars()
        .all(|c| c.is_ascii_uppercase() || ('2'..='7').contains(&c))
    {
        return Err(
            "TRELLIS_CONTRACT_ID must contain only base32 characters (A-Z, 2-7)".to_string(),
        );
    }
    Ok(())
}

/// Validate that an RPC endpoint URL is well-formed and uses an HTTP(S) scheme.
///
/// A typo like `httsp://…` or a bare `soroban-testnet.stellar.org` with no
/// scheme otherwise surfaces only much later as an opaque connection error.
/// Both `http` and `https` are accepted so a locally-run RPC
/// (`http://localhost:8000`) still works; any other scheme (`ftp`, `file`,
/// `ws`, …) and any URL with an empty host is rejected here with a clear
/// message.
///
/// Cleartext `http://` to a non-loopback host is refused by default to
/// prevent a compromised `.env` from silently redirecting traffic to an
/// unauthenticated endpoint. Pass `unsafe_rpc = true` to downgrade the hard
/// error to a printed warning (useful for development devnets). This mirrors
/// the `--unsafe-rpc` CLI flag (#156).
pub fn validate_rpc_url(raw: &str, unsafe_rpc: bool) -> Result<Option<String>, String> {
    let shown = redact_url(raw);
    let parsed =
        url::Url::parse(raw).map_err(|e| format!("RPC URL {shown:?} is not a valid URL: {e}"))?;

    match parsed.scheme() {
        "http" | "https" => {}
        other => {
            return Err(format!(
                "RPC URL scheme must be http or https, got {other:?} (in {shown:?})"
            ));
        }
    }

    if parsed.host_str().map_or(true, str::is_empty) {
        return Err(format!("RPC URL {shown:?} is missing a host"));
    }

    // Guard against cleartext HTTP to non-loopback hosts (#156).
    if parsed.scheme() == "http" {
        let host = parsed.host_str().unwrap_or("");
        let is_loopback = matches!(host, "localhost" | "127.0.0.1" | "::1");
        if !is_loopback {
            let msg = format!(
                "Warning: RPC URL {shown:?} uses cleartext HTTP to a non-loopback host. \
                 Traffic may be intercepted. Use https:// or pass --unsafe-rpc to suppress this error."
            );
            if unsafe_rpc {
                return Ok(Some(msg));
            } else {
                return Err(msg);
            }
        }
    }

    Ok(None)
}

/// A copy of the URL `raw` that is safe to print (#642).
///
/// Hosted Soroban RPC providers often put an API key in the URL, so the
/// userinfo (`user:password@`) is removed and every query-string value is
/// replaced with `***` (a bare `?token` is replaced as a whole). A key
/// embedded in a path segment (e.g. `https://rpc.example/v1/<key>`) can't be
/// told apart from an ordinary path and is left as-is. A URL with neither
/// userinfo nor a query, or one that doesn't parse, is returned unchanged.
pub fn redact_url(raw: &str) -> String {
    let Ok(mut parsed) = url::Url::parse(raw) else {
        return raw.to_string();
    };
    if parsed.username().is_empty() && parsed.password().is_none() && parsed.query().is_none() {
        return raw.to_string();
    }
    let _ = parsed.set_username("");
    let _ = parsed.set_password(None);
    if let Some(query) = parsed.query() {
        let masked = query
            .split('&')
            .map(|pair| match pair.split_once('=') {
                Some((key, _)) => format!("{key}=***"),
                None => "***".to_string(),
            })
            .collect::<Vec<_>>()
            .join("&");
        parsed.set_query(Some(&masked));
    }
    parsed.to_string()
}

/// Refuse cleartext `http://` to a non-loopback RPC host (#156).
///
/// Runs after [`validate_rpc_url`] has accepted the URL's shape. A planted
/// `.env` could otherwise point the CLI at an unauthenticated endpoint that
/// forges results. `allow_insecure` (the `--unsafe-rpc` flag) downgrades the
/// refusal to a warning the caller prints.
///
/// Returns `Ok(None)` when no warning is needed, `Ok(Some(warning))` when
/// cleartext was allowed by the flag, and `Err(message)` when it was not.
pub fn check_rpc_transport(raw: &str, allow_insecure: bool) -> Result<Option<String>, String> {
    let shown = redact_url(raw);
    let parsed =
        url::Url::parse(raw).map_err(|e| format!("RPC URL {shown:?} is not a valid URL: {e}"))?;
    if parsed.scheme() != "http" {
        return Ok(None);
    }

    let loopback = match parsed.host() {
        Some(url::Host::Domain(d)) => d == "localhost" || d.ends_with(".localhost"),
        Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
        Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
        None => false,
    };

    if loopback {
        Ok(None)
    } else if allow_insecure {
        Ok(Some(format!(
            "warning: using cleartext HTTP RPC endpoint {shown} (--unsafe-rpc). \
             Responses from this endpoint are not authenticated and can be \
             tampered with — never use this against mainnet."
        )))
    } else {
        Err(format!(
            "Error: refusing to use insecure RPC URL {shown:?}. Non-localhost \
             endpoints must use https://. Pass --unsafe-rpc to allow http:// \
             for local development."
        ))
    }
}

/// Warnings for an explicitly chosen `--network` preset that env vars
/// override (#654).
///
/// `Config::resolve` lets `STELLAR_RPC_URL` / `STELLAR_NETWORK_PASSPHRASE` win
/// over the preset, so a `.env` holding testnet values silently turns
/// `--network mainnet` into a testnet run. When the network was typed (it is
/// `None` for the default, which stays silent) this names each env var that
/// replaces a preset value, and warns when only one of the URL / passphrase
/// pair is overridden, since the other still comes from the preset.
pub fn network_override_warnings(
    explicit_network: Option<Network>,
    cli_rpc_url: Option<&str>,
    cli_network_passphrase: Option<&str>,
) -> Vec<String> {
    network_override_warnings_from(
        explicit_network,
        cli_rpc_url,
        cli_network_passphrase,
        std::env::var("STELLAR_RPC_URL").ok().as_deref(),
        std::env::var("STELLAR_NETWORK_PASSPHRASE").ok().as_deref(),
    )
}

/// [`network_override_warnings`] with the env var values passed in, so it can
/// be tested without touching the process environment.
fn network_override_warnings_from(
    explicit_network: Option<Network>,
    cli_rpc_url: Option<&str>,
    cli_network_passphrase: Option<&str>,
    env_rpc_url: Option<&str>,
    env_network_passphrase: Option<&str>,
) -> Vec<String> {
    let mut warnings = Vec::new();
    let Some(network) = explicit_network else {
        return warnings;
    };
    let Some(preset) = network.preset() else {
        return warnings;
    };
    let name = format!("{network:?}").to_lowercase();

    let env_rpc_url = env_rpc_url.filter(|v| *v != preset.rpc_url);
    let env_network_passphrase =
        env_network_passphrase.filter(|v| *v != preset.network_passphrase);

    if let (None, Some(url)) = (cli_rpc_url, env_rpc_url) {
        warnings.push(format!(
            "Warning: --network {name} preset RPC URL is overridden by STELLAR_RPC_URL={url}"
        ));
    }
    if let (None, Some(passphrase)) = (cli_network_passphrase, env_network_passphrase) {
        warnings.push(format!(
            "Warning: --network {name} preset passphrase is overridden by \
             STELLAR_NETWORK_PASSPHRASE={passphrase:?}"
        ));
    }

    let url_overridden = cli_rpc_url.is_some() || env_rpc_url.is_some();
    let passphrase_overridden =
        cli_network_passphrase.is_some() || env_network_passphrase.is_some();
    if url_overridden != passphrase_overridden {
        let (overridden, kept) = if url_overridden {
            ("RPC URL", "passphrase")
        } else {
            ("passphrase", "RPC URL")
        };
        warnings.push(format!(
            "Warning: only the {overridden} is overridden; it is paired with the \
             --network {name} preset {kept}"
        ));
    }

    warnings
}

impl Config {
    /// Load configuration from environment variables with network detection.
    ///
    /// Loads network preference from `TRELLIS_NETWORK` env var (defaults to Testnet),
    /// then resolves configuration using that network as the base. All other config
    /// values are loaded from env vars with Testnet defaults.
    pub fn from_env() -> Result<Self, String> {
        let network_str = std::env::var("TRELLIS_NETWORK")
            .unwrap_or_else(|_| "testnet".to_string())
            .to_lowercase();

        let network = match network_str.as_str() {
            "mainnet" => Network::Mainnet,
            "futurenet" => Network::Futurenet,
            "custom" => Network::Custom,
            _ => Network::Testnet,
        };

        Self::resolve(network, None, None, None, None)
        Self::resolve(network, None, None, None)
    }

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
    ///
    /// With `--as <role>` the role's own variables are used instead
    /// (`TRELLIS_<ROLE>_KEY_FILE` > `TRELLIS_<ROLE>_KEY`), and `Err` is
    /// returned if neither is set. There is deliberately no fallback to
    /// `TRELLIS_SOURCE_KEY`: silently signing as a different identity than
    /// the one asked for is worse than failing. `--as` and
    /// `--source-key-file` conflict at the clap level.
    pub fn resolve(
        network: Network,
        cli_rpc_url: Option<String>,
        cli_network_passphrase: Option<String>,
        cli_source_key_file: Option<String>,
        role: Option<Role>,
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

        let contract_id = contract_id_value(std::env::var("TRELLIS_CONTRACT_ID").ok());

        let (source_key, source_key_origin) = match role {
            None => resolve_source_key_value(
                cli_source_key_file,
                KeyVar::new("TRELLIS_SOURCE_KEY_FILE"),
                KeyVar::new("TRELLIS_SOURCE_KEY"),
            )?
            .unwrap_or_else(|| ("UNSET_SOURCE_KEY".to_string(), "unset")),
            Some(role) => resolve_source_key_value(
                None,
                KeyVar::new(role.key_file_var()),
                KeyVar::new(role.key_var()),
            )?
            .ok_or_else(|| {
                format!(
                    "Error: --as {} requires {} (or {}) to be set, e.g. in .env",
                    role.name(),
                    role.key_var(),
                    role.key_file_var()
                )
            })?,
        // Source key priority: --source-key-file CLI flag >
        // TRELLIS_SOURCE_KEY_FILE env var > TRELLIS_SOURCE_KEY env var.
        // Reading from a file keeps raw `S…` seeds out of argv and out of
        // the exported-env-var namespace where they leak into
        // `/proc/<pid>/environ` (#240).
        let source_key = if let Some(path) = cli_source_key_file {
            read_source_key_file(&path)?
        } else if let Ok(path) = std::env::var("TRELLIS_SOURCE_KEY_FILE") {
            read_source_key_file(&path)?
        } else {
            std::env::var("TRELLIS_SOURCE_KEY")
                .unwrap_or_else(|_| "UNSET_SOURCE_KEY".to_string())
        };

        Ok(Config {
            rpc_url,
            network_passphrase,
            contract_id,
            source_key,
            source_key_origin,
        })
    }

    /// Validate that all required env vars are set to real values.
    ///
    /// Returns `Err` listing the names of every missing variable. Call this
    /// at startup before dispatching any command so users see a clear error
    /// instead of a cryptic RPC failure deep in the pipeline.
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if self.contract_id == "UNSET_CONTRACT_ID" {
            errors.push("TRELLIS_CONTRACT_ID".to_string());
        } else if let Err(e) = validate_contract_id(&self.contract_id) {
            errors.push(e);
        }

        if self.source_key == "UNSET_SOURCE_KEY" {
            errors.push("TRELLIS_SOURCE_KEY".to_string());
        }

        if let Err(e) = validate_rpc_url(&self.rpc_url) {
            errors.push(e);
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// The source key in a form that is safe to print.
    ///
    /// A value that looks like a raw secret seed (`S…`, or anything 56+ chars
    /// long, which also covers a lowercase or otherwise malformed seed) is
    /// reduced to its first character plus `...***`. Shorter values are
    /// `stellar keys` identity names such as `alice`, which are not secret
    /// and are exactly what a user debugging "which identity am I signing
    /// as?" needs to see, so they are shown in full. Returns `None` when no
    /// key is configured.
    pub fn masked_source_key(&self) -> Option<String> {
        if self.source_key == "UNSET_SOURCE_KEY" {
            return None;
        }
        let key = self.source_key.as_str();
        if is_secret_seed(&key.to_ascii_uppercase()) || key.chars().count() >= STRKEY_LEN {
            let first = key.chars().next().unwrap_or('*');
            return Some(format!("{first}...***"));
        }
        Some(key.to_string())
    }

    /// Try to resolve the source key from keystore, then fall back to env var.
    pub fn resolve_source_key(&self) -> Result<String, String> {
        use crate::keystore::Keystore;
        let keystore = Keystore::new();
        keystore
            .resolve_source_key(&self.source_key)
            .map_err(|e| format!("Failed to resolve source key: {}", e))
    }
}

/// The contract ID from a raw `TRELLIS_CONTRACT_ID` value, trimmed. A missing,
/// blank or whitespace-only value becomes the `UNSET_CONTRACT_ID` sentinel
/// that `validate()` reports by name.
fn contract_id_value(raw: Option<String>) -> String {
    raw.map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .unwrap_or_else(|| "UNSET_CONTRACT_ID".to_string())
}

/// An env var name paired with its value, if set.
struct KeyVar {
    name: &'static str,
    value: Option<String>,
}

impl KeyVar {
    fn new(name: &'static str) -> Self {
        KeyVar {
            name,
            value: std::env::var(name).ok(),
        }
    }
}

/// Pick the source key from, in priority order, the `--source-key-file` flag,
/// the key-file env var (`TRELLIS_SOURCE_KEY_FILE` or a role's
/// `TRELLIS_<ROLE>_KEY_FILE`), or the plaintext key env var.
///
/// A configured file always wins over the plaintext variable, even when both
/// are set. In that case a note goes to stderr, because a stale exported
/// `TRELLIS_SOURCE_KEY` left behind after switching to a key file is easy to
/// miss. A file that is configured but unreadable or empty is a hard error
/// rather than a silent fallback to the env var: signing with a different
/// identity than the one the user pointed at is worse than failing.
///
/// Returns the key together with the name of the flag / env var it came
/// from, or `Ok(None)` when no source is configured at all, so the caller can
/// keep the `UNSET_SOURCE_KEY` sentinel that `validate()` reports.
fn resolve_source_key_value(
    cli_file: Option<String>,
    env_file: KeyVar,
    env_key: KeyVar,
) -> Result<Option<(String, &'static str)>, String> {
    let file = cli_file
        .map(|p| (p, "--source-key-file"))
        .or_else(|| env_file.value.map(|p| (p, env_file.name)))
        .filter(|(p, _)| !p.trim().is_empty());

    match file {
        Some((path, origin)) => {
            if env_key.value.is_some() {
                eprintln!(
                    "Note: both {origin} and {key} are set; using the key file \
                     and ignoring {key}.",
                    key = env_key.name
                );
            }
            read_source_key_file(&path, origin).map(|k| Some((k, origin)))
        }
        // A blank or whitespace-only value is treated as unset, so `validate()`
        // names the missing variable instead of `--source ""` reaching `stellar`.
        None => Ok(env_key
            .value
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty())
            .map(|k| (k, env_key.name))),
    }
/// Response body from a Soroban RPC `getNetwork` call.
///
/// Only the fields we care about are declared; `serde` ignores the rest.
#[derive(Debug, Deserialize)]
pub struct GetNetworkResponse {
    pub passphrase: String,
}

/// Compare the passphrase returned by the configured RPC endpoint's
/// `getNetwork` method against `config.network_passphrase`.
///
/// A mismatch means the CLI is pointed at one network while signing for
/// another — e.g. `--rpc-url` aimed at mainnet but `--network-passphrase`
/// still set to testnet. Without this check the discrepancy only surfaces
/// much later as a confusing downstream failure, so we surface it here with
/// both values named explicitly.
///
/// Returns `Ok(())` when the passphrases match, or `Err` with a specific
/// message naming both values when they differ.
pub fn verify_network_passphrase(
    config: &Config,
    remote_passphrase: &str,
) -> Result<(), String> {
    if remote_passphrase == config.network_passphrase {
        return Ok(());
    }
    Err(format!(
        "Network passphrase mismatch: the RPC endpoint at {} reports passphrase \
         {:?}, but the CLI is configured with {:?}. Point --rpc-url and \
         --network-passphrase at the same network.",
        config.rpc_url, remote_passphrase, config.network_passphrase
    ))
}

/// Fetch the network passphrase from the configured RPC endpoint and verify
/// it matches `config.network_passphrase`.
///
/// Issues a JSON-RPC 2.0 `getNetwork` request to `config.rpc_url` and compares
/// the returned `passphrase` against the configured value. Intended to be
/// called as an early check (e.g. from `validate_environment`) so a
/// misconfigured endpoint/passphrase pair fails fast with a clear message
/// instead of a confusing downstream error.
pub async fn verify_network_passphrase_against_rpc(config: &Config) -> Result<(), String> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getNetwork",
        "params": {},
    });

    let response = reqwest::Client::new()
        .post(&config.rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to reach RPC endpoint {}: {e}", config.rpc_url))?;

    let parsed: GetNetworkResponse = response
        .json()
        .await
        .map_err(|e| format!("Malformed getNetwork response from {}: {e}", config.rpc_url))?;

    verify_network_passphrase(config, &parsed.passphrase)
}

/// Read a source key from `path`, trimming surrounding whitespace / newlines.
///
/// Keeping the secret in a file (ideally mode `0600`) instead of an argv
/// entry or exported env var is the mitigation for #240 / #486: file contents
/// are never visible in `ps` output or `/proc/<pid>/environ`. `origin` names
/// the flag or env var the path came from, for error messages.
fn read_source_key_file(path: &str, origin: &str) -> Result<String, String> {
    warn_if_key_file_too_open(path);

    let raw = std::fs::read_to_string(path)
        .map_err(|e| format!("Error: cannot read {origin} {path:?}: {e}"))?;
    let key = raw.trim().to_string();
    if key.is_empty() {
        return Err(format!("Error: {origin} {path:?} is empty"));
    }
    Ok(key)
}

/// Print a warning when the key file is readable or writable by the group or
/// by other users. The key is still used: refusing outright (as `ssh` does)
/// would break shared CI runners whose secret mounts are `0644`, so this is a
/// warning, not an error.
#[cfg(unix)]
fn warn_if_key_file_too_open(path: &str) {
    if let Some(mode) = key_file_mode(path) {
        if mode & 0o077 != 0 {
            eprintln!(
                "Warning: source key file {path:?} has permissions {:o}, so other users \
                 may be able to read it. Restrict it with: chmod 600 {path:?}",
                mode & 0o777
            );
        }
    }
}

/// Windows ACLs don't map onto Unix mode bits, so no check is made there.
#[cfg(not(unix))]
fn warn_if_key_file_too_open(_path: &str) {}

/// Unix permission bits of `path`, or `None` if it can't be stat'ed (the
/// subsequent read reports that error properly).
#[cfg(unix)]
fn key_file_mode(path: &str) -> Option<u32> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path).ok().map(|m| m.permissions().mode())
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

    /// A syntactically valid contract address (`C` + 55 base32 chars).
    fn valid_contract_id() -> String {
        format!("C{}", "A".repeat(STRKEY_LEN - 1))
    }

    fn config_with(contract_id: &str, source_key: &str) -> Config {
        Config {
            rpc_url: "https://soroban-testnet.stellar.org".to_string(),
            network_passphrase: "Test SDF Network ; September 2015".to_string(),
            contract_id: contract_id.to_string(),
            source_key: source_key.to_string(),
            source_key_origin: "TRELLIS_SOURCE_KEY",
        }
    }

    #[test]
    fn validate_passes_when_all_vars_set() {
        let cfg = config_with(&valid_contract_id(), "SABC123");
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
        let cfg = config_with(&valid_contract_id(), "UNSET_SOURCE_KEY");
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

    // --- validate_contract_id (#236) ---

    #[test]
    fn contract_id_accepts_well_formed_address() {
        assert!(validate_contract_id(&valid_contract_id()).is_ok());
        assert!(
            validate_contract_id("CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ")
                .is_ok()
        );
    }

    #[test]
    fn contract_id_rejects_missing_c_prefix() {
        let err = validate_contract_id(&format!("G{}", "A".repeat(STRKEY_LEN - 1))).unwrap_err();
        assert!(err.contains("starting with 'C'"), "got: {err}");
    }

    #[test]
    fn contract_id_rejects_wrong_length() {
        assert!(validate_contract_id("CABC123").is_err());
        assert!(validate_contract_id(&format!("C{}", "A".repeat(STRKEY_LEN))).is_err());
    }

    #[test]
    fn contract_id_rejects_non_base32_chars() {
        // lowercase, `1`, `0`, `8`, `9` and punctuation are outside the alphabet
        let bad = format!("C{}1", "A".repeat(STRKEY_LEN - 2));
        assert!(validate_contract_id(&bad).is_err());
        let spaced = format!("C{} x{}", "A".repeat(26), "A".repeat(STRKEY_LEN - 29));
        assert!(validate_contract_id(&spaced).is_err());
    }

    #[test]
    fn validate_reports_malformed_contract_id() {
        let cfg = config_with("CBOGUS", "SABC123");
        let err = cfg.validate().unwrap_err();
        assert_eq!(err.len(), 1);
        assert!(err[0].contains("TRELLIS_CONTRACT_ID"), "got: {:?}", err);
    }

    // --- source key resolution (#486) ---

    fn file_var(value: Option<String>) -> KeyVar {
        KeyVar {
            name: "TRELLIS_SOURCE_KEY_FILE",
            value,
        }
    }

    fn key_var(value: Option<&str>) -> KeyVar {
        KeyVar {
            name: "TRELLIS_SOURCE_KEY",
            value: value.map(str::to_string),
        }
    }

    /// Write `contents` to a fresh file under the system temp dir with the
    /// given Unix mode and return its path.
    fn temp_key_file(name: &str, contents: &str, #[allow(unused)] mode: u32) -> String {
        let path = std::env::temp_dir().join(format!(
            "trellis-key-{}-{name}",
            std::process::id()
        ));
        std::fs::write(&path, contents).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(mode)).unwrap();
        }
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn source_key_falls_back_to_env_var_when_no_file() {
        let key =
            resolve_source_key_value(None, file_var(None), key_var(Some("alice"))).unwrap();
        assert_eq!(key, Some(("alice".to_string(), "TRELLIS_SOURCE_KEY")));
    }

    #[test]
    fn source_key_none_when_nothing_configured() {
        let key = resolve_source_key_value(None, file_var(None), key_var(None)).unwrap();
        assert_eq!(key, None);
    }

    #[test]
    fn debug_output_redacts_secret_seed() {
        let seed = format!("S{}", "A".repeat(STRKEY_LEN - 1));
        let printed = format!("{:?}", config_with(&valid_contract_id(), &seed));
        assert!(!printed.contains(&seed), "{printed}");
        assert!(printed.contains("source_key: \"<redacted>\""), "{printed}");

        let printed = format!("{:?}", config_with(&valid_contract_id(), "alice"));
        assert!(printed.contains("source_key: \"alice\""), "{printed}");
    }

    #[test]
    fn redact_url_strips_userinfo_and_masks_query_values() {
        assert_eq!(
            redact_url("https://user:pw@rpc.example/?apikey=abc"),
            "https://rpc.example/?apikey=***"
        );
        assert_eq!(
            redact_url("https://rpc.example/rpc?key=abc&token"),
            "https://rpc.example/rpc?key=***&***"
        );
    }

    #[test]
    fn redact_url_leaves_plain_and_unparseable_urls_unchanged() {
        for raw in ["https://soroban-testnet.stellar.org", "not a url"] {
            assert_eq!(redact_url(raw), raw);
        }
    }

    #[test]
    fn blank_source_key_env_var_is_treated_as_unset() {
        for blank in ["", "   "] {
            let key =
                resolve_source_key_value(None, file_var(None), key_var(Some(blank))).unwrap();
            assert_eq!(key, None, "{blank:?}");
        }
        // `resolve` maps `None` to the sentinel, which `validate` names.
        let err = config_with(&valid_contract_id(), "UNSET_SOURCE_KEY")
            .validate()
            .unwrap_err();
        assert!(err.contains(&"TRELLIS_SOURCE_KEY".to_string()));
    }

    #[test]
    fn source_key_env_var_is_trimmed() {
        let key =
            resolve_source_key_value(None, file_var(None), key_var(Some("  alice "))).unwrap();
        assert_eq!(key, Some(("alice".to_string(), "TRELLIS_SOURCE_KEY")));
    }

    #[test]
    fn contract_id_is_trimmed_and_blank_is_unset() {
        let id = valid_contract_id();
        let trimmed = contract_id_value(Some(format!("  {id} \n")));
        assert_eq!(trimmed, id);
        assert!(config_with(&trimmed, "alice").validate().is_ok());
        for blank in [None, Some(String::new()), Some("   ".to_string())] {
            assert_eq!(contract_id_value(blank), "UNSET_CONTRACT_ID");
        }
    }

    #[test]
    fn source_key_read_from_env_file_and_trimmed() {
        let path = temp_key_file("env-file", "  bob\n", 0o600);
        let key =
            resolve_source_key_value(None, file_var(Some(path.clone())), key_var(None)).unwrap();
        assert_eq!(key, Some(("bob".to_string(), "TRELLIS_SOURCE_KEY_FILE")));
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn source_key_file_takes_precedence_over_plaintext_env_var() {
        let path = temp_key_file("over-env", "from-file", 0o600);
        let key = resolve_source_key_value(
            None,
            file_var(Some(path.clone())),
            key_var(Some("from-env")),
        )
        .unwrap();
        assert_eq!(key, Some(("from-file".to_string(), "TRELLIS_SOURCE_KEY_FILE")));
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn cli_key_file_takes_precedence_over_env_key_file() {
        let cli = temp_key_file("cli", "from-cli-file", 0o600);
        let env = temp_key_file("env", "from-env-file", 0o600);
        let key = resolve_source_key_value(
            Some(cli.clone()),
            file_var(Some(env.clone())),
            key_var(Some("from-env")),
        )
        .unwrap();
        assert_eq!(key, Some(("from-cli-file".to_string(), "--source-key-file")));
        std::fs::remove_file(cli).ok();
        std::fs::remove_file(env).ok();
    }

    #[test]
    fn missing_key_file_is_error_not_silent_env_fallback() {
        let err = resolve_source_key_value(
            Some("/nonexistent/trellis/key".to_string()),
            file_var(None),
            key_var(Some("from-env")),
        )
        .unwrap_err();
        assert!(err.contains("--source-key-file"), "got: {err}");
    }

    #[test]
    fn empty_key_file_is_error() {
        let path = temp_key_file("empty", "  \n", 0o600);
        let err = resolve_source_key_value(None, file_var(Some(path.clone())), key_var(None))
            .unwrap_err();
        assert!(err.contains("TRELLIS_SOURCE_KEY_FILE") && err.contains("empty"), "got: {err}");
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn blank_key_file_path_is_treated_as_unset() {
        let key = resolve_source_key_value(
            None,
            file_var(Some("   ".to_string())),
            key_var(Some("alice")),
        )
        .unwrap();
        assert_eq!(key, Some(("alice".to_string(), "TRELLIS_SOURCE_KEY")));
    }

    #[cfg(unix)]
    #[test]
    fn world_readable_key_file_is_still_used() {
        let path = temp_key_file("open", "carol", 0o644);
        assert_eq!(key_file_mode(&path).unwrap() & 0o077, 0o044);
        let key =
            resolve_source_key_value(None, file_var(Some(path.clone())), key_var(None)).unwrap();
        assert_eq!(key.map(|(k, _)| k).as_deref(), Some("carol"));
        std::fs::remove_file(path).ok();
    }

    // --- --as role profiles (#483) ---

    #[test]
    fn role_env_var_names_are_distinct_per_role() {
        let roles = [Role::Payer, Role::Payee, Role::Resolver];
        let mut names: Vec<&str> = roles
            .iter()
            .flat_map(|r| [r.key_var(), r.key_file_var()])
            .collect();
        names.push("TRELLIS_SOURCE_KEY");
        names.push("TRELLIS_SOURCE_KEY_FILE");
        let mut deduped = names.clone();
        deduped.sort();
        deduped.dedup();
        assert_eq!(names.len(), deduped.len(), "{names:?}");
    }

    #[test]
    fn role_key_file_takes_precedence_over_role_key() {
        let path = temp_key_file("role", "payer-from-file", 0o600);
        let key = resolve_source_key_value(
            None,
            KeyVar {
                name: Role::Payer.key_file_var(),
                value: Some(path.clone()),
            },
            KeyVar {
                name: Role::Payer.key_var(),
                value: Some("payer-from-env".to_string()),
            },
        )
        .unwrap();
        assert_eq!(key, Some(("payer-from-file".to_string(), "TRELLIS_PAYER_KEY_FILE")));
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn role_key_file_error_names_the_role_variable() {
        let err = resolve_source_key_value(
            None,
            KeyVar {
                name: Role::Resolver.key_file_var(),
                value: Some("/nonexistent/trellis/resolver.key".to_string()),
            },
            KeyVar {
                name: Role::Resolver.key_var(),
                value: None,
            },
        )
        .unwrap_err();
        assert!(err.contains("TRELLIS_RESOLVER_KEY_FILE"), "got: {err}");
    }

    // --- masked_source_key (#485) ---

    #[test]
    fn masked_source_key_hides_secret_seed() {
        let seed = format!("S{}", "B".repeat(STRKEY_LEN - 1));
        let cfg = config_with(&valid_contract_id(), &seed);
        let masked = cfg.masked_source_key().unwrap();
        assert_eq!(masked, "S...***");
        assert!(!masked.contains(&seed[1..8]));
    }

    #[test]
    fn masked_source_key_hides_lowercase_or_overlong_seed() {
        let lower = format!("s{}", "b".repeat(STRKEY_LEN - 1));
        let cfg = config_with(&valid_contract_id(), &lower);
        assert_eq!(cfg.masked_source_key().unwrap(), "s...***");

        let long = "X".repeat(STRKEY_LEN + 4);
        let cfg = config_with(&valid_contract_id(), &long);
        assert_eq!(cfg.masked_source_key().unwrap(), "X...***");
    }

    #[test]
    fn masked_source_key_shows_identity_name() {
        let cfg = config_with(&valid_contract_id(), "trellis-payer");
        assert_eq!(cfg.masked_source_key().as_deref(), Some("trellis-payer"));
    }

    #[test]
    fn masked_source_key_none_when_unset() {
        let cfg = config_with(&valid_contract_id(), "UNSET_SOURCE_KEY");
        assert_eq!(cfg.masked_source_key(), None);
    // --- check_rpc_transport (#156) ---

    #[test]
    fn rpc_transport_allows_https_and_loopback_http() {
        assert_eq!(
            check_rpc_transport("https://rpc.example.com", false),
            Ok(None)
        );
        assert_eq!(
            check_rpc_transport("http://localhost:8000", false),
            Ok(None)
        );
        assert_eq!(
            check_rpc_transport("http://127.0.0.1:8000/rpc", false),
            Ok(None)
        );
        assert_eq!(check_rpc_transport("http://[::1]:8000", false), Ok(None));
    }

    #[test]
    fn rpc_transport_refuses_remote_http_unless_unsafe() {
        assert!(check_rpc_transport("http://rpc.example.com", false).is_err());
        let warning = check_rpc_transport("http://rpc.example.com", true)
            .expect("--unsafe-rpc allows it")
            .expect("with a warning");
        assert!(warning.contains("--unsafe-rpc"), "got: {warning}");
    }

    // --- validate_rpc_url (#237) ---

    #[test]
    fn rpc_url_accepts_https_and_http_localhost() {
        assert!(validate_rpc_url("https://soroban-testnet.stellar.org").is_ok());
        assert!(validate_rpc_url("http://localhost:8000/soroban/rpc").is_ok());
        assert!(validate_rpc_url("http://127.0.0.1:8000").is_ok());
        assert!(validate_rpc_url("http://[::1]:8000").is_ok());
    }

    #[test]
    fn rpc_url_accepts_remote_http_shape_only() {
        // Cleartext policy lives in `check_rpc_transport`, not here (#636).
        assert!(validate_rpc_url("http://rpc.example.com").is_ok());
    }

    #[test]
    fn rpc_url_rejects_scheme_typo() {
        let err = validate_rpc_url("httsp://soroban-testnet.stellar.org").unwrap_err();
        assert!(
            err.contains("scheme") || err.contains("valid URL"),
            "got: {err}"
        );
    }

    #[test]
    fn rpc_url_rejects_missing_scheme() {
        assert!(validate_rpc_url("soroban-testnet.stellar.org").is_err());
    }

    #[test]
    fn rpc_url_rejects_non_http_scheme() {
        assert!(validate_rpc_url("ftp://example.com").is_err());
        assert!(validate_rpc_url("ws://example.com").is_err());
        assert!(validate_rpc_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn rpc_url_rejects_empty_host() {
        assert!(validate_rpc_url("https://").is_err());
        assert!(validate_rpc_url("http://").is_err());
    }

    #[test]
    fn validate_accepts_ipv6_loopback_rpc_url() {
        let mut cfg = config_with(&valid_contract_id(), "SABC123");
        cfg.rpc_url = "http://[::1]:8000".to_string();
        assert!(cfg.validate().is_ok(), "got: {:?}", cfg.validate().unwrap_err());
    }

    #[test]
    fn validate_accepts_remote_http_rpc_url() {
        // `--unsafe-rpc` must be able to reach `check_rpc_transport` (#636).
        let mut cfg = config_with(&valid_contract_id(), "SABC123");
        cfg.rpc_url = "http://rpc.example.com".to_string();
        assert!(cfg.validate().is_ok(), "got: {:?}", cfg.validate().unwrap_err());
    }

    #[test]
    fn validate_reports_malformed_rpc_url() {
        let mut cfg = config_with(&valid_contract_id(), "SABC123");
        cfg.rpc_url = "not-a-url".to_string();
        let err = cfg.validate().unwrap_err();
        assert_eq!(err.len(), 1);
        assert!(err[0].contains("RPC URL"), "got: {:?}", err);
    }

    // --- verify_network_passphrase (#<issue>) ---

    #[test]
    fn network_passphrase_matches_configured_value() {
        let cfg = config_with(&valid_contract_id(), "SABC123");
        assert!(
            verify_network_passphrase(&cfg, "Test SDF Network ; September 2015").is_ok()
        );
    }

    #[test]
    fn network_passphrase_mismatch_names_both_values() {
        let cfg = config_with(&valid_contract_id(), "SABC123");
        let err = verify_network_passphrase(
            &cfg,
            "Public Global Stellar Network ; September 2015",
        )
        .unwrap_err();
        assert!(
            err.contains("Public Global Stellar Network ; September 2015"),
            "error should name the remote passphrase, got: {err}"
        );
        assert!(
            err.contains("Test SDF Network ; September 2015"),
            "error should name the configured passphrase, got: {err}"
        );
        assert!(
            err.contains(&cfg.rpc_url),
            "error should name the RPC endpoint, got: {err}"
        );
    }

    #[test]
    fn network_passphrase_mismatch_is_not_triggered_by_matching_custom_value() {
        let mut cfg = config_with(&valid_contract_id(), "SABC123");
        cfg.network_passphrase = "Standalone Network ; February 2017".to_string();
        assert!(
            verify_network_passphrase(&cfg, "Standalone Network ; February 2017").is_ok()
        );
    }

    // --- Config::resolve, read_source_key_file, is_secret_seed (#653) ---

    /// Serialises every test that mutates process env vars, since the test
    /// harness runs tests on parallel threads that share one environment.
    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    /// Every env var `Config::resolve` reads.
    const RESOLVE_VARS: [&str; 5] = [
        "STELLAR_RPC_URL",
        "STELLAR_NETWORK_PASSPHRASE",
        "TRELLIS_CONTRACT_ID",
        "TRELLIS_SOURCE_KEY",
        "TRELLIS_SOURCE_KEY_FILE",
    ];

    /// Unset every resolve input. Call only while holding `ENV_LOCK`.
    fn clear_resolve_vars() {
        for var in RESOLVE_VARS {
            std::env::remove_var(var);
        }
    }

    /// Take the env lock and start from a clean slate for every resolve input.
    fn clean_env() -> std::sync::MutexGuard<'static, ()> {
        let guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_resolve_vars();
        guard
    }

    #[test]
    fn resolve_uses_preset_for_each_named_network() {
        let _env = clean_env();
        for (network, url, passphrase) in [
            (
                Network::Testnet,
                "https://soroban-testnet.stellar.org",
                "Test SDF Network ; September 2015",
            ),
            (
                Network::Mainnet,
                "https://mainnet.sorobanrpc.com",
                "Public Global Stellar Network ; September 2015",
            ),
            (
                Network::Futurenet,
                "https://rpc-futurenet.stellar.org",
                "Test SDF Future Network ; October 2022",
            ),
        ] {
            let cfg = Config::resolve(network, None, None, None, None).unwrap();
            assert_eq!(cfg.rpc_url, url, "{network:?}");
            assert_eq!(cfg.network_passphrase, passphrase, "{network:?}");
        }
        assert!(Network::Custom.preset().is_none());
    }

    #[test]
    fn resolve_env_vars_override_preset() {
        let _env = clean_env();
        std::env::set_var("STELLAR_RPC_URL", "https://env.example.com");
        std::env::set_var("STELLAR_NETWORK_PASSPHRASE", "Env Passphrase");
        let cfg = Config::resolve(Network::Testnet, None, None, None, None).unwrap();
        assert_eq!(cfg.rpc_url, "https://env.example.com");
        assert_eq!(cfg.network_passphrase, "Env Passphrase");
        clear_resolve_vars();
    }

    #[test]
    fn resolve_cli_flags_override_env_vars() {
        let _env = clean_env();
        std::env::set_var("STELLAR_RPC_URL", "https://env.example.com");
        std::env::set_var("STELLAR_NETWORK_PASSPHRASE", "Env Passphrase");
        let cfg = Config::resolve(
            Network::Testnet,
            Some("https://cli.example.com".to_string()),
            Some("Cli Passphrase".to_string()),
            None,
            None,
        )
        .unwrap();
        assert_eq!(cfg.rpc_url, "https://cli.example.com");
        assert_eq!(cfg.network_passphrase, "Cli Passphrase");
        clear_resolve_vars();
    }

    #[test]
    fn resolve_custom_without_rpc_url_is_error() {
        let _env = clean_env();
        let err = Config::resolve(
            Network::Custom,
            None,
            Some("Custom Passphrase".to_string()),
            None,
            None,
        )
        .unwrap_err();
        assert_eq!(
            err,
            "Error: --network=custom requires --rpc-url (or STELLAR_RPC_URL)"
        );
    }

    #[test]
    fn resolve_custom_without_passphrase_is_error() {
        let _env = clean_env();
        let err = Config::resolve(
            Network::Custom,
            Some("https://custom.example.com".to_string()),
            None,
            None,
            None,
        )
        .unwrap_err();
        assert_eq!(
            err,
            "Error: --network=custom requires --network-passphrase (or STELLAR_NETWORK_PASSPHRASE)"
        );
    }

    #[test]
    fn resolve_source_key_cli_file_beats_env_file_and_env_key() {
        let _env = clean_env();
        let cli = temp_key_file("resolve-cli", "from-cli-file", 0o600);
        let env = temp_key_file("resolve-env", "from-env-file", 0o600);
        std::env::set_var("TRELLIS_SOURCE_KEY_FILE", &env);
        std::env::set_var("TRELLIS_SOURCE_KEY", "from-env-key");
        let cfg = Config::resolve(Network::Testnet, None, None, Some(cli.clone()), None).unwrap();
        assert_eq!(cfg.source_key, "from-cli-file");
        assert_eq!(cfg.source_key_origin, "--source-key-file");
        clear_resolve_vars();
        std::fs::remove_file(cli).ok();
        std::fs::remove_file(env).ok();
    }

    #[test]
    fn resolve_source_key_env_file_beats_env_key() {
        let _env = clean_env();
        let env = temp_key_file("resolve-env-only", "from-env-file", 0o600);
        std::env::set_var("TRELLIS_SOURCE_KEY_FILE", &env);
        std::env::set_var("TRELLIS_SOURCE_KEY", "from-env-key");
        let cfg = Config::resolve(Network::Testnet, None, None, None, None).unwrap();
        assert_eq!(cfg.source_key, "from-env-file");
        assert_eq!(cfg.source_key_origin, "TRELLIS_SOURCE_KEY_FILE");
        clear_resolve_vars();
        std::fs::remove_file(env).ok();
    }

    #[test]
    fn resolve_source_key_falls_back_to_env_key_then_unset() {
        let _env = clean_env();
        std::env::set_var("TRELLIS_SOURCE_KEY", "from-env-key");
        let cfg = Config::resolve(Network::Testnet, None, None, None, None).unwrap();
        assert_eq!(cfg.source_key, "from-env-key");
        assert_eq!(cfg.source_key_origin, "TRELLIS_SOURCE_KEY");

        std::env::remove_var("TRELLIS_SOURCE_KEY");
        let cfg = Config::resolve(Network::Testnet, None, None, None, None).unwrap();
        assert_eq!(cfg.source_key, "UNSET_SOURCE_KEY");
        assert_eq!(cfg.source_key_origin, "unset");
    }

    #[test]
    fn read_source_key_file_trims_whitespace() {
        let path = temp_key_file("read-trim", "\n  SKEY  \r\n", 0o600);
        assert_eq!(read_source_key_file(&path, "--source-key-file").unwrap(), "SKEY");
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn read_source_key_file_reports_missing_and_empty_files() {
        let missing = read_source_key_file("/nonexistent/trellis/key", "--source-key-file")
            .unwrap_err();
        assert!(
            missing.starts_with("Error: cannot read --source-key-file"),
            "got: {missing}"
        );

        let path = temp_key_file("read-empty", " \n\t\n", 0o600);
        let empty = read_source_key_file(&path, "TRELLIS_SOURCE_KEY_FILE").unwrap_err();
        assert_eq!(empty, format!("Error: TRELLIS_SOURCE_KEY_FILE {path:?} is empty"));
        std::fs::remove_file(path).ok();
    }

    #[test]
    fn is_secret_seed_edge_cases() {
        let seed = format!("S{}", "A".repeat(STRKEY_LEN - 1));
        assert!(is_secret_seed(&seed));
        // Wrong prefix, wrong length, lowercase and non-alphanumeric all fail.
        assert!(!is_secret_seed(&format!("G{}", "A".repeat(STRKEY_LEN - 1))));
        assert!(!is_secret_seed(&seed[..STRKEY_LEN - 1]));
        assert!(!is_secret_seed(&format!("{seed}A")));
        assert!(!is_secret_seed(&seed.to_lowercase()));
        assert!(!is_secret_seed(&format!("S{}-", "A".repeat(STRKEY_LEN - 2))));
        assert!(!is_secret_seed("alice"));
        assert!(!is_secret_seed(""));
    }

    // --- explicit --network overridden by env vars (#654) ---

    const TESTNET_URL: &str = "https://soroban-testnet.stellar.org";
    const TESTNET_PASSPHRASE: &str = "Test SDF Network ; September 2015";

    #[test]
    fn explicit_mainnet_with_env_rpc_url_warns() {
        let warnings = network_override_warnings_from(
            Some(Network::Mainnet),
            None,
            None,
            Some(TESTNET_URL),
            None,
        );
        assert!(
            warnings.iter().any(|w| w.contains("--network mainnet")
                && w.contains("STELLAR_RPC_URL")
                && w.contains(TESTNET_URL)),
            "got: {warnings:?}"
        );
        assert!(
            warnings.iter().any(|w| w.contains("only the RPC URL is overridden")),
            "got: {warnings:?}"
        );
    }

    #[test]
    fn explicit_mainnet_with_both_env_vars_names_each() {
        let warnings = network_override_warnings_from(
            Some(Network::Mainnet),
            None,
            None,
            Some(TESTNET_URL),
            Some(TESTNET_PASSPHRASE),
        );
        assert_eq!(warnings.len(), 2, "got: {warnings:?}");
        assert!(warnings[0].contains("STELLAR_RPC_URL"));
        assert!(warnings[1].contains("STELLAR_NETWORK_PASSPHRASE"));
    }

    #[test]
    fn default_network_stays_silent() {
        let warnings =
            network_override_warnings_from(None, None, None, Some(TESTNET_URL), None);
        assert!(warnings.is_empty(), "got: {warnings:?}");
    }

    #[test]
    fn env_values_matching_the_preset_are_silent() {
        let warnings = network_override_warnings_from(
            Some(Network::Testnet),
            None,
            None,
            Some(TESTNET_URL),
            Some(TESTNET_PASSPHRASE),
        );
        assert!(warnings.is_empty(), "got: {warnings:?}");
    }

    #[test]
    fn explicit_cli_flag_overriding_only_url_warns_about_the_pairing() {
        let warnings = network_override_warnings_from(
            Some(Network::Mainnet),
            Some("https://rpc.example.com"),
            None,
            None,
            None,
        );
        assert_eq!(
            warnings,
            vec![
                "Warning: only the RPC URL is overridden; it is paired with the \
                 --network mainnet preset passphrase"
                    .to_string()
            ]
        );
    }
}
