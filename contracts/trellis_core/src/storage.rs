use soroban_sdk::{contracttype, BytesN, Env, Map};

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
    /// Persistent storage key for an agreement's optional per-milestone
    /// deadlines (`Map<milestone_id, ledger timestamp>`).
    ///
    /// Kept in its own entry rather than as a field on `Milestone` so the
    /// `Milestone` / `Agreement` XDR layout — and therefore every existing
    /// `init` caller and every already-stored agreement — is unchanged. Only
    /// written once a deadline is actually set; agreements without deadlines
    /// never pay for it.
    Deadlines(BytesN<32>),
}

// ---------------------------------------------------------------------------
// TTL (rent) parameters
//
// Every persistent ledger entry on Soroban carries a finite time-to-live.
// When the TTL runs out the entry is archived and, without a restore, the data
// is effectively lost.  The TTL does *not* renew itself on write — the
// contract must explicitly call `extend_ttl`.
// ---------------------------------------------------------------------------

/// Ledgers closed in roughly one day, at Stellar's ~5-second close cadence
/// (86_400 / 5 = 17_280).  Used only to express the constants below in
/// human-readable units.
const DAY_IN_LEDGERS: u32 = 17_280;

/// Target lifetime for an agreement entry: ~30 days from the most recent
/// extension.  Every extension resets the entry's TTL to this value.
///
/// This sits well inside Soroban's maximum persistent entry TTL, so the
/// `extend_ttl` call can never be rejected for overshooting the cap.
pub const LEDGER_BUMP: u32 = DAY_IN_LEDGERS * 30;

/// Only pay for an extension once the remaining TTL drops below ~15 days.
///
/// Above this threshold `extend_ttl` is a no-op, so back-to-back writes in the
/// same period do not repeatedly charge rent.  The 15-day gap between the
/// threshold and [`LEDGER_BUMP`] is the window a keeper service has to call
/// `extend_agreement_ttl` on an otherwise idle agreement before it expires.
const LEDGER_THRESHOLD: u32 = DAY_IN_LEDGERS * 15;

// ---------------------------------------------------------------------------
// Storage helpers — the only place in the codebase that touches
// env.storage().persistent().  All other modules go through these functions.
// ---------------------------------------------------------------------------

/// Reset the TTL of the agreement entry for `id` to [`LEDGER_BUMP`] ledgers.
///
/// A no-op while the entry still has more than [`LEDGER_THRESHOLD`] ledgers
/// left, and a no-op if the entry does not exist.
///
/// The agreement's deadline entry (if any) is bumped alongside it, so a
/// deadline can never be archived while the agreement it guards is live.
fn bump_ttl(env: &Env, id: &BytesN<32>) {
    for key in [
        DataKey::Agreement(id.clone()),
        DataKey::Deadlines(id.clone()),
    ] {
        // extend_ttl traps on a missing entry, so guard the lookup.
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_BUMP);
        }
    }
}

/// Persist an [`Agreement`] to ledger storage under its unique ID.
///
/// Uses [`soroban_sdk::storage::Persistent`] so the entry survives
/// ledger archival as long as the rent is maintained.
///
/// Writing alone does **not** renew an entry's TTL, so every write is followed
/// by a [`bump_ttl`] call.  Because this is the only function in the codebase
/// that writes an agreement, routing the bump through here guarantees no
/// state-mutating entrypoint can leave an entry to expire.
pub fn write_agreement(env: &Env, id: &BytesN<32>, agreement: &Agreement) {
    env.storage()
        .persistent()
        .set(&DataKey::Agreement(id.clone()), agreement);

    bump_ttl(env, id);
}

/// Renew the TTL of an existing agreement entry without modifying it.
///
/// Backs the public `extend_agreement_ttl` entrypoint so keeper services can
/// keep long-running agreements alive between state transitions.
///
/// # Errors
/// Returns [`TrellisError::AgreementNotFound`] if no entry exists for `id`,
/// so a keeper pointed at a bad ID fails loudly instead of silently no-opping.
pub fn extend_agreement_ttl(env: &Env, id: &BytesN<32>) -> Result<(), TrellisError> {
    if !has_agreement(env, id) {
        return Err(TrellisError::AgreementNotFound);
    }

    bump_ttl(env, id);

    Ok(())
}

/// Retrieve an [`Agreement`] from ledger storage by its unique ID.
///
/// Reading also refreshes the entry's TTL. An agreement that is merely being
/// watched — a long dispute window, a milestone awaiting delivery — is still
/// in active use and must not be archived out from under its parties.
///
/// # Errors
/// Returns [`TrellisError::AgreementNotFound`] (code 3) when no record exists
/// for `id`. Callers may also use [`has_agreement`] to pre-check existence.
pub fn read_agreement(env: &Env, id: &BytesN<32>) -> Result<Agreement, TrellisError> {
    let key = DataKey::Agreement(id.clone());
    let agreement: Agreement = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(TrellisError::AgreementNotFound)?;

    // Reaching here proves the entry exists, so the bump is safe.
    bump_ttl(env, id);

    Ok(agreement)
}

/// Return `true` if an [`Agreement`] with the given `id` exists in storage.
///
/// Deliberately does not bump the TTL: this is a pure existence probe used by
/// `init` to reject duplicate IDs, and it must not charge rent for asking
/// about an agreement that may not exist.
pub fn has_agreement(env: &Env, id: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Agreement(id.clone()))
}

/// Return the deadline (ledger timestamp, seconds) set for `milestone_id`, or
/// `None` if the milestone has no deadline.
pub fn read_deadline(env: &Env, id: &BytesN<32>, milestone_id: u32) -> Option<u64> {
    env.storage()
        .persistent()
        .get::<_, Map<u32, u64>>(&DataKey::Deadlines(id.clone()))
        .and_then(|deadlines| deadlines.get(milestone_id))
}

/// Set (or replace) the deadline for `milestone_id`.
///
/// Callers must already have verified the agreement exists; the TTL bump
/// below then renews both the agreement and the deadline entry together.
pub fn write_deadline(env: &Env, id: &BytesN<32>, milestone_id: u32, deadline: u64) {
    let key = DataKey::Deadlines(id.clone());
    let mut deadlines: Map<u32, u64> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Map::new(env));
    deadlines.set(milestone_id, deadline);
    env.storage().persistent().set(&key, &deadlines);

    bump_ttl(env, id);
}
