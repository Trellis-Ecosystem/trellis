# Trellis Protocol — Build Automation
#
# Available targets:
#   make help          — list all targets
#   make build         — build everything (contract WASM + frontend)
#   make test          — run all tests (contract + frontend)
#   make lint          — run all linters (clippy + oxlint)
#   make deploy        — deploy contract to testnet (see DEPLOYMENT.md)
#   make clean         — remove all build artifacts
#   make build-contract — build only the contract WASM
#   make build-cli     — build only the CLI binary
#   make build-frontend — build only the frontend bundle
#   make test-contract — run only contract tests
#   make test-snapshots-update — regenerate Soroban test snapshots (commit the result)
#   make test-frontend — run only frontend tests
#   make lint-contract — run only clippy on contract and CLI
#   make lint-frontend — run only oxlint on frontend

.PHONY: help build test lint deploy clean
.PHONY: build-contract build-cli build-frontend
.PHONY: test-contract test-snapshots-update test-frontend
.PHONY: lint-contract lint-frontend

help:
	@echo "Trellis Protocol — Build Targets"
	@echo ""
	@grep -E '^[a-z-]+:' $(MAKEFILE_LIST) | sort | while IFS=: read -r target _; do \
		desc=$$(grep -A1 "^$$target:" $(MAKEFILE_LIST) | tail -1 | sed 's/# //'); \
		printf "  %-20s %s\n" "$$target" "$$desc"; \
	done

# ── Build ──────────────────────────────────────────────────────────────────

build: build-contract build-cli build-frontend

build-contract:
	cargo build --manifest-path contracts/trellis_core/Cargo.toml --target wasm32-unknown-unknown --release

build-cli:
	cargo build --manifest-path cli/trellis_cli/Cargo.toml --release

build-frontend:
	cd frontend && npm install && npm run build

# ── Test ───────────────────────────────────────────────────────────────────

test: test-contract test-frontend

test-contract:
	cargo test --manifest-path contracts/trellis_core/Cargo.toml

test-snapshots-update:
	SOROBAN_TEST_SNAPSHOT_FILE=overwrite cargo test --manifest-path contracts/trellis_core/Cargo.toml
	@echo "Snapshots regenerated. Review the diff with: git diff contracts/trellis_core/test_snapshots/"

test-frontend:
	cd frontend && npm install && npm test

# ── Lint ───────────────────────────────────────────────────────────────────

lint: lint-contract lint-frontend

lint-contract:
	cargo clippy --manifest-path contracts/trellis_core/Cargo.toml -- -D warnings
	cargo clippy --manifest-path cli/trellis_cli/Cargo.toml -- -D warnings

lint-frontend:
	cd frontend && npm install && npm run lint

# ── Deploy ─────────────────────────────────────────────────────────────────

deploy:
	@echo "=== Deploying Trellis to Stellar Testnet ==="
	@echo "Ensure you have:"
	@echo "  1. A funded testnet identity: stellar keys fund <name> --network testnet"
	@echo "  2. The contract WASM built: make build-contract"
	@echo ""
	@echo "Running: stellar contract deploy ..."
	stellar contract deploy \
		--wasm target/wasm32-unknown-unknown/release/trellis_core.wasm \
		--source trellis-deployer \
		--network testnet

# ── Clean ──────────────────────────────────────────────────────────────────

clean:
	cargo clean
	cd frontend && rm -rf dist node_modules
	rm -rf target