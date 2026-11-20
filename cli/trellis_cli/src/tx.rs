//! Native transaction-envelope construction for the Trellis CLI.
//!
//! This module builds a [`TransactionV1Envelope`] containing a single
//! [`Operation`] whose body is an [`InvokeHostFunctionOp`] that calls the
//! Trellis contract (`config.contract_id`) with the encoded function name and
//! `ScVal` arguments for one of the mutating entrypoints.
//!
//! The envelope is built using:
//! - the sequence number fetched from the network (see the RPC sequence-number
//!   lookup work tracked elsewhere in this batch),
//! - the network passphrase from the CLI configuration,
//! - the contract id from the CLI configuration.
//!
//! The resulting envelope is *unsigned*; signing is handled separately.

use anyhow::{anyhow, Context, Result};
use stellar_xdr::curr::{
    AccountId, ContractId, Hash, HostFunction, InvokeContractArgs, InvokeHostFunctionOp,
    Limits, Memo, MuxedAccount, Operation, OperationBody, Preconditions, PublicKey, ScAddress,
    ScSymbol, ScVal, SequenceNumber, Transaction, TransactionEnvelope, TransactionExt,
    TransactionV1Envelope, Uint256, VecM, WriteXdr,
};

use crate::config::Config;

/// The eight (plus one) mutating entrypoints exposed by the Trellis contract.
///
/// Each variant carries the arguments required to build the corresponding
/// `InvokeContract` call. The argument shapes differ per entrypoint, so the
/// enum is the single source of truth for how each call is encoded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MutatingEntrypoint {
    /// `init(admin: Address, token: Address, ...)`
    Init {
        admin: ScAddress,
        token: ScAddress,
    },
    /// `lock_funds(agreement_id: u64, amount: i128)`
    LockFunds { agreement_id: u64, amount: i128 },
    /// `submit_work(agreement_id: u64, milestone_id: u32, evidence_hash: Bytes)`
    SubmitWork {
        agreement_id: u64,
        milestone_id: u32,
        evidence_hash: Vec<u8>,
    },
    /// `approve_and_release(agreement_id: u64, milestone_id: u32)`
    ApproveAndRelease {
        agreement_id: u64,
        milestone_id: u32,
    },
    /// `raise_dispute(agreement_id: u64, reason: Symbol)`
    RaiseDispute { agreement_id: u64, reason: String },
    /// `resolve_dispute(agreement_id: u64, resolution: Symbol)`
    ResolveDispute {
        agreement_id: u64,
        resolution: String,
    },
    /// `cancel_unfunded_milestone(agreement_id: u64, milestone_id: u32)`
    CancelUnfundedMilestone {
        agreement_id: u64,
        milestone_id: u32,
    },
    /// `extend_agreement_ttl(agreement_id: u64, new_deadline: u64)`
    ExtendAgreementTtl {
        agreement_id: u64,
        new_deadline: u64,
    },
    /// `decline_unfunded_milestone(agreement_id: u64, milestone_id: u32)`
    DeclineUnfundedMilestone {
        agreement_id: u64,
        milestone_id: u32,
    },
}

