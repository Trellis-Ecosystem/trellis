# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Bug Fixes

- Remove redundant milestone clones (8af47e7)

- Remove unreachable NotDisputeResolver error variant (5b4be66)

- Emit a distinct milestone_cancelled event for cancellations (021a20e)

- Extend persistent storage TTL to prevent agreement data loss (682fe7b)

- Type proof_uri as Option<String> instead of an empty-string sentinel (5c36539)

- Extend persistent storage TTL to prevent agreement data loss (137734e)

- Resolve duplicate extend_agreement_ttl merge artifact (34a18d6)

- Pin soroban-sdk to explicit semver range, commit Cargo.lock (1c97766)

- Return InvalidStateTransition when cancelling non-pending milestone (18702c2)

- Validate positive milestone amounts, pre-compute total_amount (ca65b9c)

- Fix broken TTL renewal blocking compilation (8aa6db1)

- Reject empty milestones and resolver/party conflicts on init (8477a8d)

- Include dispute raiser identity in dispute_raised event (395417d)

- Add #[non_exhaustive] to EscrowStatus for forward compatibility (e7b0f13)

- Migrate event emissions to typed Soroban event data for indexer-friendly decoding (e0e26e8)

- Migrate milestone amount parsing from u64 to i128 matching contract type (38bb820)

- Fix compile errors in events.rs and lib.rs (4ebda3b)

- Add negative tests for approve_and_release on all invalid milestone states (b5cdea3)

- Add multi-milestone agreement test verifying per-milestone state isolation (9e9a4b3)

- Add tests verifying zero-amount milestone rejection in init entrypoint (52a0be7)

- Add comprehensive test coverage for payer-dispute, auth enforcement, payee-wins resolution, and invalid submit_work states (7c4d3cd)

- Batch accessibility and animation fixes #86 #87 #88 #89 (3b1b252)

- Optimize NetworkBackground, real TVL, runtime XDR topics, RPC error visibility (b3f48ae)

- Eliminate per-frame allocations, consolidate design tokens, fix FOUT, and enforce consistent timestamps (d692911)

- Fix race condition, batch renders, extract SVG icons, wire CTA buttons (4fc9a13)

- Namespace all event topics with trlls_ prefix to prevent cross-contract collisions (a66b3fb)

- Validate all env vars at startup instead of silently defaulting to UNSET_ values (5c00d97)

- Eliminate shell injection and replace fragile manual argument quoting (d700242)

- Replace process::exit(1) with Result-based error propagation for graceful cleanup (d0850f9)

- Wallet a11y states, SPA fallback routing, and semantic versioning (6fedbe1)

- Scope cursor blink keyframe, add stable step keys, recalibrate particles on resize, add typing stall recovery (2a3c8f5)

- Resolve issues #82, #83, #84, #85 — error boundary, env validation, dynamic wallet import, smooth counter animation (e47619d)

- Validate agreement_id, decode CLI output safely, add version metadata, populate utils.rs (c49d1d5)

- Add issue/PR templates, frontend README, and testnet reset docs (f0cde52)

- Resolve issues #126, #123, #128, #129 — credential exposure, tx status indicator, readme audit, build automation (360fbb8)

- Merge diverged feat/frontend-scaffold into master for unified codebase (90c4576)

- Add CI validation for test snapshots to prevent silent drift (f503d21)

- Prevent silent integer wraparound and enforce token liveness validation (8bc1ae9)

- Wire config validation, document STELLAR_RPC_RETRIES, hoist ANSI consts, correct RpcClient docs (66c37c9)

- Remove unused deps, add config/render/secret-key tests, and unblock the build (b61d646)

- Resolve four frontend issues across wallet, clipboard, gas retry, and timestamp handling (1c169ba)

- Validate all user-supplied input before forwarding to the Stellar CLI (76bc0a9)

- Wire CreateAgreementPage into /create route replacing broken CreatePage stub (12d10cf)

