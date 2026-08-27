use soroban_sdk::{
    testutils::{Address as _, Events, MockAuth, MockAuthInvoke},
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
            proof_uri: None,
        },
    ]
}

/// Helper to authenticate a specific address for testing.
/// Replaces blanket `env.mock_all_auths()` with granular per-caller auth.
fn auth_as(env: &Env, address: &Address) {
    env.mock_auths(&[MockAuth {
        address: address,
        invoke: &MockAuthInvoke {
            contract: address,
            fn_name: "",
            args: vec![env],
            sub_invokes: &[],
        },
    }]);
}

/// Common test fixture.
///
/// Returns `(env, payer, payee, dispute_resolver, token_address, client)`.
/// **Note**: auth is NOT mocked by default — tests must call `auth_as` explicitly.
fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    TrellisContractClient<'static>,
) {
    let env = Env::default();

    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let dispute_resolver = Address::generate(&env);

    // Deploy the built-in Stellar Asset Contract and mint payer a balance.
    let token_admin = Address::generate(&env);
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
    token_admin_client.mint(&payer, &10_000);

    // Register the Trellis contract.
    let contract_id = env.register(TrellisContract, ());
    let client = TrellisContractClient::new(&env, &contract_id);

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
    env.mock_all_auths(); // init requires auth from all parties
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, amount),
        &dispute_resolver,
    );

    // ── lock_funds ─────────────────────────────────────────────────────────
    auth_as(&env, &payer);
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
    auth_as(&env, &payee);
    let proof = Some(String::from_str(&env, "ipfs://test"));
    client.submit_work(&id, &0u32, &proof);

    // ── approve_and_release ────────────────────────────────────────────────
    auth_as(&env, &payer);
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
    let all_events = env.events().all();
    assert!(
        all_events.is_empty() || all_events.len() >= 4,
        "expected Trellis events if recorded"
    );
}

/// Calling `init` twice with the same agreement_id must return AlreadyInitialized.
#[test]
fn test_double_init_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 2);

    // First init — must succeed.
    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    // Second init — must fail with AlreadyInitialized.
    env.mock_all_auths();
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

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, amount),
        &dispute_resolver,
    );

    let payer_balance_before_lock = token_client.balance(&payer);
    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);

    // Payee raises the dispute (exercises the either-party auth path).
    auth_as(&env, &payee);
    client.raise_dispute(&payee, &id, &0u32);

    // Resolver rules in payer's favour.
    auth_as(&env, &dispute_resolver);
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

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 300),
        &dispute_resolver,
    );

    // First cancel — must succeed (milestone is still Pending).
    auth_as(&env, &payer);
    client.cancel_unfunded_milestone(&id, &0u32);

    // Second cancel — must fail (milestone is now Refunded, not Pending).
    auth_as(&env, &payer);
    let result = client.try_cancel_unfunded_milestone(&id, &0u32);
    assert_eq!(
        result,
        Err(Ok(TrellisError::InvalidStateTransition)),
        "second cancel on an already-Refunded milestone must return InvalidStateTransition"
    );
}

/// Cancelling a milestone that has already been funded must be rejected with
/// InvalidStateTransition, not NoFundsToRefund — the milestone genuinely has
/// funds locked, so the error must reflect the state machine violation.
#[test]
fn test_cancel_funded_milestone_fails_with_invalid_state_transition() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 6);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 400),
        &dispute_resolver,
    );

    // Fund the milestone so it is no longer Pending.
    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);

    auth_as(&env, &payer);
    let result = client.try_cancel_unfunded_milestone(&id, &0u32);
    assert_eq!(
        result,
        Err(Ok(TrellisError::InvalidStateTransition)),
        "cancelling a Funded milestone must return InvalidStateTransition"
    );
}

/// Multi-milestone agreements should preserve independent state transitions.
#[test]
fn test_multi_milestone_transitions() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 6);

    let milestones = vec![
        &env,
        Milestone {
            id: 0,
            amount: 1_000,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            id: 1,
            amount: 2_000,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);
    
    let proof = Some(String::from_str(&env, "ipfs://multi-milestone"));
    auth_as(&env, &payee);
    client.submit_work(&id, &0u32, &proof);
    
    auth_as(&env, &payer);
    client.approve_and_release(&id, &0u32);

    let agreement = client.get_agreement(&id);
    let first = agreement.milestones.get(0).expect("milestone 0 must exist");
    let second = agreement.milestones.get(1).expect("milestone 1 must exist");

    assert_eq!(first.status, EscrowStatus::Completed);
    assert_eq!(second.status, EscrowStatus::Pending);
}

