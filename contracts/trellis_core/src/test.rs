use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    token, vec, Address, BytesN, Env, String, Symbol, TryFromVal, Vec,
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
            amount,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ]
}

/// Append the Trellis contract's own event topics, in emission order, to `out`.
///
/// `env.events().all()` also carries the SAC's own mint/transfer events, so
/// only the events whose contract address is the Trellis contract are kept.
///
/// Call this immediately after the invocation whose events are wanted: the test
/// host only exposes the events of the most recent invocation, so a read taken
/// later (after a `balance` call, for example) would see an empty buffer.
fn collect_contract_event_topics(env: &Env, client: &TrellisContractClient, out: &mut Vec<Symbol>) {
    let all_events = env.events().all();
    for i in 0..all_events.len() {
        let (contract_id, topics, _data) = all_events.get_unchecked(i);
        if contract_id != client.address {
            continue;
        }
        let topic0 = Symbol::try_from_val(env, &topics.get_unchecked(0))
            .expect("event topic 0 must decode as a Symbol");
        out.push_back(topic0);
    }
}

/// Common test fixture.
///
/// Returns `(env, payer, payee, dispute_resolver, token_address, client)`.
///
/// Auth is mocked for every address (`mock_all_auths`): `soroban-sdk` 22 does
/// not mock authorizations by default, and without it the fixture's own
/// `mint` call — and every `require_auth` in the contract — traps with an
/// `Auth, InvalidAction` host error. Tests that need to prove a call is
/// *rejected* for lack of a signature drop the mocks again with
/// `env.set_auths(&[])`.
fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    TrellisContractClient<'static>,
) {
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

    // The test host only exposes the events of the most recent invocation, so
    // the Trellis events are collected step by step rather than once at the
    // end (by which point the SAC `balance` reads below would have replaced
    // the buffer).
    let mut emitted: Vec<Symbol> = Vec::new(&env);

    // ── init ───────────────────────────────────────────────────────────────
    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, amount),
        &dispute_resolver,
    );
    collect_contract_event_topics(&env, &client, &mut emitted);

    // ── lock_funds ─────────────────────────────────────────────────────────
    let payer_balance_before = token_client.balance(&payer);
    client.lock_funds(&id, &0u32);
    collect_contract_event_topics(&env, &client, &mut emitted);

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
    let proof = Some(String::from_str(&env, "ipfs://test"));
    client.submit_work(&id, &0u32, &proof);
    collect_contract_event_topics(&env, &client, &mut emitted);

    // ── approve_and_release ────────────────────────────────────────────────
    client.approve_and_release(&id, &0u32);
    collect_contract_event_topics(&env, &client, &mut emitted);

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
    // env.events().all() also carries the SAC's own mint/transfer events, so
    // `collect_contract_event_topics` keeps only the Trellis contract's own
    // events, in the order they must have fired: created, locked, submitted,
    // released.
    let expected_topics = vec![
        &env,
        symbol_short!("trls_crte"),
        symbol_short!("trls_lckd"),
        symbol_short!("trls_sbmt"),
        symbol_short!("trls_rlsd"),
    ];
    assert_eq!(
        emitted, expected_topics,
        "expected created → locked → submitted → released events, in order"
    );
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
        Err(Ok(TrellisError::InvalidStateTransition)),
        "second cancel on an already-Refunded milestone must return InvalidStateTransition"
    );
}

/// Cancelling a milestone that has already been funded must be rejected with
/// InvalidStateTransition — the milestone genuinely has funds locked, so the
/// error must reflect the state machine violation, not an economic one.
#[test]
fn test_cancel_funded_milestone_fails_with_invalid_state_transition() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 6);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 400),
        &dispute_resolver,
    );

    // Fund the milestone so it is no longer Pending.
    client.lock_funds(&id, &0u32);

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
            amount: 1_000,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 2_000,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    client.lock_funds(&id, &0u32);

    let proof = Some(String::from_str(&env, "ipfs://multi-milestone"));
    client.submit_work(&id, &0u32, &proof);

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
        Milestone {
            amount: 500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    let milestone_ids = vec![&env, 0u32, 1u32];
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
        Milestone {
            amount: 500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    client.lock_funds(&id, &0u32);

    // milestone 0 is already Funded — the batch must fail atomically.
    let milestone_ids = vec![&env, 0u32, 1u32];
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
        Milestone {
            amount: 100,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 200,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    let m = client.get_milestone(&id, &1u32);
    assert!(m.is_some(), "milestone 1 must be found");
    let m = m.unwrap();
    assert_eq!(m.amount, 200, "amount must match");
    assert_eq!(m.status, EscrowStatus::Pending, "status must be Pending");
}

/// get_milestone returns None for an out-of-range milestone_id.
#[test]
fn test_get_milestone_invalid_id_returns_none() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 21);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 100),
        &dispute_resolver,
    );

    let result = client.get_milestone(&id, &99u32);
    assert!(
        result.is_none(),
        "out-of-range milestone_id must return None"
    );
}

