#![no_std]

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Vec};

use errors::TrellisError;
use types::{Agreement, EscrowStatus, Milestone};

// ---------------------------------------------------------------------------
// Contract struct
// ---------------------------------------------------------------------------

#[contract]
pub struct TrellisContract;

// ---------------------------------------------------------------------------
// Contract entrypoints
// ---------------------------------------------------------------------------

#[contractimpl]
impl TrellisContract {
    /// Create a new escrow agreement.
    ///
    /// The payer authorises this call.  Each milestone in `milestones` is
    /// expected to arrive with `status = EscrowStatus::Pending`; the contract
    /// does not override per-milestone status on init so the caller controls
    /// the initial state of each deliverable.
    ///
    /// # Errors
    /// - [`TrellisError::AlreadyInitialized`] if an agreement with this ID
    ///   already exists in storage.
    pub fn init(
        env: Env,
        agreement_id: BytesN<32>,
        payer: Address,
        payee: Address,
        token: Address,
        milestones: Vec<Milestone>,
        dispute_resolver: Address,
    ) -> Result<(), TrellisError> {
        payer.require_auth();

        if storage::has_agreement(&env, &agreement_id) {
            return Err(TrellisError::AlreadyInitialized);
        }

        let agreement = Agreement {
            agreement_id: agreement_id.clone(),
            payer: payer.clone(),
            payee: payee.clone(),
            token,
            milestones,
            dispute_resolver,
        };

        storage::write_agreement(&env, &agreement_id, &agreement);
        events::agreement_created(&env, agreement_id, payer, payee);

        Ok(())
    }

    /// Lock funds for a single milestone into the contract.
    ///
    /// The payer authorises this call and must have pre-approved the token
    /// transfer allowance on the token contract.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::InvalidMilestone`] – `milestone_id` out of range.
    /// - [`TrellisError::InvalidStateTransition`] – milestone not `Pending`.
    pub fn lock_funds(
        env: Env,
        agreement_id: BytesN<32>,
        milestone_id: u32,
    ) -> Result<(), TrellisError> {
        let mut agreement = storage::read_agreement(&env, &agreement_id)?;
        agreement.payer.require_auth();

        // Read milestone by positional index — clone to avoid borrow overlap
        // with the subsequent `.set()` call on the same Vec.
        let mut milestone = agreement
            .milestones
            .get(milestone_id)
            .ok_or(TrellisError::InvalidMilestone)?;

        if milestone.status != EscrowStatus::Pending {
            return Err(TrellisError::InvalidStateTransition);
        }

        // Transfer tokens from payer → this contract.
        token::Client::new(&env, &agreement.token).transfer(
            &agreement.payer,
            &env.current_contract_address(),
            &milestone.amount,
        );

        // Mutate milestone and write back at the same index.
        milestone.status = EscrowStatus::Funded;
        agreement.milestones.set(milestone_id, milestone.clone());
        storage::write_agreement(&env, &agreement_id, &agreement);

        events::funds_locked(&env, agreement_id, milestone_id, milestone.amount);

        Ok(())
    }

    /// Submit proof of work for a funded milestone.
    ///
    /// The payee authorises this call.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::InvalidMilestone`] – `milestone_id` out of range.
    /// - [`TrellisError::InvalidStateTransition`] – milestone not `Funded`.
    pub fn submit_work(
        env: Env,
        agreement_id: BytesN<32>,
        milestone_id: u32,
        proof_uri: String,
    ) -> Result<(), TrellisError> {
        let mut agreement = storage::read_agreement(&env, &agreement_id)?;
        agreement.payee.require_auth();

        let mut milestone = agreement
            .milestones
            .get(milestone_id)
            .ok_or(TrellisError::InvalidMilestone)?;

        if milestone.status != EscrowStatus::Funded {
            return Err(TrellisError::InvalidStateTransition);
        }

        // proof_uri is a plain String (not Option<String>); empty string is
        // the "no proof" sentinel defined in types.rs.
        milestone.status = EscrowStatus::WorkSubmitted;
        milestone.proof_uri = proof_uri.clone();
        agreement.milestones.set(milestone_id, milestone);
        storage::write_agreement(&env, &agreement_id, &agreement);

        events::work_submitted(&env, agreement_id, milestone_id, proof_uri);

        Ok(())
    }

    /// Approve submitted work and release funds to the payee.
    ///
    /// The payer authorises this call.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::InvalidMilestone`] – `milestone_id` out of range.
    /// - [`TrellisError::InvalidStateTransition`] – milestone not `WorkSubmitted`.
    pub fn approve_and_release(
        env: Env,
        agreement_id: BytesN<32>,
        milestone_id: u32,
    ) -> Result<(), TrellisError> {
        let mut agreement = storage::read_agreement(&env, &agreement_id)?;
        agreement.payer.require_auth();

        let mut milestone = agreement
            .milestones
            .get(milestone_id)
            .ok_or(TrellisError::InvalidMilestone)?;

        if milestone.status != EscrowStatus::WorkSubmitted {
            return Err(TrellisError::InvalidStateTransition);
        }

        // Transfer tokens from this contract → payee.
        token::Client::new(&env, &agreement.token).transfer(
            &env.current_contract_address(),
            &agreement.payee,
            &milestone.amount,
        );

        milestone.status = EscrowStatus::Completed;
        agreement.milestones.set(milestone_id, milestone.clone());
        storage::write_agreement(&env, &agreement_id, &agreement);

        events::funds_released(&env, agreement_id, milestone_id, milestone.amount);

        Ok(())
    }

