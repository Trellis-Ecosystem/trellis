#![no_std]

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

#[cfg(test)]
mod test_properties;

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
    /// `milestones` must be non-empty and `dispute_resolver` must be distinct
    /// from both `payer` and `payee` — see the `Errors` below.
    ///
    /// # Errors
    /// - [`TrellisError::AlreadyInitialized`] if an agreement with this ID
    ///   already exists in storage.
    /// - [`TrellisError::EmptyMilestoneSet`] if `milestones` is empty — such
    ///   an agreement could never transition through any state.
    /// - [`TrellisError::ResolverCannotBeParty`] if `dispute_resolver` equals
    ///   `payer` or `payee` — the resolver must be a neutral third party.
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

        if milestones.is_empty() {
            return Err(TrellisError::EmptyMilestoneSet);
        }

        if payer == payee {
            return Err(TrellisError::PayerEqualsPayee);
        }

        if dispute_resolver == payer || dispute_resolver == payee {
            return Err(TrellisError::ResolverCannotBeParty);
        }

        let total_amount = validate_milestones(&milestones)?;

        let agreement = Agreement {
            agreement_id: agreement_id.clone(),
            payer: payer.clone(),
            payee: payee.clone(),
            token,
            milestones,
            dispute_resolver,
            total_amount,
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

        // Read the milestone value, mutate it, and write it back to the same
        // slot without cloning the original entry.
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

        // Mutate the milestone value and persist it back to the agreement.
        let amount = milestone.amount;
        milestone.status = EscrowStatus::Funded;
        agreement.milestones.set(milestone_id, milestone);
        storage::write_agreement(&env, &agreement_id, &agreement);

        events::funds_locked(&env, agreement_id, milestone_id, amount);

        Ok(())
    }

    /// Submit proof of work for a funded milestone.
    ///
    /// The payee authorises this call.
    ///
    /// Pass `Some(uri)` to attach delivery proof, or `None` to advance the
    /// milestone to `WorkSubmitted` without one.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::InvalidMilestone`] – `milestone_id` out of range.
    /// - [`TrellisError::InvalidStateTransition`] – milestone not `Funded`.
    pub fn submit_work(
        env: Env,
        agreement_id: BytesN<32>,
        milestone_id: u32,
        proof_uri: Option<String>,
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

        // proof_uri is stored verbatim — `None` is the sole representation of
        // "no proof", so there is no sentinel value to normalise.
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

        let amount = milestone.amount;
        milestone.status = EscrowStatus::Completed;
        agreement.milestones.set(milestone_id, milestone);
        storage::write_agreement(&env, &agreement_id, &agreement);

        events::funds_released(&env, agreement_id, milestone_id, amount);

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

        events::dispute_raised(&env, agreement_id, milestone_id, caller);

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
    /// No additional manual check is needed beyond `require_auth()`, which is
    /// why this entrypoint has no resolver-mismatch error variant: an
    /// unauthorised caller never reaches contract code at all.
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
        // invoker is not the resolver, so a resolver-mismatch error variant
        // would be unreachable and is deliberately absent from TrellisError.
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
    /// # Events
    /// Emits `("cancelled", agreement_id)` — **not** the `("resolved", …)`
    /// event used by [`Self::resolve_dispute`]. No tokens move here, so
    /// off-chain consumers must not treat a cancellation as a dispute ruling.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::InvalidMilestone`] – `milestone_id` out of range.
    /// - [`TrellisError::InvalidStateTransition`] – milestone is not `Pending`
    ///   (i.e. funds exist or the milestone is already resolved). This is a
    ///   state machine violation, not an economic one — use the dispute flow
    ///   instead once a milestone has left `Pending`.
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
            return Err(TrellisError::InvalidStateTransition);
        }

        // Mark the milestone closed with no token movement required.
        milestone.status = EscrowStatus::Refunded;
        agreement.milestones.set(milestone_id, milestone);
        storage::write_agreement(&env, &agreement_id, &agreement);

        // Emit the dedicated cancellation event rather than milestone_resolved:
        // no arbitration happened and no tokens moved, so indexers must be able
        // to tell this apart from a dispute ruling.
        events::milestone_cancelled(
            &env,
            agreement_id,
            milestone_id,
            agreement.payer.clone(),
            agreement.payer,
        );

        Ok(())
    }

    /// Return the full [`Agreement`] struct for the given ID.
    ///
    /// This is a read-only view — no auth is required and no state is modified.
    /// It exists primarily so the CLI `status` command can display the current
    /// agreement state (including per-milestone statuses) via
    /// `stellar contract invoke … -- get_agreement --agreement-id <hex>`.
    ///
    /// # Errors
    /// Returns [`TrellisError::AgreementNotFound`] if no agreement exists for
    /// the given `agreement_id`.
    pub fn get_agreement(env: Env, agreement_id: BytesN<32>) -> Result<Agreement, TrellisError> {
        storage::read_agreement(&env, &agreement_id)
    }

    /// Return the pre-computed total value of an agreement.
    ///
    /// Equivalent to summing `amount` over every milestone in
    /// [`Self::get_agreement`], but avoids the O(n) iteration for callers who
    /// only need the total — see [`Agreement::total_amount`].
    ///
    /// # Errors
    /// Returns [`TrellisError::AgreementNotFound`] if no agreement exists for
    /// the given `agreement_id`.
    pub fn get_total_amount(env: Env, agreement_id: BytesN<32>) -> Result<i128, TrellisError> {
        storage::read_agreement(&env, &agreement_id).map(|agreement| agreement.total_amount)
    }

    /// Fund multiple milestones in a single transaction.
    ///
    /// Iterates `milestone_ids` in order, applying the same logic as
    /// [`Self::lock_funds`] for each entry.  The entire call is atomic: if any
    /// milestone fails (out of range, wrong status), the transaction reverts and
    /// no tokens are transferred.  Individual `funds_locked` events are emitted
    /// for each successfully funded milestone so off-chain indexers retain the
    /// same per-milestone event granularity as sequential calls.
    ///
    /// The payer authorises this call once and the auth covers all transfers
    /// within the batch.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    /// - [`TrellisError::InvalidMilestone`] – any ID in `milestone_ids` is out of range.
    /// - [`TrellisError::InvalidStateTransition`] – any milestone is not `Pending`.
    pub fn batch_lock_funds(
        env: Env,
        agreement_id: BytesN<32>,
        milestone_ids: Vec<u32>,
    ) -> Result<u32, TrellisError> {
        let mut agreement = storage::read_agreement(&env, &agreement_id)?;
        agreement.payer.require_auth();

        let token = token::Client::new(&env, &agreement.token);
        let mut funded: u32 = 0;

        for milestone_id in milestone_ids.iter() {
            let mut milestone = agreement
                .milestones
                .get(milestone_id)
                .ok_or(TrellisError::InvalidMilestone)?;

            if milestone.status != EscrowStatus::Pending {
                return Err(TrellisError::InvalidStateTransition);
            }

            let amount = milestone.amount;
            token.transfer(&agreement.payer, &env.current_contract_address(), &amount);

            milestone.status = EscrowStatus::Funded;
            agreement.milestones.set(milestone_id, milestone);

            events::funds_locked(&env, agreement_id.clone(), milestone_id, amount);
            funded += 1;
        }

        storage::write_agreement(&env, &agreement_id, &agreement);

        Ok(funded)
    }

    /// Return a single [`Milestone`] by its index within the agreement.
    ///
    /// This is a read-only view — no auth required, no state modified.  It lets
    /// callers query one milestone's current status without deserializing the
    /// full [`Agreement`] struct, which reduces ledger read cost for agreements
    /// with many milestones.
    ///
    /// Returns `None` if the agreement does not exist or `milestone_id` is out
    /// of range — both map to the same observable absence from the caller's
    /// perspective.
    pub fn get_milestone(
        env: Env,
        agreement_id: BytesN<32>,
        milestone_id: u32,
    ) -> Option<Milestone> {
        storage::read_agreement(&env, &agreement_id)
            .ok()
            .and_then(|agreement| agreement.milestones.get(milestone_id))
    }

    /// Renew the ledger TTL of an agreement without changing its state.
    ///
    /// Persistent entries are archived once their TTL runs out, which would
    /// destroy the agreement record. State-mutating entrypoints renew the TTL
    /// automatically, but an agreement that sits idle — a long delivery
    /// window, a stalled dispute — receives no writes and will eventually
    /// expire. This entrypoint exists so an external keeper service can renew
    /// it on a schedule.
    ///
    /// No auth is required: extending a TTL cannot alter agreement state and
    /// the caller pays the rent, so there is nothing to gate. Requiring a
    /// signature would only stop third-party keepers from doing useful work.
    ///
    /// # Errors
    /// - [`TrellisError::AgreementNotFound`] – unknown agreement ID.
    pub fn extend_agreement_ttl(
        env: Env,
        agreement_id: BytesN<32>,
    ) -> Result<(), TrellisError> {
        storage::extend_agreement_ttl(&env, &agreement_id)
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Reject non-positive milestone amounts and sum the rest into a total.
///
/// Runs once, in `init`, before the agreement is written to storage — so an
/// invalid milestone list never consumes storage, and every later reader gets
/// the sum for free via [`Agreement::total_amount`] instead of iterating
/// `milestones` on every query.
///
/// # Errors
/// Returns [`TrellisError::InvalidMilestone`] on the first milestone whose
/// `amount` is zero or negative.
fn validate_milestones(milestones: &Vec<Milestone>) -> Result<i128, TrellisError> {
    let mut total: i128 = 0;
    for m in milestones.iter() {
        if m.amount <= 0 {
            return Err(TrellisError::InvalidMilestone);
        }
        total += m.amount;
    }
    Ok(total)
}