// ---------------------------------------------------------------------------
// Authorization tests
// ---------------------------------------------------------------------------

/// `lock_funds` is payer-only. With no signature available for the call, the
/// contract's `payer.require_auth()` must trap instead of moving funds.
#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_lock_funds_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 30);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    // Drop the mocks: nobody has authorised this call.
    env.set_auths(&[]);
    client.lock_funds(&id, &0u32);
}

/// `submit_work` is payee-only. With no signature available for the call, the
/// contract's `payee.require_auth()` must trap.
#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_submit_work_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 31);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    client.lock_funds(&id, &0u32);

    // Drop the mocks: nobody has authorised this call.
    env.set_auths(&[]);
    let proof = Some(String::from_str(&env, "ipfs://fake"));
    client.submit_work(&id, &0u32, &proof);
}

/// `approve_and_release` is payer-only. With no signature available for the
/// call, the contract's `payer.require_auth()` must trap before any release.
#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_approve_release_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 32);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    client.lock_funds(&id, &0u32);

    let proof = Some(String::from_str(&env, "ipfs://work"));
    client.submit_work(&id, &0u32, &proof);

    // Drop the mocks: nobody has authorised this call.
    env.set_auths(&[]);
    client.approve_and_release(&id, &0u32);
}

/// `resolve_dispute` is resolver-only. With no signature available for the
/// call, the contract's `dispute_resolver.require_auth()` must trap.
#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_resolve_dispute_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 33);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    client.lock_funds(&id, &0u32);

    client.raise_dispute(&payee, &id, &0u32);

    // Drop the mocks: the resolver has not authorised the ruling.
    env.set_auths(&[]);
    client.resolve_dispute(&id, &0u32, &true);
}

/// `raise_dispute` is payer/payee-only. An unrelated address is rejected by the
/// contract's own role check with `Unauthorized` — before any auth check, and
/// long before the milestone could move to `Disputed`.
#[test]
fn test_raise_dispute_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 34);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    client.lock_funds(&id, &0u32);

    // A random address tries to raise the dispute.
    let random = Address::generate(&env);
    let result = client.try_raise_dispute(&random, &id, &0u32);
    assert_eq!(
        result,
        Err(Ok(TrellisError::Unauthorized)),
        "an unrelated caller must be rejected with Unauthorized"
    );

    // The milestone is untouched: still Funded, not Disputed.
    let milestone = client
        .get_milestone(&id, &0u32)
        .expect("milestone 0 must exist");
    assert_eq!(
        milestone.status,
        EscrowStatus::Funded,
        "a rejected dispute must leave the milestone Funded"
    );
}

/// `cancel_unfunded_milestone` is payer-only. With no signature available for
/// the call, the contract's `payer.require_auth()` must trap.
#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_cancel_unfunded_wrong_role_fails() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 35);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    // Drop the mocks: nobody has authorised this call.
    env.set_auths(&[]);
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
            amount: 1_000,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 2_500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 1_500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    let total = client.get_total_amount(&id);
    assert_eq!(
        total, 5_000,
        "get_total_amount should return sum of all milestones"
    );
}

/// Test extend_agreement_ttl on an existing agreement.
#[test]
fn test_extend_ttl_success() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 41);
    let keeper = Address::generate(&env);

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 1_000),
        &dispute_resolver,
    );

    // extend_agreement_ttl has no require_auth() gate — it's a permissionless
    // keeper entrypoint — so no auth mock is needed here. The `keeper` address
    // is only recorded in the emitted ttl_extended event, it is not verified.
    let result = client.try_extend_agreement_ttl(&id, &keeper);
    assert!(
        result.is_ok(),
        "extend_agreement_ttl should succeed on existing agreement"
    );
}

