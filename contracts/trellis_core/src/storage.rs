use soroban_sdk::{contracttype, BytesN, Env};

use crate::errors::TrellisError;
use crate::types::Agreement;

// ---------------------------------------------------------------------------
// DataKey — typed namespace for every ledger entry written by this contract.
// Using an enum prevents accidental key collisions as the contract grows.
// ---------------------------------------------------------------------------
#[contracttype]
pub enum DataKey {
    /// Persistent storage key for a single escrow agreement.
    /// The inner BytesN<32> is the globally unique agreement ID.
    Agreement(BytesN<32>),
}

// ---------------------------------------------------------------------------
// Storage helpers — the only place in the codebase that touches
// env.storage().persistent().  All other modules go through these functions.
// ---------------------------------------------------------------------------

/// Persist an [`Agreement`] to ledger storage under its unique ID.
///
/// Uses [`soroban_sdk::storage::Persistent`] so the entry survives
/// ledger archival as long as the rent is maintained.
pub fn write_agreement(env: &Env, id: &BytesN<32>, agreement: &Agreement) {
    env.storage()
        .persistent()
        .set(&DataKey::Agreement(id.clone()), agreement);
}

/// Retrieve an [`Agreement`] from ledger storage by its unique ID.
///
/// # Errors
/// Returns [`TrellisError::AgreementNotFound`] (code 3) when no record exists
/// for `id`. Callers may also use [`has_agreement`] to pre-check existence.
pub fn read_agreement(env: &Env, id: &BytesN<32>) -> Result<Agreement, TrellisError> {
    env.storage()
        .persistent()
        .get(&DataKey::Agreement(id.clone()))
        .ok_or(TrellisError::AgreementNotFound)
}

/// Return `true` if an [`Agreement`] with the given `id` exists in storage.
pub fn has_agreement(env: &Env, id: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Agreement(id.clone()))
}