impl MutatingEntrypoint {
    /// The on-chain function name (as a `Symbol`) for this entrypoint.
    pub fn function_name(&self) -> &'static str {
        match self {
            MutatingEntrypoint::Init { .. } => "init",
            MutatingEntrypoint::LockFunds { .. } => "lock_funds",
            MutatingEntrypoint::SubmitWork { .. } => "submit_work",
            MutatingEntrypoint::ApproveAndRelease { .. } => "approve_and_release",
            MutatingEntrypoint::RaiseDispute { .. } => "raise_dispute",
            MutatingEntrypoint::ResolveDispute { .. } => "resolve_dispute",
            MutatingEntrypoint::CancelUnfundedMilestone { .. } => "cancel_unfunded_milestone",
            MutatingEntrypoint::ExtendAgreementTtl { .. } => "extend_agreement_ttl",
            MutatingEntrypoint::DeclineUnfundedMilestone { .. } => "decline_unfunded_milestone",
        }
    }

    /// Encode the arguments for this entrypoint as `ScVal`s, in the order the
    /// contract expects them.
    pub fn args(&self) -> Result<Vec<ScVal>> {
        let args = match self {
            MutatingEntrypoint::Init { admin, token } => vec![
                ScVal::Address(admin.clone()),
                ScVal::Address(token.clone()),
            ],
            MutatingEntrypoint::LockFunds {
                agreement_id,
                amount,
            } => vec![
                ScVal::U64(*agreement_id),
                ScVal::I128(stellar_xdr::curr::Int128Parts {
                    hi: if *amount < 0 { -1 } else { 0 },
                    lo: *amount as u64,
                }),
            ],
            MutatingEntrypoint::SubmitWork {
                agreement_id,
                milestone_id,
                evidence_hash,
            } => vec![
                ScVal::U64(*agreement_id),
                ScVal::U32(*milestone_id),
                ScVal::Bytes(
                    evidence_hash
                        .clone()
                        .try_into()
                        .map_err(|_| anyhow!("evidence_hash too large for ScVal::Bytes"))?,
                ),
            ],
            MutatingEntrypoint::ApproveAndRelease {
                agreement_id,
                milestone_id,
            } => vec![ScVal::U64(*agreement_id), ScVal::U32(*milestone_id)],
            MutatingEntrypoint::RaiseDispute {
                agreement_id,
                reason,
            } => vec![
                ScVal::U64(*agreement_id),
                ScVal::Symbol(
                    reason
                        .clone()
                        .try_into()
                        .map_err(|_| anyhow!("dispute reason is not a valid Symbol"))?,
                ),
            ],
            MutatingEntrypoint::ResolveDispute {
                agreement_id,
                resolution,
            } => vec![
                ScVal::U64(*agreement_id),
                ScVal::Symbol(
                    resolution
                        .clone()
                        .try_into()
                        .map_err(|_| anyhow!("dispute resolution is not a valid Symbol"))?,
                ),
            ],
            MutatingEntrypoint::CancelUnfundedMilestone {
                agreement_id,
                milestone_id,
            } => vec![ScVal::U64(*agreement_id), ScVal::U32(*milestone_id)],
            MutatingEntrypoint::ExtendAgreementTtl {
                agreement_id,
                new_deadline,
            } => vec![ScVal::U64(*agreement_id), ScVal::U64(*new_deadline)],
            MutatingEntrypoint::DeclineUnfundedMilestone {
                agreement_id,
                milestone_id,
            } => vec![ScVal::U64(*agreement_id), ScVal::U32(*milestone_id)],
        };
        Ok(args)
    }
}

/// Parse a contract id string (StrKey `C...`) into an [`ScAddress`].
pub fn parse_contract_address(contract_id: &str) -> Result<ScAddress> {
    let contract = ContractId::from_strkey(contract_id)
        .with_context(|| format!("invalid contract id: {contract_id}"))?;
    Ok(ScAddress::Contract(contract))
}

/// Parse a public key string (StrKey `G...`) into an [`ScAddress`].
pub fn parse_account_address(public_key: &str) -> Result<ScAddress> {
    let pk = PublicKey::from_strkey(public_key)
        .with_context(|| format!("invalid public key: {public_key}"))?;
    Ok(ScAddress::Account(AccountId(PublicKey::PublicKeyTypeEd25519(
        match pk {
            PublicKey::PublicKeyTypeEd25519(k) => k,
        },
    ))))
}

