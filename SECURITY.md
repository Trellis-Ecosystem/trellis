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

## Handling the CLI source key

The `trellis` CLI needs a signing key (`TRELLIS_SOURCE_KEY`). It accepts
either form:

- **A named `stellar keys` identity** (e.g. `alice`) — **recommended**. The
  secret never leaves the Stellar keystore; only the identity name is passed
  to the `stellar` binary.
- **A raw `S…` secret seed** — supported, but handled defensively:
  - The seed is **never placed on a command line**. Passing it as
    `stellar contract invoke --source S…` would expose it to every local
    user via `ps` / `/proc/<pid>/cmdline`. Instead the CLI hands it to the
    child `stellar` process through the `STELLAR_SECRET_KEY` environment
    variable, and `--dry-run` / error output prints `STELLAR_SECRET_KEY=<redacted>`.
  - Prefer `--source-key-file <path>` (or `TRELLIS_SOURCE_KEY_FILE`) over an
    exported `TRELLIS_SOURCE_KEY`, so the seed lives only in a file you
    control (ideally mode `0600`) and never in your shell history or the
    parent process's environment.
  - The CLI prints a warning when it detects a raw seed.

## Hall of Fame

We're grateful to the following researchers for responsibly disclosing
security issues:

_No reports yet — be the first!_