- Differentiate Ed25519 and contract address validation in CreateAgreementPage form (fc453ff)

- Add entity type differentiation to ExplorerLink fixing 404 links for agreement IDs in history page (52c83d3)

- Fix stale closure in StatusPage useEffect by adding missing dependency on initialId (e5f9a2a)

- Replace button elements with semantic Link elements for navigation in HomePage feature cards (#277) (84d781b)

- Add aria-hidden to decorative NetworkBackground canvas to improve screen reader experience (#278) (b3ac00b)

- Consolidate duplicate body CSS rules in index.css to fix light theme styling conflicts (#279) (1ddb46a)

- Replace string-based step icons in HowItWorks with SVG components matching other steps (67c9971)

- Handle invalid lastViewed dates in history.ts by preserving entries instead of silently evicting them (f5e87f9)

- Improve WalletContext wrong-network detection with retry logic (f6a0d36)

- Robust process-output decoding and tighter transient-error detection (4c19951)

- Implement real agreement query in StatusPage replacing broken throw-based stub (664a6c7)

- Resolve undefined error messages, remove legacy wallet wrapper, complete light theme, and expand ExplorerLink tests (92c05f5)

- Pin Rust toolchain, fix gitignore, remove stale workflow (0bdeb23)

- Wallet error boundary, network bg resize debounce, dead error variant, mocked test auth (cba2e20)

- Wire AgreementStatusPage, remove dead router/soroban, fix BigInt conversion (44e2d28)

- Guard initial state updates in useAgreementEvents to prevent memory leak (43602e7)

- Add validation for MilestoneBuilder (33fc3b7)

- Add browser compatibility for AbortSignal.timeout() (7119ca8)

- Prevent infinite loop in useCountUp with NaN input (8e2e4da)

- Reproducible builds and release version validation (034c05c)

- Fix compilation error, error propagation, address validation, and tx hash extraction (ea9e5db)

- Enforce payer != payee invariant during agreement initialization (6ab2c9c)

- Cap maximum milestone count to prevent unbounded storage and gas cost (30c7ddd)

- Normalize empty-string proof_uri to None in submit_work to eliminate semantic ambiguity (731f3f3)

- Replace module-level env validation with lazy initialization to prevent app-wide crash on missing env vars (7491b71)

- Add missing ExplorerLink import in StatusPage to resolve compilation error (49bf88f)

- Define APP_VERSION global in vite.config.ts to resolve undefined version at runtime (f13ebb3)

- Replace Buffer.from hex decoding with browser-compatible hexToBytes utility across 6 call sites (acddf8a)

- Define skeleton-shimmer CSS, pause NetworkBackground on tab hide, remove QR privacy leak, fix handleRetry promise handling (86da722)

- Fix event polling, abort signals, toast re-renders, and hook loading states (8199f8b)

- Fix verbatimModuleSyntax, CSS class space, hex validation, and wallet null assertion (c25f6d9)

- Adaptive wallet polling, tab-visibility-aware stats polling, QR canvas fallback, and StrictMode ref-cleanup hygiene (17f94bb)


### CI

- Add GitHub Actions workflow for the frontend (a7a3a4a)

- Add advanced testing pipeline with property tests, gas benchmarks, and mutation testing (7626590)


### Documentation

- Add testnet deployment guide (6e53b9c)

- Add CONTRIBUTING.md with full contributor onboarding guide (f3aa384)

- Update contract test roster (dac21db)

- Fix event topic strings in events.rs to match actual symbol_short values (343deb8)


### Features

- Testnet deployment verified (21c473a)

- Scaffold React + Vite + TypeScript + Tailwind base project (ea98489)

- Replace static background with animated canvas particle network (7ee384f)

- Add live stats bar, 3D gradient SVG icons, typing animation and scroll reveal (1e15ac0)

- Add frontend GitHub Actions workflow (6b731a0)

- Add React Router and page navigation structure (464c4aa)

- Add loading skeleton components for async states (2eeadca)

- Add toast notification system for transaction feedback (380249c)

- Build Agreement History page (dd4e9dc)

- Add mobile responsive layout for all pages (7c4c842)

- Build Agreement Status page, Create Agreement form, and Milestone actions (b47ef55)

- Add dark/light mode toggle to navbar (a38cc7a)

- Add copy-to-clipboard on all truncated addresses (d35ce7f)

- Add Agreement ID generator utility with QR code display (4720c72)

- Add Stellar Expert explorer deep links throughout the UI (5b01072)

- Add Freighter wallet connect/disconnect with network guard (d83cd40)

- Add batch milestone funding entrypoint for multi-milestone gas efficiency (e171d84)

- Add granular get_milestone view function for per-milestone queries (5c4c8d3)

- Add property-based invariant tests for core escrow state machine (3c0f3ab)

- Add retry with exponential backoff for transient RPC failures (040fdfb)

- Add .env file loading for ergonomic environment configuration (ca536cc)

- Add --json, --dry-run, --human-readable output modes and shell completions (6ff16b1)

- Network selector, list-milestones, and confirmation prompts; fix(frontend): contract stats config guard (8d14fd0)

- Add agreement detail, milestone actions, and event feed components (52bd1e8)

- Add dark/light theme support with React Router integration (e2bdc2c)

- Integrate Stellar Expert links, CopyButton, LICENSE, and lockfile tracking (722463e)

- Add Agreement History page with localStorage persistence for quick access (acc5998)

- Add contract CI, Dependabot config, and finish CI/contributing docs (b426e67)

- Add security policy, code of conduct, and release automation (bba7962)

- Add agreement ID generator with QR code for cross-party sharing (8bb0ed8)

- Implement event data parsing in useAgreementEvents to decode on-chain event payloads (e1ef143)

- Add supply-chain security hardening across all layers (62f6ad2)

- #287 - Fix App.test.tsx environment variable loading (753520a)


### Refactor

- Comprehensive milestone and event improvements (4c8a2e7)

- Eliminate any type usage across frontend with proper TypeScript interfaces and type guards for RPC responses (#276) (8e8cc33)

- Remove unused Layout component that is never imported or rendered (87f31d0)


### Testing

- Verify lock-funds, submit-work, approve-release, raise-dispute, and resolve-dispute end-to-end on testnet; feat: prepare native Rust Soroban RPC client (eceed7b)

- Set up Vitest + React Testing Library and add unit tests (1dba7cc)

- Regenerate snapshot fixtures (59e1ae9)

- Fix contract auth mocking and add MSW for frontend tests (15edcaf)

- Add integration tests for get_total_amount and extend_agreement_ttl + dispute raised by payer; fix(cli): define confirm_action and add yes parameter (cfd50f9)

- Property-based fuzzing, CLI+contract integration, full E2E journey, and mobile-responsive layout (#141, #142, #143, #120) (a826d29)

- Fix Navbar.test.tsx link validation (4c3abae)

- Add comprehensive unit test coverage for frontend components (25f488d)

- Cover comma + mixed-whitespace edge cases in milestones CSV parsing (646d13f)


### Build

- Bump actions/download-artifact from 4 to 8 (e6c97fe)

- Bump actions/setup-node from 4 to 7 (7e54254)

- Bump actions/checkout from 4 to 7 (f61f3fe)

- Bump actions/upload-artifact from 4 to 7 (f6dd07b)

- Bump softprops/action-gh-release from 2 to 3 (8a67762)

- Bump reqwest from 0.11.27 to 0.13.4 (92b86ff)


### Security

- Add key management, SAST scanning, audit workflow, and RPC rate limiting (770bd78)

- Add dependency scanning, input limits, RPC URL validation, and panic-boundary tests (3ec7dcc)


### Style

- Apply consistent formatting across frontend components (placeholder)


