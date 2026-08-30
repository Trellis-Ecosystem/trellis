#!/usr/bin/env bash
#
# Mock stellar CLI binary for CLI integration testing.
#
# This script simulates the stellar CLI's contract invocation responses based
# on the command arguments, enabling comprehensive CLI tests without a live
# Soroban network or deployed contract.
#
# Usage (from test code):
#   TRELLIS_TEST_MODE=true STELLAR_MOCK_BIN=./tests/mock_stellar.sh cargo test
#
# The CLI checks TRELLIS_TEST_MODE and swaps the real stellar binary for this
# mock when the env var is set.

set -euo pipefail

# Parse command-line arguments to determine which mock response to return
if [[ "${1:-}" == "--version" ]]; then
    echo "stellar 22.0.0 (mock)"
    exit 0
fi

if [[ "${1:-}" == "contract" ]] && [[ "${2:-}" == "invoke" ]]; then
    # Extract function name from remaining args
    FUNC_NAME=""
    for arg in "$@"; do
        if [[ "$arg" == "--" ]]; then
            shift
            FUNC_NAME="${1:-}"
            break
        fi
        shift
    done

    case "$FUNC_NAME" in
        init)
            # Successful init — no output, exit 0
            exit 0
            ;;
        get_agreement)
            # Return a minimal JSON agreement structure
            cat <<'EOF'
{
  "agreement_id": "0000000000000000000000000000000000000000000000000000000000000001",
  "payer": "GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW",
  "payee": "GZYXWVUTSRQPONMLKJIHGFEDCBA234567ZYXWVUTSRQPONMLKJIHGF",
  "token": "CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "milestones": [
    {
      "id": 0,
      "amount": "1000",
      "status": "Pending",
      "proof_uri": null
    }
  ],
  "dispute_resolver": "GRESOLVABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNO",
  "total_amount": "1000"
}
EOF
            exit 0
            ;;
        lock_funds)
            # Simulate successful lock_funds
            exit 0
            ;;
        submit_work)
            # Simulate successful submit_work
            exit 0
            ;;
        approve_and_release)
            # Simulate successful approve_and_release
            exit 0
            ;;
        raise_dispute)
            # Simulate successful raise_dispute
            exit 0
            ;;
        resolve_dispute)
            # Simulate successful resolve_dispute
            exit 0
            ;;
        cancel_unfunded_milestone)
            # Simulate successful cancel
            exit 0
            ;;
        get_total_amount)
            echo "1000"
            exit 0
            ;;
        *)
            echo "Error: unknown function '$FUNC_NAME'" >&2
            exit 1
            ;;
    esac
fi

# Default: unknown command
echo "Error: mock stellar binary received unexpected arguments: $*" >&2
exit 1
