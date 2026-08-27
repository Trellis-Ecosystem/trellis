use soroban_sdk::contracterror;

/// Canonical error type for the Trellis Protocol contract.
///
/// `#[contracterror]` serialises each variant's `u32` discriminant into the
/// XDR `ScError` envelope returned to the invoker, making error codes part of
/// the public on-chain ABI.
///
/// # Stability rule
/// Discriminant values are **permanent** from the first mainnet deployment
/// onwards: never renumber an existing variant, only append new ones at the
/// end.  While the protocol is pre-release (no mainnet deployment yet) the
/// numbering is still being compacted — variant `6` (`NotDisputeResolver`)
/// was removed because no codepath could ever return it, and `NoFundsToRefund`
/// was renumbered from `7` to `6` to close the gap.  SDK consumers pinned to
/// the old numbering must regenerate their bindings.
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

    /// Reserved for a genuine "nothing to refund" economic condition.
    ///
    /// No codepath currently returns this: `cancel_unfunded_milestone` only
    /// ever runs while a milestone still holds no funds, so calling it on a
    /// milestone that has left `Pending` is a state machine violation
    /// ([`TrellisError::InvalidStateTransition`]), not an economic one. Kept
    /// as a distinct variant — rather than removed like the former
    /// `NotDisputeResolver` — in case a future refund-eligible path needs to
    /// distinguish "no funds exist" from "wrong state" at the ABI level.
    NoFundsToRefund = 6,

    /// `init` was called with an empty `milestones` vector. An agreement with
    /// no milestones can never transition through any state, permanently
    /// wasting the storage it occupies.
    EmptyMilestoneSet = 7,

    /// `init` was called with a `dispute_resolver` equal to `payer` or
    /// `payee`. The resolver must be a neutral third party; allowing it to
    /// coincide with either party would let that party unilaterally decide
    /// its own disputes.
    ResolverCannotBeParty = 8,

    /// `init` was called with `payer` equal to `payee`. An agreement where
    /// the same address sends and receives funds is economically nonsensical
    /// and can interfere with agreement IDs and indexers.
    PayerEqualsPayee = 9,

    /// `init` was called with a milestone count exceeding `MAX_MILESTONES`.
    /// Unbounded milestone counts create oversized on-chain vectors that inflate
    /// gas costs and storage bloat.
    MilestoneCountExceeded = 10,
}
