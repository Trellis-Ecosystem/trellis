//! Trellis CLI shared utilities.

/// Returns true if `s` is exactly `len` ASCII hex characters (0-9, a-f, A-F).
///
/// Shared by every command-line argument that maps to a Soroban `BytesN<N>`
/// value (e.g. a 32-byte agreement ID is 64 hex characters).
pub fn is_valid_hex(s: &str, len: usize) -> bool {
    s.len() == len && s.chars().all(|c| c.is_ascii_hexdigit())
}
