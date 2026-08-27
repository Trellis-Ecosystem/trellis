use soroban_sdk::{symbol_short, Address, BytesN, Env, String};

// ---------------------------------------------------------------------------
// Event emitters — the only place that calls env.events().publish().
//
// Convention:
//   • topics: a tuple of (Symbol, agreement_id) — enables indexed filtering
//     by event name and/or agreement ID from off-chain indexers.
//   • data:   a tuple of typed Soroban primitives (Symbol, i128, Address, u32,
//     bool, Option<String>) so off-chain consumers can decode payloads without
//     importing the contract WASM types.
//
// Symbol length limits:
//   • `symbol_short!` accepts ≤9 characters and stores the symbol as an
//     inline 64-bit integer — no heap allocation on the guest WASM side.
//   • `symbol_short!` is used where the prefixed name is exactly 9 chars or
//     fewer.  Any name that exceeds 9 chars uses `Symbol::new(env, "…")`,
//     which stores the string in the host's symbol table.
//
// Prefixed topic names and their lengths:
//   1. "trellis_cr"  (10 chars) → Symbol::new   — agreement_created
//   2. "trls_lckd"  ( 9 chars) → symbol_short! — funds_locked       (abbreviated to stay ≤9)
//   3. "trls_sbmt"  ( 9 chars) → symbol_short! — work_submitted     (abbreviated)
//   4. "trls_rlsd"  ( 9 chars) → symbol_short! — funds_released     (abbreviated)
//   5. "trls_dspt"  ( 9 chars) → symbol_short! — dispute_raised     (abbreviated)
//   6. "trls_rslv"  ( 9 chars) → symbol_short! — milestone_resolved (abbreviated)
//   7. "trls_cncl"  ( 9 chars) → symbol_short! — milestone_cancelled(abbreviated)
//
// All abbreviations follow the pattern: drop the vowels from the root word
// while keeping enough consonants to be unambiguous.  They are intentional
// and documented here so indexers can rely on them as stable identifiers.
//
// Event schema (topics → data):
//   1. "created"   → (payer: Address, payee: Address)
//   2. "locked"    → (milestone_id: u32, amount: i128)
//   3. "submitted" → (milestone_id: u32, proof_uri: Option<String>)
//   4. "released"  → (milestone_id: u32, amount: i128)
//   5. "disputed"  → (milestone_id: u32, caller: Address)
//   6. "resolved"  → (milestone_id: u32, refunded_to_payer: bool)
//   7. "cancelled" → (milestone_id: u32, payer: Address, cancelled_by: Address)
//
// "trls_rslv" and "trls_cncl" are deliberately distinct: an indexer must be
// able to tell an arbitrated dispute outcome apart from a payer walking back a
// milestone that was never funded, since only the former involves token
// movement and resolver involvement.
// ---------------------------------------------------------------------------

/// Emitted when a new escrow agreement is created.
///
/// Topics: `("trls_crte", agreement_id)`
/// Data:   `(payer, payee)`
pub fn agreement_created(env: &Env, agreement_id: BytesN<32>, payer: Address, payee: Address) {
    env.events().publish(
        (symbol_short!("trls_crte"), agreement_id.clone()),
        (payer, payee),
    );
}

/// Emitted when funds for a specific milestone are locked into the escrow.
///
/// Topics: `("trls_lckd", agreement_id)`
/// Data:   `(milestone_id, amount)`
pub fn funds_locked(env: &Env, agreement_id: BytesN<32>, milestone_id: u32, amount: i128) {
    env.events().publish(
        (symbol_short!("trls_lckd"), agreement_id.clone()),
        (milestone_id, amount),
    );
}

/// Emitted when a payee submits proof of work for a milestone.
///
/// Topics: `("trls_sbmt", agreement_id)`
/// Data:   `(milestone_id, proof_uri)`
///
/// `proof_uri` is `None` when the milestone was submitted without a proof
/// link; it is never an empty string.
pub fn work_submitted(
    env: &Env,
    agreement_id: BytesN<32>,
    milestone_id: u32,
    proof_uri: Option<String>,
) {
    env.events().publish(
        (symbol_short!("trls_sbmt"), agreement_id.clone()),
        (milestone_id, proof_uri),
    );
}

/// Emitted when a payer approves a milestone and funds are released to the payee.
///
/// Topics: `("trls_rlsd", agreement_id)`
/// Data:   `(milestone_id, amount)`
pub fn funds_released(env: &Env, agreement_id: BytesN<32>, milestone_id: u32, amount: i128) {
    env.events().publish(
        (symbol_short!("trls_rlsd"), agreement_id.clone()),
        (milestone_id, amount),
    );
}

/// Emitted when either party raises a dispute on a funded or work-submitted milestone.
///
/// Topics: `("disputed", agreement_id)`
/// Data:   `(milestone_id, caller)`
///
/// `caller` is the party (payer or payee) that triggered the dispute, provided
/// as a typed `Address` so indexers can identify the initiating party without
/// importing contract WASM types.
pub fn dispute_raised(env: &Env, agreement_id: BytesN<32>, milestone_id: u32, caller: Address) {
    env.events().publish(
        (symbol_short!("trls_dspt"), agreement_id.clone()),
        (milestone_id, caller),
    );
}

/// Emitted when the dispute resolver settles a disputed milestone.
///
/// This event means an arbitration ruling was made and tokens moved. It is
/// **not** emitted for cancellations — see [`milestone_cancelled`].
///
/// Topics: `("trls_rslv", agreement_id)`
/// Data:   `(milestone_id, refunded_to_payer)`
///
/// `refunded_to_payer = true`  → locked funds returned to payer.
/// `refunded_to_payer = false` → locked funds awarded to payee.
pub fn milestone_resolved(
    env: &Env,
    agreement_id: BytesN<32>,
    milestone_id: u32,
    refunded_to_payer: bool,
) {
    env.events().publish(
        (symbol_short!("trls_rslv"), agreement_id.clone()),
        (milestone_id, refunded_to_payer),
    );
}

/// Emitted when a payer cancels a milestone that was never funded.
///
/// No tokens move: the milestone simply leaves the `Pending` state without
/// ever having been escrowed. Indexers should treat this as a withdrawal of a
/// proposal, not as a dispute outcome.
///
/// Topics: `("trls_cncl", agreement_id)`
/// Data:   `(milestone_id, payer, cancelled_by)`
///
/// `payer` is the agreement's payer; `cancelled_by` is the address that
/// authorised the cancellation. These are the same address today (only the
/// payer may cancel) but are reported separately so the event stays
/// self-describing if delegated cancellation is ever added.
pub fn milestone_cancelled(
    env: &Env,
    agreement_id: BytesN<32>,
    milestone_id: u32,
    payer: Address,
    cancelled_by: Address,
) {
    env.events().publish(
        (symbol_short!("trls_cncl"), agreement_id.clone()),
        (milestone_id, payer, cancelled_by),
    );
}
