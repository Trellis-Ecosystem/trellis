#!/usr/bin/env bash
# scripts/install-hooks.sh
#
# One-time setup: configure Git to use the .githooks/ directory in this repo.
# Run this once after cloning:
#
#   ./scripts/install-hooks.sh
#
# This is equivalent to:
#
#   git config core.hooksPath .githooks
#
# The hooks then run automatically on every `git commit`.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="${REPO_ROOT}/.githooks"

if [[ ! -d "${HOOKS_DIR}" ]]; then
  echo "ERROR: .githooks/ directory not found at ${HOOKS_DIR}" >&2
  exit 1
fi

git -C "${REPO_ROOT}" config core.hooksPath .githooks
echo "✓ Git hooks installed. Hooks directory: ${HOOKS_DIR}"
echo ""
echo "Hooks that will run on 'git commit':"
for hook in "${HOOKS_DIR}"/*; do
  echo "  - $(basename "${hook}")"
done
echo ""
echo "Optional: install gitleaks for full secret scanning:"
echo "  https://github.com/gitleaks/gitleaks#installing"