    /// Raise a dispute on a milestone that is currently `Funded` or `WorkSubmitted`.
    ///
    /// Either the payer or the payee may call this — the `caller` arg is
    /// checked against both roles so either party can autonomously trigger
    /// the dispute window.  This prevents a malicious payer from silently
    /// refusing to approve work AND refusing to raise a dispute, which would
    /// permanently lock the freelancer's funds.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::Unauthorized`] – `caller` is neither payer nor payee.
    /// - [`TrellisError::InvalidMilestone`] – `milestone_id` out of range.
    /// - [`TrellisError::InvalidStateTransition`] – milestone has no funds at
    ///   stake (status is not `Funded` or `WorkSubmitted`).
    pub fn raise_dispute(
        env: Env,
        caller: Address,
        agreement_id: BytesN<32>,
        milestone_id: u32,
    ) -> Result<(), TrellisError> {
        let mut agreement = storage::read_agreement(&env, &agreement_id)?;

        // Check the caller is an authorised party before requiring their sig.
        if caller != agreement.payer && caller != agreement.payee {
            return Err(TrellisError::Unauthorized);
        }
        // Require the on-chain signature of whichever party is calling.
        caller.require_auth();

        let mut milestone = agreement
            .milestones
            .get(milestone_id)
            .ok_or(TrellisError::InvalidMilestone)?;

        // Only milestones with funds at stake can be disputed.
        if milestone.status != EscrowStatus::Funded
            && milestone.status != EscrowStatus::WorkSubmitted
        {
            return Err(TrellisError::InvalidStateTransition);
        }

        milestone.status = EscrowStatus::Disputed;
        agreement.milestones.set(milestone_id, milestone);
        storage::write_agreement(&env, &agreement_id, &agreement);

        events::dispute_raised(&env, agreement_id, milestone_id);

        Ok(())
    }

    /// Settle a disputed milestone as the designated `dispute_resolver`.
    ///
    /// Pass `refund_to_payer = true` to return funds to the payer
    /// (ruling against the payee), or `false` to award funds to the payee
    /// (ruling against the payer).
    ///
    /// # Auth
    /// `agreement.dispute_resolver.require_auth()` is the sole enforcement
    /// mechanism — the Soroban host automatically traps if the invoker's
    /// signature does not match the resolver address stored on-chain.
    /// No additional manual check is needed beyond `require_auth()`.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::InvalidMilestone`] – `milestone_id` out of range.
    /// - [`TrellisError::InvalidStateTransition`] – milestone is not `Disputed`.
    pub fn resolve_dispute(
        env: Env,
        agreement_id: BytesN<32>,
        milestone_id: u32,
        refund_to_payer: bool,
    ) -> Result<(), TrellisError> {
        let mut agreement = storage::read_agreement(&env, &agreement_id)?;

        // `require_auth` is the enforcement gate — the host traps if the
        // invoker is not the resolver; no separate NotDisputeResolver check
        // is required on top of this.
        agreement.dispute_resolver.require_auth();

        let mut milestone = agreement
            .milestones
            .get(milestone_id)
            .ok_or(TrellisError::InvalidMilestone)?;

        if milestone.status != EscrowStatus::Disputed {
            return Err(TrellisError::InvalidStateTransition);
        }

        if refund_to_payer {
            // Rule: payer wins — return locked funds to payer.
            token::Client::new(&env, &agreement.token).transfer(
                &env.current_contract_address(),
                &agreement.payer,
                &milestone.amount,
            );
            milestone.status = EscrowStatus::Refunded;
        } else {
            // Rule: payee wins — release locked funds to payee.
            token::Client::new(&env, &agreement.token).transfer(
                &env.current_contract_address(),
                &agreement.payee,
                &milestone.amount,
            );
            milestone.status = EscrowStatus::Completed;
        }

        agreement.milestones.set(milestone_id, milestone);
        storage::write_agreement(&env, &agreement_id, &agreement);

        events::milestone_resolved(&env, agreement_id, milestone_id, refund_to_payer);

        Ok(())
    }

    /// Cancel a milestone that was never funded (status = `Pending`).
    ///
    /// Only the payer may withdraw a milestone proposal that has not yet had
    /// funds locked against it.  If any funds were ever locked the payer must
    /// go through the dispute flow instead.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::InvalidMilestone`] – `milestone_id` out of range.
    /// - [`TrellisError::NoFundsToRefund`] – milestone is not `Pending`
    ///   (i.e. funds exist or the milestone is already resolved).
    pub fn cancel_unfunded_milestone(
        env: Env,
        agreement_id: BytesN<32>,
        milestone_id: u32,
    ) -> Result<(), TrellisError> {
        let mut agreement = storage::read_agreement(&env, &agreement_id)?;
        agreement.payer.require_auth();

        let mut milestone = agreement
            .milestones
            .get(milestone_id)
            .ok_or(TrellisError::InvalidMilestone)?;

        if milestone.status != EscrowStatus::Pending {
            // Funds exist or milestone already resolved — use dispute flow.
            return Err(TrellisError::NoFundsToRefund);
        }

        // Mark the milestone closed with no token movement required.
        milestone.status = EscrowStatus::Refunded;
        agreement.milestones.set(milestone_id, milestone);
        storage::write_agreement(&env, &agreement_id, &agreement);

        // Re-use milestone_resolved with refunded_to_payer=true — semantically
        // correct (the milestone is being returned to payer's side) and avoids
        // introducing a separate event type for a structurally identical outcome.
        events::milestone_resolved(&env, agreement_id, milestone_id, true);

        Ok(())
    }
}