/// Test extend_agreement_ttl on non-existent agreement fails gracefully.
#[test]
fn test_extend_ttl_nonexistent_agreement() {
    let (env, _payer, _payee, _dispute_resolver, _token_address, client) = setup();
    let id = agreement_id(&env, 99);
    let keeper = Address::generate(&env);

    // No auth mock needed — see comment above test_extend_ttl_success.
    let result = client.try_extend_agreement_ttl(&id, &keeper);
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

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, amount),
        &dispute_resolver,
    );

    client.lock_funds(&id, &0u32);

    // Payer raises the dispute
    client.raise_dispute(&payer, &id, &0u32);

    // Verify milestone status transitioned to Disputed
    let milestone = client
        .get_milestone(&id, &0u32)
        .expect("milestone 0 must exist");
    assert_eq!(
        milestone.status,
        EscrowStatus::Disputed,
        "milestone should transition to Disputed when payer raises dispute"
    );
}

// ---------------------------------------------------------------------------
// #393 — Atomicity of failed init calls
// ---------------------------------------------------------------------------

/// A failed `init` must leave no partial [`Agreement`] entry behind, and must
/// not consume the agreement ID.
///
/// `init` performs every validation *before* it writes, so a rejected call has
/// to be indistinguishable from one that was never made: a later read of the
/// ID still returns `AgreementNotFound`, and a corrected `init` with the very
/// same ID succeeds.
#[test]
fn test_failed_zero_amount_init_leaves_no_state_corruption() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 32);

    // ── Attempt 1: invalid (zero-amount) milestone set ────────────────────
    let failed = client.try_init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 0),
        &dispute_resolver,
    );
    assert_eq!(
        failed,
        Err(Ok(TrellisError::InvalidMilestone)),
        "init with a zero-amount milestone must fail with InvalidMilestone"
    );

    // ── Nothing was written for that ID ──────────────────────────────────
    let stored = client.try_get_agreement(&id);
    assert_eq!(
        stored.err().unwrap(),
        Ok(TrellisError::AgreementNotFound),
        "a rejected init must not leave a partial Agreement entry in storage"
    );

    // ── Attempt 2: the ID is still free, so a valid retry succeeds ───────
    let result = client.try_init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 100),
        &dispute_resolver,
    );
    assert_eq!(
        result,
        Ok(Ok(())),
        "a rejected init must not consume the agreement ID — retrying with valid input must succeed"
    );

    let agreement = client.get_agreement(&id);
    assert_eq!(
        agreement.total_amount, 100,
        "the retried init must store the corrected amount"
    );
}

/// The same atomicity guarantee for a second `init` failure path: a
/// `dispute_resolver` that is one of the parties must be rejected without
/// writing anything either.
///
/// This is the adjacent case #393 asks for — it guards against "fixing"
/// atomicity for the milestone-validation path only, e.g. by moving the
/// storage write above the resolver check.
#[test]
fn test_failed_resolver_is_party_init_leaves_no_state_corruption() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let id = agreement_id(&env, 33);

    // ── Attempt 1: resolver == payee ──────────────────────────────────────
    let failed = client.try_init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 1_000),
        &payee, // resolver must be a neutral third party
    );
    assert_eq!(
        failed,
        Err(Ok(TrellisError::ResolverCannotBeParty)),
        "a resolver equal to a party must fail with ResolverCannotBeParty"
    );

    // ── Nothing was written, and the ID is still usable ──────────────────
    let stored = client.try_get_agreement(&id);
    assert_eq!(
        stored.err().unwrap(),
        Ok(TrellisError::AgreementNotFound),
        "a rejected init must not leave a partial Agreement entry in storage"
    );

    let result = client.try_init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 1_000),
        &dispute_resolver,
    );
    assert_eq!(
        result,
        Ok(Ok(())),
        "a rejected init must not consume the agreement ID — retrying with a neutral resolver must succeed"
    );
}

// ---------------------------------------------------------------------------
// #394 — Milestone funding order independence
// ---------------------------------------------------------------------------

