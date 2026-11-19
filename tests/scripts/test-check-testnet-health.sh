#!/usr/bin/env bash
# Regression tests for scripts/check-testnet-health.sh env validation (#810).
# A missing required env var must fail fast with a clear error and exit code 2,
# not crash with "unbound variable" and fall through to the inconclusive (1)
# branch that the workflow treats as a flaky RPC.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/check-testnet-health.sh"

fail=0
pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1"; fail=$((fail + 1)); }

run_missing() {
  local var="$1"
  local out status
  if [[ "$var" == "TRELLIS_CONTRACT_ID" ]]; then
    out=$(env -u TRELLIS_CONTRACT_ID TRELLIS_SOURCE_KEY=test-probe TRELLIS_BIN=/bin/true bash "$SCRIPT" 2>&1)
  else
    out=$(env -u TRELLIS_SOURCE_KEY TRELLIS_CONTRACT_ID=CBTESTCONTRACT TRELLIS_BIN=/bin/true bash "$SCRIPT" 2>&1)
  fi
  status=$?
  if [[ $status -eq 2 ]]; then
    pass "$var missing -> exit 2"
  else
    fail "$var missing -> expected exit 2, got $status (output: $out)"
  fi
  if [[ "$out" == *"$var"* && "$out" == *"must be set"* ]]; then
    pass "$var missing -> clear error message"
  else
    fail "$var missing -> expected clear '$var must be set' message, got: $out"
  fi
}

echo "==> check-testnet-health.sh env validation"
run_missing TRELLIS_CONTRACT_ID
run_missing TRELLIS_SOURCE_KEY

# The healthy path must still work when all required vars are set.
out=$(TRELLIS_CONTRACT_ID=CBTESTCONTRACT TRELLIS_SOURCE_KEY=test-probe \
  TRELLIS_BIN=/bin/true bash "$SCRIPT" 2>&1)
status=$?
if [[ $status -eq 0 ]]; then
  pass "all vars set with healthy stub -> exit 0"
else
  fail "all vars set with healthy stub -> expected exit 0, got $status (output: $out)"
fi

if [[ $fail -ne 0 ]]; then
  echo "$fail test(s) failed"
  exit 1
fi
echo "all tests passed"
exit 0
