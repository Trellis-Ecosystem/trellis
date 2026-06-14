use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

// ---------------------------------------------------------------------------
// EscrowStatus — lifecycle state machine for an escrow agreement / milestone
// ---------------------------------------------------------------------------
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    /// Agreement created but no funds deposited yet.
    Pending,
    /// Payer has deposited the agreed token amount into the contract.
    Funded,
    /// Payee has submitted proof of work and is awaiting payer approval.
    WorkSubmitted,
    /// Payer approved the milestone; funds released to payee.
    Completed,
    /// Either party raised a dispute; awaiting resolver arbitration.
    Disputed,
    /// Funds returned to payer (cancelled or ruled in payer's favour).
    Refunded,
}

// ---------------------------------------------------------------------------
// Milestone — a single deliverable within an Agreement
// ---------------------------------------------------------------------------
#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    /// Ordinal identifier for this milestone within the agreement (0-indexed).
    pub id: u32,
    /// Token amount (in the smallest denomination) locked for this milestone.
    pub amount: i128,
    /// Current lifecycle state of this milestone.
    pub status: EscrowStatus,
    /// Optional URI linking to delivery proof (e.g. GitHub PR, Figma file).
    /// Stored as an empty String when no proof has been submitted yet.
    pub proof_uri: String,
}

// ---------------------------------------------------------------------------
// Agreement — top-level escrow record stored on-chain
// ---------------------------------------------------------------------------
#[contracttype]
#[derive(Clone, Debug)]
pub struct Agreement {
    /// Globally unique identifier for this agreement (32-byte hash).
    pub agreement_id: BytesN<32>,
    /// The party funding the escrow (client / buyer).
    pub payer: Address,
    /// The party delivering work and receiving funds (contractor / seller).
    pub payee: Address,
    /// SAC or custom token contract used for payments.
    pub token: Address,
    /// Ordered list of milestones that make up this agreement.
    pub milestones: Vec<Milestone>,
    /// Trusted third-party address authorised to resolve disputes.
    pub dispute_resolver: Address,
}