/// Milestones may be funded in any order. Locking later indexes before earlier
/// ones must leave every funded milestone `Funded`, and completing one
/// milestone must not disturb the others.
#[test]
fn test_multi_milestone_funding_order_independent() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let token_client = token::TokenClient::new(&env, &token_address);
    let id = agreement_id(&env, 34);

    let milestones = vec![
        &env,
        Milestone {
            amount: 500,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 700,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 300,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    // Fund the three milestones in reverse order: 2, then 1, then 0.
    for milestone_id in [2u32, 1u32, 0u32] {
        client.lock_funds(&id, &milestone_id);
    }

    assert_eq!(
        token_client.balance(&client.address),
        1_500,
        "all three milestones must be funded no matter which order they were locked in"
    );

    let agreement = client.get_agreement(&id);
    for i in 0..3u32 {
        let milestone = agreement.milestones.get(i).expect("milestone must exist");
        assert_eq!(
            milestone.status,
            EscrowStatus::Funded,
            "every milestone must be Funded after lock_funds"
        );
    }

    // Completing milestone 0 must not touch milestones 1 and 2.
    client.submit_work(&id, &0u32, &None);
    client.approve_and_release(&id, &0u32);

    let agreement = client.get_agreement(&id);
    assert_eq!(
        agreement
            .milestones
            .get(0)
            .expect("milestone 0 must exist")
            .status,
        EscrowStatus::Completed,
        "milestone 0 must be Completed after release"
    );
    assert_eq!(
        agreement
            .milestones
            .get(1)
            .expect("milestone 1 must exist")
            .status,
        EscrowStatus::Funded,
        "milestone 1 must remain Funded — unaffected by milestone 0 completing"
    );
    assert_eq!(
        agreement
            .milestones
            .get(2)
            .expect("milestone 2 must exist")
            .status,
        EscrowStatus::Funded,
        "milestone 2 must remain Funded — unaffected by milestone 0 completing"
    );
}

/// `batch_lock_funds` must accept a `milestone_ids` vector that is not in
/// ascending order: the batch is keyed by milestone ID, not by position.
#[test]
fn test_batch_lock_funds_out_of_order_ids() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let token_client = token::TokenClient::new(&env, &token_address);
    let id = agreement_id(&env, 35);

    let milestones = vec![
        &env,
        Milestone {
            amount: 100,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 200,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
        Milestone {
            amount: 300,
            status: EscrowStatus::Pending,
            proof_uri: None,
        },
    ];

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &milestones,
        &dispute_resolver,
    );

    // Neither ascending nor descending.
    let milestone_ids = vec![&env, 2u32, 0u32, 1u32];
    let funded = client.batch_lock_funds(&id, &milestone_ids);

    assert_eq!(funded, 3u32, "every listed milestone must be funded");
    assert_eq!(
        token_client.balance(&client.address),
        600,
        "contract balance must equal the sum of the three milestones"
    );
    assert_eq!(
        token_client.balance(&payer),
        9_400,
        "payer must be debited the total of the three milestones"
    );

    let agreement = client.get_agreement(&id);
    for i in 0..3u32 {
        assert_eq!(
            agreement
                .milestones
                .get(i)
                .expect("milestone must exist")
                .status,
            EscrowStatus::Funded,
            "every milestone must be Funded after an out-of-order batch lock"
        );
    }
}

// ---------------------------------------------------------------------------
// #395 / #396 — Index & lookup error paths across the mutating entrypoints
// ---------------------------------------------------------------------------

/// Assert that a `try_*` call fails with exactly
/// [`TrellisError::AgreementNotFound`].
///
/// A macro (rather than a helper fn) is used because every `try_*` client
/// method returns a different `Result` shape — each call site stays explicit
/// about which entrypoint it covers, and a regression that changes one
/// entrypoint's error type still fails on that entrypoint's own line.
macro_rules! assert_agreement_not_found {
    ($call:expr, $entrypoint:literal) => {
        assert_eq!(
            $call,
            Err(Ok(TrellisError::AgreementNotFound)),
            concat!(
                $entrypoint,
                " must return AgreementNotFound for an unknown agreement ID"
            ),
        )
    };
}

/// Assert that a `try_*` call fails with exactly
/// [`TrellisError::InvalidMilestone`].
macro_rules! assert_invalid_milestone {
    ($call:expr, $entrypoint:literal) => {
        assert_eq!(
            $call,
            Err(Ok(TrellisError::InvalidMilestone)),
            concat!(
                $entrypoint,
                " must return InvalidMilestone for an out-of-range milestone_id"
            ),
        )
    };
}

