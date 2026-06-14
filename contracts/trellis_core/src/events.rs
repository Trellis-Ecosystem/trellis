use soroban_sdk::{symbol_short, Address, BytesN, Env, String};

// ---------------------------------------------------------------------------
// Event emitters — the only place that calls env.events().publish().
//
// Convention:
//   • topics: a tuple of (Symbol, agreement_id) — enables indexed filtering
//     by event name and/or agreement ID from off-chain indexers.
//   • data:   a tuple of the remaining fields relevant to the event.
//
// The topic Symbol is kept to ≤8 chars so symbol_short! can inline it as a
// 64-bit value, avoiding heap allocation on the guest WASM side.
// ---------------------------------------------------------------------------

/// Emitted when a new escrow agreement is created.
///
/// Topics: `("created", agreement_id)`
/// Data:   `(payer, payee)`
pub fn agreement_created(
    env: &Env,
    agreement_id: BytesN<32>,
    payer: Address,
    payee: Address,
) {
    env.events().publish(
        (symbol_short!("created"), agreement_id.clone()),
        (payer, payee),
    );
}

/// Emitted when funds for a specific milestone are locked into the escrow.
///
/// Topics: `("locked", agreement_id)`
/// Data:   `(milestone_id, amount)`
pub fn funds_locked(
    env: &Env,
    agreement_id: BytesN<32>,
    milestone_id: u32,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("locked"), agreement_id.clone()),
        (milestone_id, amount),
    );
}

/// Emitted when a payee submits proof of work for a milestone.
///
/// Topics: `("submitted", agreement_id)`
/// Data:   `(milestone_id, proof_uri)`
pub fn work_submitted(
    env: &Env,
    agreement_id: BytesN<32>,
    milestone_id: u32,
    proof_uri: String,
) {
    env.events().publish(
        (symbol_short!("submitted"), agreement_id.clone()),
        (milestone_id, proof_uri),
    );
}

/// Emitted when a payer approves a milestone and funds are released to the payee.
///
/// Topics: `("released", agreement_id)`
/// Data:   `(milestone_id, amount)`
pub fn funds_released(
    env: &Env,
    agreement_id: BytesN<32>,
    milestone_id: u32,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("released"), agreement_id.clone()),
        (milestone_id, amount),
    );
}

/// Emitted when either party raises a dispute on a funded or work-submitted milestone.
///
/// Topics: `("disputed", agreement_id)`
/// Data:   `milestone_id`
pub fn dispute_raised(
    env: &Env,
    agreement_id: BytesN<32>,
    milestone_id: u32,
) {
    env.events().publish(
        (symbol_short!("disputed"), agreement_id.clone()),
        milestone_id,
    );
}

/// Emitted when the dispute resolver settles a disputed milestone,
/// or when a payer cancels an unfunded (Pending) milestone.
///
/// Topics: `("resolved", agreement_id)`
/// Data:   `(milestone_id, refunded_to_payer)`
///
/// `refunded_to_payer = true`  → funds returned to payer (or milestone never funded).
/// `refunded_to_payer = false` → funds awarded to payee.
pub fn milestone_resolved(
    env: &Env,
    agreement_id: BytesN<32>,
    milestone_id: u32,
    refunded_to_payer: bool,
) {
    env.events().publish(
        (symbol_short!("resolved"), agreement_id.clone()),
        (milestone_id, refunded_to_payer),
    );
}
