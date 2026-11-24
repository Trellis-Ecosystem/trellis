use std::io;

/// Account name of the dedicated keyring entry that holds the newline-separated
/// index of identity names stored by `trellis keys add`.
const INDEX_ACCOUNT: &str = "__trellis_index__";

/// Keystore service for managing Stellar secret keys securely.
/// Supports OS keychain (via keyring crate) and encrypted file storage.
pub struct Keystore {
    keyring_service: String,
}

impl Keystore {
    pub fn new() -> Self {
        Keystore {
            keyring_service: "trellis".to_string(),
        }
    }

    /// Construct a keystore backed by an arbitrary keyring service name.
    /// Primarily useful for tests so they do not touch the real OS keychain.
    pub fn with_service(service: impl Into<String>) -> Self {
        Keystore {
            keyring_service: service.into(),
        }
    }

    /// Read the identity index, treating a missing entry as empty.
    fn read_index(&self) -> Vec<String> {
        match keyring::Entry::new(&self.keyring_service, INDEX_ACCOUNT)
            .and_then(|entry| entry.get_password())
        {
            Ok(raw) => raw
                .lines()
                .map(|line| line.trim())
                .filter(|line| !line.is_empty())
                .map(|line| line.to_string())
                .collect(),
            Err(_) => Vec::new(),
        }
    }

    /// Persist the identity index as a newline-separated list.
    fn write_index(&self, identities: &[String]) -> io::Result<()> {
        let entry = keyring::Entry::new(&self.keyring_service, INDEX_ACCOUNT)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        if identities.is_empty() {
            // Best effort: a missing entry is equivalent to an empty index.
            let _ = entry.delete_credential();
            return Ok(());
        }
        entry
            .set_password(&identities.join("\n"))
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))
    }

    /// Retrieve a key from the OS keychain by identity name.
    pub fn get_from_keychain(&self, identity: &str) -> io::Result<String> {
        keyring::Entry::new(&self.keyring_service, identity)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?
            .get_password()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))
    }

    /// Store a key in the OS keychain by identity name, recording the identity
    /// in the index so it can be listed later.
    pub fn store_in_keychain(&self, identity: &str, key: &str) -> io::Result<()> {
        keyring::Entry::new(&self.keyring_service, identity)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?
            .set_password(key)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

        let mut identities = self.read_index();
        if !identities.iter().any(|name| name == identity) {
            identities.push(identity.to_string());
            self.write_index(&identities)?;
        }
        Ok(())
    }

    /// Remove a key from the OS keychain and drop it from the index.
    pub fn remove_from_keychain(&self, identity: &str) -> io::Result<()> {
        keyring::Entry::new(&self.keyring_service, identity)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?
            .delete_credential()
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

        let mut identities = self.read_index();
        let before = identities.len();
        identities.retain(|name| name != identity);
        if identities.len() != before {
            self.write_index(&identities)?;
        }
        Ok(())
    }

    /// List all identities stored in the OS keychain, in insertion order.
    /// The keyring crate has no enumeration API, so identities are tracked in
    /// a dedicated index entry maintained by add/remove.
    pub fn list_keychain_identities(&self) -> Vec<String> {
        self.read_index()
    }

    /// Resolve a key source: keychain, env var, or literal.
    /// Priority: TRELLIS_SOURCE_KEY > keychain lookup > literal seed
    pub fn resolve_source_key(&self, identity_or_key: &str) -> io::Result<String> {
        if let Ok(env_key) = std::env::var("TRELLIS_SOURCE_KEY") {
            if is_raw_seed(&env_key) {
                warn_raw_seed();
            }
            return Ok(env_key);
        }

        if let Ok(keychain_key) = self.get_from_keychain(identity_or_key) {
            return Ok(keychain_key);
        }

        if is_raw_seed(identity_or_key) {
            warn_raw_seed();
            return Ok(identity_or_key.to_string());
        }

        Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("Key not found: {} (not in keychain, env var, or valid Stellar key)", identity_or_key),
        ))
    }
}

/// Whether the value looks like a raw Stellar secret seed (`S...`, 56 chars).
pub fn is_raw_seed(value: &str) -> bool {
    value.starts_with('S') && value.len() == 56
}

/// Print the warning promised by SECURITY.md when a raw seed is detected.
pub fn warn_raw_seed() {
    eprintln!(
        "⚠️  Warning: a plaintext secret key is being used.\n\
            This is insecure and may be logged by shells and system tools.\n\
            Consider storing it in the keystore instead:\n\
              trellis keys add <identity> <secret-key>"
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keystore_creation() {
        let ks = Keystore::new();
        assert_eq!(ks.keyring_service, "trellis");
    }

    #[test]
    fn list_identities_returns_empty_when_index_missing() {
        let ks = Keystore::with_service("trellis-test-empty-index");
        assert_eq!(ks.list_keychain_identities(), vec![] as Vec<String>);
    }

    #[test]
    fn raw_seed_detection() {
        assert!(is_raw_seed(&format!("S{}", "A".repeat(55))));
        assert!(!is_raw_seed("alice"));
        assert!(!is_raw_seed(""));
        assert!(!is_raw_seed(&format!("S{}", "A".repeat(10))));
    }

    #[test]
    fn add_list_remove_round_trip() {
        let ks = Keystore::with_service("trellis-test-round-trip");
        // Start from a clean index.
        let _ = ks.write_index(&[]);

        ks.store_in_keychain("alice", "secret-a").unwrap();
        ks.store_in_keychain("bob", "secret-b").unwrap();
        assert_eq!(
            ks.list_keychain_identities(),
            vec!["alice".to_string(), "bob".to_string()]
        );

        // Storing the same identity twice must not duplicate it.
        ks.store_in_keychain("alice", "secret-a2").unwrap();
        assert_eq!(
            ks.list_keychain_identities(),
            vec!["alice".to_string(), "bob".to_string()]
        );

        ks.remove_from_keychain("alice").unwrap();
        assert_eq!(ks.list_keychain_identities(), vec!["bob".to_string()]);

        ks.remove_from_keychain("bob").unwrap();
        assert_eq!(ks.list_keychain_identities(), vec![] as Vec<String>);
    }
}