/// Every state-mutating entrypoint must surface `AgreementNotFound` for an ID
/// that was never initialised — none may panic or silently no-op.
///
/// The agreement lookup happens before any auth or state check, so no auth
/// mock is needed here: that ordering is itself part of the guarantee.
#[test]
fn test_agreement_not_found_on_mutating_entrypoints() {
    let (env, payer, _payee, _dispute_resolver, _token_address, client) = setup();
    let missing = agreement_id(&env, 36);

    assert_agreement_not_found!(client.try_lock_funds(&missing, &0u32), "lock_funds");
    assert_agreement_not_found!(
        client.try_submit_work(&missing, &0u32, &None),
        "submit_work"
    );
    assert_agreement_not_found!(
        client.try_approve_and_release(&missing, &0u32),
        "approve_and_release"
    );
    assert_agreement_not_found!(
        client.try_raise_dispute(&payer, &missing, &0u32),
        "raise_dispute"
    );
    assert_agreement_not_found!(
        client.try_resolve_dispute(&missing, &0u32, &true),
        "resolve_dispute"
    );
    assert_agreement_not_found!(
        client.try_cancel_unfunded_milestone(&missing, &0u32),
        "cancel_unfunded_milestone"
    );
    assert_agreement_not_found!(
        client.try_batch_lock_funds(&missing, &vec![&env, 0u32]),
        "batch_lock_funds"
    );

    // None of the rejected calls created an entry: the ID is still unknown.
    assert!(client.get_milestone(&missing, &0u32).is_none());
    let read_back = client.try_get_agreement(&missing);
    assert_eq!(
        read_back.err().unwrap(),
        Ok(TrellisError::AgreementNotFound),
        "the failed calls must not have written anything for the unknown ID"
    );
}

/// Every state-mutating entrypoint must reject a `milestone_id` past the end of
/// the agreement's milestones vector with `InvalidMilestone`, and must do so
/// before performing any state-mutating side effect.
#[test]
fn test_invalid_milestone_on_mutating_entrypoints() {
    let (env, payer, payee, dispute_resolver, token_address, client) = setup();
    let token_client = token::TokenClient::new(&env, &token_address);
    let id = agreement_id(&env, 37);
    // The agreement below holds exactly one milestone, so index 7 is far out
    // of range.
    let oob = 7u32;

    client.init(
        &id,
        &payer,
        &payee,
        &token_address,
        &one_milestone(&env, 500),
        &dispute_resolver,
    );

    assert_invalid_milestone!(client.try_lock_funds(&id, &oob), "lock_funds");

    assert_invalid_milestone!(client.try_submit_work(&id, &oob, &None), "submit_work");

    assert_invalid_milestone!(
        client.try_approve_and_release(&id, &oob),
        "approve_and_release"
    );

    assert_invalid_milestone!(client.try_raise_dispute(&payer, &id, &oob), "raise_dispute");

    assert_invalid_milestone!(
        client.try_resolve_dispute(&id, &oob, &true),
        "resolve_dispute"
    );

    assert_invalid_milestone!(
        client.try_cancel_unfunded_milestone(&id, &oob),
        "cancel_unfunded_milestone"
    );

    // The batch is atomic: it must reject the whole vector — including when a
    // valid ID comes first — without locking the valid milestone.
    assert_invalid_milestone!(
        client.try_batch_lock_funds(&id, &vec![&env, 0u32, oob]),
        "batch_lock_funds"
    );

    // ── No state-mutating side effect may have happened ───────────────────
    let agreement = client.get_agreement(&id);
    let milestone = agreement.milestones.get(0).expect("milestone 0 must exist");
    assert_eq!(
        milestone.status,
        EscrowStatus::Pending,
        "a rejected index must leave the milestone Pending"
    );
    assert_eq!(
        milestone.amount, 500,
        "a rejected index must not change the amount"
    );
    assert_eq!(
        token_client.balance(&client.address),
        0,
        "a rejected index must not lock any funds"
    );
    assert_eq!(
        token_client.balance(&payer),
        10_000,
        "a rejected index must not move any tokens"
    );
}