/// Build the [`InvokeHostFunctionOp`] for a given entrypoint targeting the
/// configured contract.
pub fn build_invoke_op(
    contract: &ScAddress,
    entrypoint: &MutatingEntrypoint,
) -> Result<InvokeHostFunctionOp> {
    let function_name = ScSymbol(
        entrypoint
            .function_name()
            .to_string()
            .try_into()
            .map_err(|_| anyhow!("function name is not a valid Symbol"))?,
    );

    let args: VecM<ScVal> = entrypoint
        .args()?
        .try_into()
        .map_err(|_| anyhow!("too many arguments for InvokeContract"))?;

    let invoke_args = InvokeContractArgs {
        contract_address: contract.clone(),
        function_name,
        args,
    };

    Ok(InvokeHostFunctionOp {
        host_function: HostFunction::InvokeContract(invoke_args),
        auth: VecM::default(),
    })
}

/// Build an unsigned [`TransactionV1Envelope`] invoking `entrypoint` on the
/// configured contract.
///
/// * `config` — CLI configuration providing `contract_id` and network
///   passphrase.
/// * `source_account` — the `G...` public key of the transaction source
///   account.
/// * `sequence_number` — the account's current sequence number, as fetched
///   from the network (the envelope uses `sequence_number + 1`).
/// * `entrypoint` — which mutating entrypoint to invoke and with what
///   arguments.
pub fn build_envelope(
    config: &Config,
    source_account: &str,
    sequence_number: i64,
    entrypoint: &MutatingEntrypoint,
) -> Result<TransactionEnvelope> {
    let contract = parse_contract_address(&config.contract_id)?;

    let source_pk = PublicKey::from_strkey(source_account)
        .with_context(|| format!("invalid source account: {source_account}"))?;
    let source = MuxedAccount::Ed25519(match source_pk {
        PublicKey::PublicKeyTypeEd25519(k) => k,
    });

    let op = build_invoke_op(&contract, entrypoint)?;

    let operation = Operation {
        source_account: None,
        body: OperationBody::InvokeHostFunction(op),
    };

    let operations: VecM<Operation, 100> = vec![operation]
        .try_into()
        .map_err(|_| anyhow!("failed to build operations list"))?;

    let tx = Transaction {
        source_account: source,
        fee: 100,
        seq_num: SequenceNumber(sequence_number.saturating_add(1)),
        cond: Preconditions::None,
        memo: Memo::None,
        operations,
        ext: TransactionExt::V0,
    };

    // Validate the network passphrase is present; the passphrase itself is
    // consumed by the signing step, but we surface a clear error early if it
    // is missing.
    if config.network_passphrase.trim().is_empty() {
        return Err(anyhow!("network passphrase is not configured"));
    }

    Ok(TransactionEnvelope::Tx(TransactionV1Envelope {
        tx,
        signatures: VecM::default(),
    }))
}

