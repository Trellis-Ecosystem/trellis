#!/usr/bin/env bash
# End-to-end smoke test (#504): deploy a fresh trellis_core, drive one agreement
# through init -> lock-funds -> submit-work -> approve-release with the CLI, then
# read the final state back with `trellis status` -- the same get_agreement read
# path the frontend uses -- and assert every milestone is Completed.
#
# Needs `stellar` and `cargo`, and network access (or a local node).
# Usage: NETWORK=testnet|local ./scripts/smoke-test.sh   (default: testnet)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

NETWORK="${NETWORK:-testnet}"
case "$NETWORK" in
  testnet)
    export STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
    export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}" ;;
  local)
    export STELLAR_RPC_URL="${STELLAR_RPC_URL:-http://localhost:8000/soroban/rpc}"
    export STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Standalone Network ; February 2017}" ;;
  *) echo "NETWORK must be testnet or local" >&2; exit 2 ;;
esac

step() { printf '\n==> %s\n' "$*"; }
fail() { echo "SMOKE TEST FAILED: $*" >&2; exit 1; }

step "Building contract WASM and CLI"
cargo rustc --manifest-path contracts/trellis_core/Cargo.toml \
  --crate-type=cdylib --target=wasm32-unknown-unknown --release >/dev/null
cargo build --release --manifest-path cli/trellis_cli/Cargo.toml >/dev/null
TRELLIS="$PWD/target/release/trellis"

step "Creating funded throwaway identities"
SUFFIX=$(date +%s)
for role in payer payee resolver; do
  stellar keys generate "smoke-$role-$SUFFIX" --network "$NETWORK" --fund >/dev/null 2>&1
done
addr() { stellar keys address "smoke-$1-$SUFFIX"; }

step "Deploying contract"
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/trellis_core.wasm \
  --source "smoke-payer-$SUFFIX" --network "$NETWORK" | tail -1)
TOKEN=$(stellar contract id asset --asset native --network "$NETWORK")
echo "contract: $CONTRACT_ID"

export TRELLIS_CONTRACT_ID="$CONTRACT_ID"
export TRELLIS_PAYER_KEY="smoke-payer-$SUFFIX"
export TRELLIS_PAYEE_KEY="smoke-payee-$SUFFIX"
export TRELLIS_RESOLVER_KEY="smoke-resolver-$SUFFIX"
export TRELLIS_NO_HISTORY=1
AID=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')

step "Lifecycle: init -> lock -> submit -> approve (2 milestones)"
"$TRELLIS" --as payer init --agreement-id "$AID" --payer "$(addr payer)" \
  --payee "$(addr payee)" --token "$TOKEN" --resolver "$(addr resolver)" \
  --milestones "1000,2000" -y
for m in 0 1; do
  "$TRELLIS" --as payer lock-funds --agreement-id "$AID" --milestone-id "$m" -y
  "$TRELLIS" --as payee submit-work --agreement-id "$AID" --milestone-id "$m" \
    --proof-uri "https://example.com/proof/$m" -y
  "$TRELLIS" --as payer approve-release --agreement-id "$AID" --milestone-id "$m" -y
done

step "Read-back (same get_agreement path the frontend uses)"
OUT=$("$TRELLIS" --json status --agreement-id "$AID")
echo "$OUT"
COMPLETED=$(grep -o '"Completed"' <<<"$OUT" | wc -l | tr -d ' ')
[ "$COMPLETED" -eq 2 ] || fail "expected 2 Completed milestones, found $COMPLETED"
# Adjacent regression guard: proof URIs must survive the round trip.
grep -q 'example.com/proof/0' <<<"$OUT" || fail "proof_uri not returned by status"

step "SMOKE TEST PASSED ($NETWORK, contract $CONTRACT_ID)"
