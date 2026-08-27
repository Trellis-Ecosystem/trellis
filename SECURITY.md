# Security Policy

Trellis is a smart contract that locks and moves real funds on Stellar's
Soroban platform. Vulnerabilities can directly result in loss of escrowed
funds, so we take security reports seriously and ask that they be disclosed
responsibly.

## Supported Versions

Only the current major version of the contract and CLI receives security
fixes. Older major versions are considered end-of-life.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**
Publicly disclosing a vulnerability before a fix is available puts funds
held by the live contract at risk.

Instead, report it privately using one of these channels:

1. **Preferred:** Use GitHub's private vulnerability reporting for this
   repository — go to the **Security** tab → **Report a vulnerability**.
   This opens a private advisory visible only to maintainers.
2. **Email:** if you cannot use GitHub's reporting tool, email
   **talk2izeek@gmail.com** with a description of the issue, steps to
   reproduce, and its potential impact. Encrypt sensitive details if
   possible.

Please include as much of the following as you can:

- A clear description of the vulnerability and its impact (e.g. fund loss,
  unauthorized state transition, denial of service).
- Steps to reproduce, or a minimal proof-of-concept (e.g. a failing test
  against `contracts/trellis_core`).
- The affected version/commit.

### What to expect

- **Acknowledgement:** within 3 business days of your report.
- **Initial assessment:** within 7 days, including a severity classification
  and expected timeline for a fix.
- **Disclosure:** we will coordinate a disclosure date with you once a fix
  is released. Credit is given to reporters unless they prefer to remain
  anonymous.

### Severity classification and fix timelines

| Severity | Description                                                        | Target fix time |
| -------- | ------------------------------------------------------------------ | ---------------- |
| Critical | Direct loss/theft of escrowed funds, or bypass of access control    | 24–72 hours       |
| High     | State corruption, permanent fund lock, or dispute-flow bypass       | 7 days            |
| Medium   | Incorrect behavior without direct fund impact, denial of service    | 30 days           |
| Low      | Minor issues, best-practice deviations, non-exploitable edge cases  | Best effort       |

## Dependency & supply-chain monitoring

Every push and pull request runs a `supply-chain` CI job that scans the full
Rust crate graph with `cargo deny` (policy in [`deny.toml`](./deny.toml)) and
`cargo audit`. The build fails on any known RustSec advisory, a yanked crate,
a licence outside the permissive allowlist, or a dependency sourced from an
unexpected registry. Duplicate crate versions are surfaced as warnings for
review. To reproduce locally:

```bash
cargo install --locked cargo-deny cargo-audit
cargo deny check
cargo audit
```

## Hall of Fame

We're grateful to the following researchers for responsibly disclosing
security issues:

_No reports yet — be the first!_
