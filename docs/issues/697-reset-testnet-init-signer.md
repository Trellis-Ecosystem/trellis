# #697 — `reset-testnet.sh` signs `init` with the deployer and omits `--yes`

**Area:** `scripts/reset-testnet.sh` · **Type:** bug (deployment script)

## Problem

`scripts/reset-testnet.sh:58` sets the deployer as the signing key for every
CLI call after it:

```bash
export TRELLIS_SOURCE_KEY="$DEPLOYER_KEY"
```

and then runs (lines 61-67):

```bash
"$CLI_BIN" init --agreement-id "$AGREEMENT_ID" --payer "$PAYER" ... --milestones "1000"
```

This breaks in two ways:

1. **Wrong signer.** `init` calls `payer.require_auth()`
   (`contracts/trellis_core/src/lib.rs:95`). `$PAYER` is the `trellis-payer`
   account, so a transaction signed by `trellis-deployer` cannot satisfy that
   auth check and fails. Everywhere else, `init` is signed by the payer:
   `tests/cli_integration/run.sh:133` uses `TRELLIS_SOURCE_KEY=payer`, and
   `DEPLOYMENT.md:389` lists the payer as the signer for `init`.
2. **No `--yes`.** `init` asks for confirmation through `confirm_action`
   (`cli/trellis_cli/src/commands/mod.rs:252-280`). Without `--yes`, the script
   stops at an interactive `Continue? [y/N]` prompt. Under `--quiet` it fails
   with "Confirmation required" instead.

## Fix

Keep the deployer key for the deploy step only, and sign `init` with the payer:

```bash
echo "==> Creating fresh test agreement"
TRELLIS_SOURCE_KEY=trellis-payer "$CLI_BIN" init \
  --agreement-id "$AGREEMENT_ID" \
  --payer "$PAYER" \
  --payee "$PAYEE" \
  --token "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" \
  --resolver "$RESOLVER" \
  --milestones "1000" \
  --yes
```

Remove the global `export TRELLIS_SOURCE_KEY="$DEPLOYER_KEY"` if nothing after
it needs it. Otherwise the payer override on the `init` line is enough.

Also check that `trellis-payer` is funded on testnet before `init` runs
(`stellar keys fund trellis-payer --network testnet`). Otherwise the call fails
with "Account not found".

## Verification

```bash
./scripts/reset-testnet.sh </dev/null      # must not wait for input
# then run the "Verify with:" command the script prints:
TRELLIS_CONTRACT_ID=<id> trellis status --agreement-id <agreement-id>
```

`status` should return the new agreement: payer, payee, resolver and one
milestone of 1000.

## Done when

`./scripts/reset-testnet.sh` runs to completion without any prompt, and the
`trellis status` command it prints returns the new agreement.
