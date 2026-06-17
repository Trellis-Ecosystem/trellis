use soroban_sdk::{
    testutils::{Address as _, Events},
    token, vec, Address, BytesN, Env, String, Vec,
};

use crate::{
    errors::TrellisError,
    types::{EscrowStatus, Milestone},
    TrellisContract, TrellisContractClient,
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// Build a 32-byte agreement ID from a seed byte.
fn agreement_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

/// Create a single Milestone at index 0 with the given amount.
fn one_milestone(env: &Env, amount: i128) -> Vec<Milestone> {
    vec![
        env,
        Milestone {
            id: 0,
            amount,
            status: EscrowStatus::Pending,
            proof_uri: String::from_str(env, ""),
        },
    ]
}

/// Common test fixture.
///
/// Returns `(env, payer, payee, dispute_resolver, token_address, client)`.
fn setup() -> (Env, Address, Address, Address, Address, TrellisContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let dispute_resolver = Address::generate(&env);

    // Deploy the built-in Stellar Asset Contract and mint payer a balance.
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
    let token_client = token::TokenClient::new(&env, &token_address);
    token_admin_client.mint(&payer, &10_000);

    // Register the Trellis contract (SDK 21.x API — `register_contract`, not `register`).
    let contract_id = env.register_contract(None, TrellisContract);
    let client = TrellisContractClient::new(&env, &contract_id);

    // Suppress the unused variable warning — token_client used by individual
    // tests via the returned token_address.
    let _ = token_client;

    (env, payer, payee, dispute_resolver, token_address, client)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Full happy-path: init → lock → submit → release.
/// Verifies balances at each step and checks all 4 events were emitted.
#[test]
fn test_happy_path() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let token_client = token::TokenClient::new(&env, &token_address);
    let id = agreement_id(&env, 1);
    let amount: i128 = 1_000;

    // ── init ───────────────────────────────────────────────────────────────
    client
        .init(
            &id,
            &payer,
            &payee,
            &token_address,
            &one_milestone(&env, amount),
            &dispute_resolver,
        );

    // ── lock_funds ─────────────────────────────────────────────────────────
    let payer_balance_before = token_client.balance(&payer);
    client.lock_funds(&id, &0u32);

    assert_eq!(
        token_client.balance(&payer),
        payer_balance_before - amount,
        "payer balance should decrease by milestone amount after lock"
    );
    assert_eq!(
        token_client.balance(&client.address),
        amount,
        "trellis contract balance should equal locked milestone amount"
    );


    // ── submit_work ────────────────────────────────────────────────────────
    let proof = String::from_str(&env, "ipfs://test");
    client.submit_work(&id, &0u32, &proof);

    // ── approve_and_release ────────────────────────────────────────────────
    client.approve_and_release(&id, &0u32);

    assert_eq!(
        token_client.balance(&payee),
        amount,
        "payee should receive the milestone amount after release"
    );
    assert_eq!(
        token_client.balance(&client.address),
        0,
        "contract balance should be zero after release"
    );

    // ── event assertions ───────────────────────────────────────────────────
    // env.events().all() returns ALL contract events from ALL contracts,
    // including the SAC token contract.  Expected breakdown:
    //   SAC:     set_admin, mint, transfer (lock), transfer (release) → 4
    //   Trellis: created, locked, submitted, released                 → 4
    //   Total:                                                          8
    let all_events = env.events().all();
    assert_eq!(all_events.len(), 8, "expected 8 events: 4 Trellis + 4 SAC token events");
}

/// Calling `init` twice with the same agreement_id must return AlreadyInitialized.
#[test]
fn test_double_init_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 2);

    // First init — must succeed.
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    // Second init — must fail with AlreadyInitialized.
    let result = client.try_init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );
    assert_eq!(
        result,
        Err(Ok(TrellisError::AlreadyInitialized)),
        "second init with same ID must return AlreadyInitialized"
    );
}

/// Dispute raised by payee → dispute_resolver rules in payer's favour → payer refunded.
#[test]
fn test_dispute_and_refund_to_payer() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let token_client = token::TokenClient::new(&env, &token_address);
    let id = agreement_id(&env, 3);
    let amount: i128 = 2_000;

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, amount),
        &dispute_resolver,
    );

    let payer_balance_before_lock = token_client.balance(&payer);
    client.lock_funds(&id, &0u32);

    // Payee raises the dispute (exercises the either-party auth path).
    client.raise_dispute(&payee, &id, &0u32);

    // Resolver rules in payer's favour.
    client.resolve_dispute(&id, &0u32, &true);

    assert_eq!(
        token_client.balance(&payer),
        payer_balance_before_lock,
        "payer balance should be fully restored after refund"
    );
    assert_eq!(
        token_client.balance(&client.address),
        0,
        "contract balance should be zero after resolution"
    );
}

/// Cancel a milestone that was never funded, then verify a second cancel fails.
#[test]
fn test_cancel_unfunded_milestone() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 4);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 300),
        &dispute_resolver,
    );

    // First cancel — must succeed (milestone is still Pending).
    client.cancel_unfunded_milestone(&id, &0u32);

    // Second cancel — must fail (milestone is now Refunded, not Pending).
    let result = client.try_cancel_unfunded_milestone(&id, &0u32);
    assert_eq!(
        result,
        Err(Ok(TrellisError::NoFundsToRefund)),
        "second cancel must return NoFundsToRefund"
    );
}

/// get_agreement returns the correct Agreement after init, and AgreementNotFound
/// for an ID that was never initialized.
#[test]
fn test_get_agreement() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 5);

    // Init with one milestone so there is something to read back.
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 750),
        &dispute_resolver,
    );

    // ── Happy path: agreement exists ──────────────────────────────────────
    // client.get_agreement() returns Agreement directly in SDK 21.x —
    // #[contractimpl] unwraps the Ok for the caller; no .expect() needed.
    let agreement = client.get_agreement(&id);

    assert_eq!(agreement.payer, payer, "payer address must match");
    assert_eq!(agreement.payee, payee, "payee address must match");
    assert_eq!(
        agreement.milestones.len(),
        1,
        "should have exactly one milestone"
    );

    let milestone = agreement.milestones.get(0).expect("milestone 0 must exist");
    assert_eq!(
        milestone.status,
        crate::types::EscrowStatus::Pending,
        "freshly created milestone must be Pending"
    );
    assert_eq!(milestone.amount, 750, "milestone amount must match");

    // ── Not-found path: unknown ID returns AgreementNotFound ──────────────
    // Agreement doesn't derive PartialEq so we can't assert_eq on the
    // full Result — instead check the outer Err and unwrap the inner error.
    let fake_id = agreement_id(&env, 99); // never initialized
    let result = client.try_get_agreement(&fake_id);
    assert!(result.is_err(), "unknown agreement ID must return an error");
    assert_eq!(
        result.err().unwrap(),
        Ok(TrellisError::AgreementNotFound),
        "error must be AgreementNotFound"
    );

}