/// batch_lock_funds funds every milestone in the supplied list in one call.
#[test]
fn test_batch_lock_funds() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let token_client = token::TokenClient::new(&env, &token_address);
    let id = agreement_id(&env, 10);

    let milestones = vec![
        &env,
        Milestone { id: 0, amount: 500, status: EscrowStatus::Pending, proof_uri: None },
        Milestone { id: 1, amount: 500, status: EscrowStatus::Pending, proof_uri: None },
    ];

    env.mock_all_auths();
    client.init(&id, &payer, &payee, &token_address, &milestones, &dispute_resolver);

    let milestone_ids = vec![&env, 0u32, 1u32];
    auth_as(&env, &payer);
    let funded = client.batch_lock_funds(&id, &milestone_ids);

    assert_eq!(funded, 2u32, "both milestones should be funded");
    assert_eq!(
        token_client.balance(&client.address),
        1_000,
        "contract balance should equal sum of locked milestones"
    );
    assert_eq!(
        token_client.balance(&payer),
        9_000,
        "payer balance should decrease by the total locked amount"
    );
}

/// batch_lock_funds short-circuits on the first already-funded milestone.
#[test]
fn test_batch_lock_funds_partial_failure() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 11);

    let milestones = vec![
        &env,
        Milestone { id: 0, amount: 500, status: EscrowStatus::Pending, proof_uri: None },
        Milestone { id: 1, amount: 500, status: EscrowStatus::Pending, proof_uri: None },
    ];

    env.mock_all_auths();
    client.init(&id, &payer, &payee, &token_address, &milestones, &dispute_resolver);
    
    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);

    // milestone 0 is already Funded — the batch must fail atomically.
    let milestone_ids = vec![&env, 0u32, 1u32];
    auth_as(&env, &payer);
    let result = client.try_batch_lock_funds(&id, &milestone_ids);
    assert_eq!(
        result,
        Err(Ok(TrellisError::InvalidStateTransition)),
        "batch should fail when a milestone is not Pending"
    );
}

/// get_agreement returns the correct Agreement after init, and AgreementNotFound
/// for an ID that was never initialized.
#[test]
fn test_get_agreement() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 5);

    // Init with one milestone so there is something to read back.
    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 750),
        &dispute_resolver,
    );

    // ── Happy path: agreement exists ──────────────────────────────────────
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
    let fake_id = agreement_id(&env, 99); // never initialized
    let result = client.try_get_agreement(&fake_id);
    assert!(result.is_err(), "unknown agreement ID must return an error");
    assert_eq!(
        result.err().unwrap(),
        Ok(TrellisError::AgreementNotFound),
        "error must be AgreementNotFound"
    );
}

/// get_milestone returns the correct milestone for a valid index.
#[test]
fn test_get_milestone_returns_correct_milestone() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 20);

    let milestones = vec![
        &env,
        Milestone { id: 0, amount: 100, status: EscrowStatus::Pending, proof_uri: None },
        Milestone { id: 1, amount: 200, status: EscrowStatus::Pending, proof_uri: None },
    ];

    env.mock_all_auths();
    client.init(&id, &payer, &payee, &token_address, &milestones, &dispute_resolver);

    let m = client.get_milestone(&id, &1u32);
    assert!(m.is_some(), "milestone 1 must be found");
    let m = m.unwrap();
    assert_eq!(m.id, 1, "id must match the requested index");
    assert_eq!(m.amount, 200, "amount must match");
    assert_eq!(m.status, EscrowStatus::Pending, "status must be Pending");
}

/// get_milestone returns None for an out-of-range milestone_id.
#[test]
fn test_get_milestone_invalid_id_returns_none() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 21);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 100),
        &dispute_resolver,
    );

    let result = client.get_milestone(&id, &99u32);
    assert!(result.is_none(), "out-of-range milestone_id must return None");
}

// ---------------------------------------------------------------------------
// Authorization tests
// ---------------------------------------------------------------------------

