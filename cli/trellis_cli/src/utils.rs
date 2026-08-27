//! Trellis CLI shared utilities.

/// Returns true if `s` is exactly `len` ASCII hex characters (0-9, a-f, A-F).
///
/// Shared by every command-line argument that maps to a Soroban `BytesN<N>`
/// value (e.g. a 32-byte agreement ID is 64 hex characters).
pub fn is_valid_hex(s: &str, len: usize) -> bool {
    s.len() == len && s.chars().all(|c| c.is_ascii_hexdigit())
}

/// Validates a Stellar address format.
///
/// Accepts two formats:
/// - Ed25519 account address: starts with 'G', exactly 56 characters
/// - Contract address: starts with 'C', exactly 56 characters
///
/// Returns `Ok(())` if the address is valid, or `Err(message)` otherwise.
pub fn validate_stellar_address(addr: &str) -> Result<(), String> {
    if addr.len() != 56 {
        return Err(format!(
            "Stellar address must be exactly 56 characters, got {}",
            addr.len()
        ));
    }

    match addr.chars().next() {
        Some('G') => {
            if addr.chars().all(|c| c.is_ascii_alphanumeric()) {
                Ok(())
            } else {
                Err("Ed25519 account address contains invalid characters".to_string())
            }
        }
        Some('C') => {
            if addr.chars().all(|c| c.is_ascii_alphanumeric()) {
                Ok(())
            } else {
                Err("Contract address contains invalid characters".to_string())
            }
        }
        _ => Err(
            "Stellar address must start with 'G' (Ed25519 account) or 'C' (contract)"
                .to_string(),
        ),
    }
}