/// Convenience helper: build the envelope and return its base64-encoded XDR.
pub fn build_envelope_xdr(
    config: &Config,
    source_account: &str,
    sequence_number: i64,
    entrypoint: &MutatingEntrypoint,
) -> Result<String> {
    let envelope = build_envelope(config, source_account, sequence_number, entrypoint)?;
    envelope
        .to_xdr_base64(Limits::none())
        .context("failed to encode envelope as base64 XDR")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> Config {
        Config {
            contract_id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4".to_string(),
            network_passphrase: "Test SDF Network ; September 2015".to_string(),
            ..Config::default()
        }
    }

    const SOURCE: &str = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    fn extract_invoke(envelope: &TransactionEnvelope) -> &InvokeContractArgs {
        let TransactionEnvelope::Tx(v1) = envelope else {
            panic!("expected a V1 transaction envelope");
        };
        assert_eq!(v1.tx.operations.len(), 1, "expected exactly one operation");
        let op = &v1.tx.operations[0];
        match &op.body {
            OperationBody::InvokeHostFunction(invoke) => match &invoke.host_function {
                HostFunction::InvokeContract(args) => args,
                other => panic!("expected InvokeContract, got {other:?}"),
            },
            other => panic!("expected InvokeHostFunction, got {other:?}"),
        }
    }

    #[test]
    fn builds_lock_funds_envelope() {
        let config = test_config();
        let entrypoint = MutatingEntrypoint::LockFunds {
            agreement_id: 42,
            amount: 1_000,
        };

        let envelope = build_envelope(&config, SOURCE, 7, &entrypoint).unwrap();
        let args = extract_invoke(&envelope);

        // Operation type: InvokeHostFunction / InvokeContract.
        assert_eq!(
            args.function_name,
            ScSymbol("lock_funds".to_string().try_into().unwrap())
        );
        assert_eq!(args.contract_address, parse_contract_address(&config.contract_id).unwrap());
        assert_eq!(args.args.len(), 2);
        assert_eq!(args.args[0], ScVal::U64(42));
        assert_eq!(
            args.args[1],
            ScVal::I128(stellar_xdr::curr::Int128Parts { hi: 0, lo: 1_000 })
        );

        // Sequence number is bumped by one.
        let TransactionEnvelope::Tx(v1) = &envelope else {
            unreachable!()
        };
        assert_eq!(v1.tx.seq_num, SequenceNumber(8));
        assert!(v1.signatures.is_empty());
    }

    #[test]
    fn builds_approve_and_release_envelope() {
        let config = test_config();
        let entrypoint = MutatingEntrypoint::ApproveAndRelease {
            agreement_id: 9,
            milestone_id: 3,
        };

        let envelope = build_envelope(&config, SOURCE, 100, &entrypoint).unwrap();
        let args = extract_invoke(&envelope);

        assert_eq!(
            args.function_name,
            ScSymbol("approve_and_release".to_string().try_into().unwrap())
        );
        assert_eq!(args.args.len(), 2);
        assert_eq!(args.args[0], ScVal::U64(9));
        assert_eq!(args.args[1], ScVal::U32(3));
    }

    #[test]
    fn builds_decline_unfunded_milestone_envelope() {
        let config = test_config();
        let entrypoint = MutatingEntrypoint::DeclineUnfundedMilestone {
            agreement_id: 5,
            milestone_id: 1,
        };

        let envelope = build_envelope(&config, SOURCE, 0, &entrypoint).unwrap();
        let args = extract_invoke(&envelope);

        assert_eq!(
            args.function_name,
            ScSymbol("decline_unfunded_milestone".to_string().try_into().unwrap())
        );
        assert_eq!(args.args.len(), 2);
        assert_eq!(args.args[0], ScVal::U64(5));
        assert_eq!(args.args[1], ScVal::U32(1));
    }

    #[test]
    fn builds_extend_agreement_ttl_envelope() {
        let config = test_config();
        let entrypoint = MutatingEntrypoint::ExtendAgreementTtl {
            agreement_id: 1,
            new_deadline: 999,
        };

        let envelope = build_envelope(&config, SOURCE, 10, &entrypoint).unwrap();
        let args = extract_invoke(&envelope);

        assert_eq!(
            args.function_name,
            ScSymbol("extend_agreement_ttl".to_string().try_into().unwrap())
        );
        assert_eq!(args.args.len(), 2);
        assert_eq!(args.args[0], ScVal::U64(1));
        assert_eq!(args.args[1], ScVal::U64(999));
    }

    #[test]
    fn rejects_missing_network_passphrase() {
        let mut config = test_config();
        config.network_passphrase = String::new();
        let entrypoint = MutatingEntrypoint::LockFunds {
            agreement_id: 1,
            amount: 1,
        };
        assert!(build_envelope(&config, SOURCE, 0, &entrypoint).is_err());
    }

    #[test]
    fn rejects_invalid_contract_id() {
        let mut config = test_config();
        config.contract_id = "not-a-contract".to_string();
        let entrypoint = MutatingEntrypoint::LockFunds {
            agreement_id: 1,
            amount: 1,
        };
        assert!(build_envelope(&config, SOURCE, 0, &entrypoint).is_err());
    }
}