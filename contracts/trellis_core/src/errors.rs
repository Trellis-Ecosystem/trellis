use soroban_sdk::contracterror;

/// Canonical error type for the Trellis Protocol contract.
///
/// `#[contracterror]` serialises each variant's `u32` discriminant into the
/// XDR `ScError` envelope returned to the invoker, making error codes part of
/// the public on-chain ABI.
///
/// # Stability rule
/// Discriminant values are **permanent**.  Never renumber an existing variant;
/// only append new ones at the end of each group.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum TrellisError {
    /// The contract or agreement has already been initialised.
    /// Prevents duplicate `create_agreement` calls for the same ID.
    AlreadyInitialized = 1,

    /// The caller is not permitted to perform this action.
    /// Covers payer-only, payee-only, and resolver-only guards.
    Unauthorized = 2,

    /// No agreement exists in ledger storage for the supplied ID.
    AgreementNotFound = 3,

    /// A milestone is invalid — e.g. zero amount or out-of-range index.
    InvalidMilestone = 4,

    /// The requested operation is illegal given the current `EscrowStatus`.
    /// e.g. attempting to release funds before work has been submitted.
    InvalidStateTransition = 5,

    /// The caller is not the `dispute_resolver` recorded in the agreement.
    /// Note: `require_auth()` on `agreement.dispute_resolver` is the primary
    /// enforcement mechanism; this error is available for explicit checks.
    NotDisputeResolver = 6,

    /// `cancel_unfunded_milestone` was called on a milestone that is not
    /// `Pending` — either already funded (funds exist) or already resolved.
    NoFundsToRefund = 7,
}
