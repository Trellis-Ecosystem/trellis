use soroban_sdk::{contracttype, Address, BytesN, Env, Map, Vec};

use crate::errors::TrellisError;
use crate::types::{Agreement, AgreementHeader, Milestone};

// ---------------------------------------------------------------------------
// DataKey — typed namespace for every ledger entry written by this contract.
// Using an enum prevents accidental key collisions as the contract grows.
// ---------------------------------------------------------------------------
#[contracttype]
pub enum DataKey {
    /// Persistent storage key for an agreement's *header*: every field of the
    /// agreement except its milestone vector.
    /// The inner BytesN<32> is the globally unique agreement ID.
    Agreement(BytesN<32>),
    /// Persistent storage key for one milestone of an agreement, addressed by
    /// the agreement ID and the milestone's index within it.
    ///
    /// Splitting the milestones out of the header (#401) is what keeps a
    /// single-milestone state transition an O(1) ledger write: `lock_funds`,
    /// `submit_work` and friends rewrite only this entry instead of
    /// re-serialising the whole `Vec<Milestone>` back to storage.
    Milestone(BytesN<32>, u32),
    /// Persistent storage key for one milestone's deadline, addressed by the
    /// agreement ID and the milestone's index within it.
    ///
    /// Deadlines live beside the agreement rather than as a field on
    /// [`crate::types::Milestone`] so the `init` argument layout and the
    /// `get_agreement` / `get_milestone` return types stay unchanged for
    /// existing callers.
    ///
    /// Storing one entry per milestone (#757) keeps `lock_funds`,
    /// `batch_lock_funds` and `expire_milestone` O(1): they read or write only
    /// the deadline they care about instead of deserialising a whole-agreement
    /// `Map<u32, u64>` whose cost grew with milestone count.
    Deadline(BytesN<32>, u32),
    /// Persistent storage key for the index of agreement IDs in which the
    /// given address is the *payer*.
    ///
    /// The value is a `Vec<BytesN<32>>` appended to on every `init`. It backs
    /// the read-only `get_agreements_for` entrypoint so callers can enumerate
    /// "all agreements where I am payer" from contract state alone, instead of
    /// relying on client-side `localStorage` history (#458).
    ///
    /// # Storage growth
    /// One entry per distinct payer address, whose size grows linearly with
    /// the number of agreements that address has created. An address involved
    /// in many agreements therefore pays rent proportional to that count, and
    /// every `init` rewrites the whole vector (an O(n) write for that payer).
    /// This is acceptable for the expected per-address agreement counts; if a
    /// single address ever accumulates thousands of agreements, a paged or
    /// bucketed index would be needed. The entry's TTL is renewed on every
    /// append, so an active payer's index never expires.
    PayerAgreements(Address),
    /// Persistent storage key for the index of agreement IDs in which the
    /// given address is the *payee*. Mirrors [`DataKey::PayerAgreements`],
    /// including its storage-growth characteristics.
    PayeeAgreements(Address),
    /// Persistent storage key for the contract admin address, set once at
    /// deployment. Gates privileged entrypoints such as the WASM upgrade
    /// (#459). Absent until an admin is configured.
    Admin,
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
///
/// `pub` so `test_storage` can age entries past the threshold and assert that a
/// single-milestone transition only re-extends the one entry it wrote (#401).
pub const LEDGER_THRESHOLD: u32 = DAY_IN_LEDGERS * 15;

// ---------------------------------------------------------------------------
// Storage helpers — the only place in the codebase that touches
// env.storage().persistent().  All other modules go through these functions.
// ---------------------------------------------------------------------------

/// Reset the TTL of the single ledger entry `key` to [`LEDGER_BUMP`] ledgers.
///
/// A no-op while the entry still has more than [`LEDGER_THRESHOLD`] ledgers
/// left, and a no-op if the entry does not exist.
fn bump_ttl(env: &Env, key: &DataKey) {
    // extend_ttl traps on a missing entry, so guard the lookup.
    if !env.storage().persistent().has(key) {
        return;
    }

    env.storage()
        .persistent()
        .extend_ttl(key, LEDGER_THRESHOLD, LEDGER_BUMP);
}

/// Reset the TTL of every entry backing agreement `id` — the header plus each
/// of its `milestone_count` milestone and deadline entries.
///
/// Only [`extend_agreement_ttl`] needs this: an agreement is now several ledger
/// entries, so a keeper renewing an idle agreement has to keep the milestone
/// and deadline entries alive too, not just the header. Every other path bumps
/// only the entry it actually touched.
fn bump_agreement_ttls(env: &Env, id: &BytesN<32>, milestone_count: u32) {
    bump_ttl(env, &DataKey::Agreement(id.clone()));

    for milestone_id in 0..milestone_count {
        bump_ttl(env, &DataKey::Milestone(id.clone(), milestone_id));
        bump_ttl(env, &DataKey::Deadline(id.clone(), milestone_id));
    }
}

/// Persist a freshly-initialised [`Agreement`] as one header entry plus one
/// entry per milestone.
///
/// Only `init` calls this. Every later state transition goes through
/// [`write_milestone`], which touches exactly one entry — see the
/// `DataKey::Milestone` docs and issue #401 for why that matters for fees.
///
/// Writing alone does **not** renew an entry's TTL, so each write is followed
/// by a [`bump_ttl`] call. Routing both the header and every milestone through
/// helpers that bump guarantees no state-mutating entrypoint can leave an
/// entry to expire.
///
/// # Errors
/// Returns [`TrellisError::InvalidMilestone`] if the agreement's milestone
/// vector is internally inconsistent — an index it claims to have is missing.
pub fn write_agreement(
    env: &Env,
    id: &BytesN<32>,
    agreement: &Agreement,
) -> Result<(), TrellisError> {
    let header = AgreementHeader {
        agreement_id: agreement.agreement_id.clone(),
        payer: agreement.payer.clone(),
        payee: agreement.payee.clone(),
        token: agreement.token.clone(),
        dispute_resolver: agreement.dispute_resolver.clone(),
        total_amount: agreement.total_amount,
        milestone_count: agreement.milestones.len(),
        released_amounts: agreement.released_amounts.clone(),
        open_milestones: agreement.milestones.len(),
        refunded_milestones: 0,
    };

    let header_key = DataKey::Agreement(id.clone());
    env.storage().persistent().set(&header_key, &header);
    bump_ttl(env, &header_key);

    for milestone_id in 0..header.milestone_count {
        let milestone = agreement
            .milestones
            .get(milestone_id)
            .ok_or(TrellisError::InvalidMilestone)?;

        write_milestone(env, id, milestone_id, &milestone)?;
    }

    Ok(())
}

/// Persist one milestone of agreement `id` and renew its TTL.
///
/// This is the single write path for milestone state, so every transition
/// (`lock_funds`, `submit_work`, `approve_milestone`, …) rewrites exactly one
/// ledger entry regardless of how many milestones the agreement has.
pub fn write_milestone(
    env: &Env,
    id: &BytesN<32>,
    milestone_id: u32,
    milestone: &Milestone,
) -> Result<(), TrellisError> {
    let key = DataKey::Milestone(id.clone(), milestone_id);
    env.storage().persistent().set(&key, milestone);
    bump_ttl(env, &key);
    Ok(())
}

/// Read one milestone of agreement `id`.
///
/// Returns [`TrellisError::MilestoneNotFound`] if the entry is absent.
pub fn read_milestone(
    env: &Env,
    id: &BytesN<32>,
    milestone_id: u32,
) -> Result<Milestone, TrellisError> {
    env.storage()
        .persistent()
        .get(&DataKey::Milestone(id.clone(), milestone_id))
        .ok_or(TrellisError::MilestoneNotFound)
}

/// Persist the deadline for one milestone of agreement `id` and renew its TTL.
///
/// Storing one entry per milestone (#757) keeps this an O(1) write: callers
/// never load or rewrite the deadlines of other milestones.
pub fn write_deadline(env: &Env, id: &BytesN<32>, milestone_id: u32, deadline: u64) {
    let key = DataKey::Deadline(id.clone(), milestone_id);
    env.storage().persistent().set(&key, &deadline);
    bump_ttl(env, &key);
}

/// Read the deadline for one milestone of agreement `id`.
///
/// Returns `None` if no deadline was recorded for that milestone.
pub fn read_deadline(env: &Env, id: &BytesN<32>, milestone_id: u32) -> Option<u64> {
    env.storage()
        .persistent()
        .get(&DataKey::Deadline(id.clone(), milestone_id))
}