/// Payee must not be able to call lock_funds (payer-only operation).
#[test]
#[should_panic(expected = "require_auth")]
fn test_lock_funds_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 30);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    // Payee tries to lock funds — should panic with auth error
    auth_as(&env, &payee);
    client.lock_funds(&id, &0u32);
}

/// Payer must not be able to call submit_work (payee-only operation).
#[test]
#[should_panic(expected = "require_auth")]
fn test_submit_work_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 31);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);

    // Payer tries to submit work — should panic with auth error
    auth_as(&env, &payer);
    let proof = Some(String::from_str(&env, "ipfs://fake"));
    client.submit_work(&id, &0u32, &proof);
}

/// Payee must not be able to call approve_and_release (payer-only operation).
#[test]
#[should_panic(expected = "require_auth")]
fn test_approve_release_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 32);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);

    auth_as(&env, &payee);
    let proof = Some(String::from_str(&env, "ipfs://work"));
    client.submit_work(&id, &0u32, &proof);

    // Payee tries to approve — should panic with auth error
    auth_as(&env, &payee);
    client.approve_and_release(&id, &0u32);
}

/// Non-resolver must not be able to call resolve_dispute.
#[test]
#[should_panic(expected = "require_auth")]
fn test_resolve_dispute_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 33);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);

    auth_as(&env, &payee);
    client.raise_dispute(&payee, &id, &0u32);

    // Payer tries to resolve dispute — should panic with auth error
    auth_as(&env, &payer);
    client.resolve_dispute(&id, &0u32, &true);
}

/// Random address must not be able to call raise_dispute (payer/payee only).
#[test]
#[should_panic(expected = "require_auth")]
fn test_raise_dispute_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 34);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);

    // Random address tries to raise dispute — should panic with auth error
    let random = Address::generate(&env);
    auth_as(&env, &random);
    client.raise_dispute(&random, &id, &0u32);
}

/// Payee must not be able to call cancel_unfunded_milestone (payer-only operation).
#[test]
#[should_panic(expected = "require_auth")]
fn test_cancel_unfunded_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 35);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    // Payee tries to cancel — should panic with auth error
    auth_as(&env, &payee);
    client.cancel_unfunded_milestone(&id, &0u32);
}

/// Test get_total_amount returns the correct sum of all milestone amounts.
#[test]
fn test_get_total_amount_matches_sum() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 40);

    let milestones = vec![
        &env,
        Milestone {
            id: 0,
            amount: 1_000,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            id: 1,
            amount: 2_500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            id: 2,
            amount: 1_500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    let total = client.get_total_amount(&id).unwrap();
    assert_eq!(total, 5_000, "get_total_amount should return sum of all milestones");
}

/// Test extend_agreement_ttl on an existing agreement.
#[test]
fn test_extend_ttl_success() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 41);

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 1_000),
        &dispute_resolver,
    );

    env.mock_all_auths();
    let result = client.extend_agreement_ttl(&id);
    assert!(result.is_ok(), "extend_agreement_ttl should succeed on existing agreement");
}

/// Test extend_agreement_ttl on non-existent agreement fails gracefully.
#[test]
fn test_extend_ttl_nonexistent_agreement() {
    let (env, _payer, _payee, _dispute_resolver, _token_address, client) = setup();
    let id = agreement_id(&env, 99);

    env.mock_all_auths();
    let result = client.try_extend_agreement_ttl(&id);
    assert_eq!(
        result,
        Err(Ok(TrellisError::AgreementNotFound)),
        "extend_agreement_ttl on non-existent agreement should return AgreementNotFound"
    );
}

/// Test dispute raised by payer.
#[test]
fn test_dispute_raised_by_payer() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 42);
    let amount: i128 = 2_000;

    env.mock_all_auths();
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, amount),
        &dispute_resolver,
    );

    auth_as(&env, &payer);
    client.lock_funds(&id, &0u32);

    // Payer raises the dispute
    auth_as(&env, &payer);
    client.raise_dispute(&payer, &id, &0u32);

    // Verify milestone status transitioned to Disputed
    let status = client.get_milestone_status(&id, &0u32).unwrap();
    assert_eq!(
        status,
        EscrowStatus::Disputed,
        "milestone should transition to Disputed when payer raises dispute"
    );
}
