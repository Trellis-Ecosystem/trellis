# #694 — Semgrep Soroban rules: two can never match, one is likely invalid, none are tested

**Area:** `.semgrep/soroban-rules.yaml` · **Type:** CI / static-analysis bug

## Problem

`.semgrep/soroban-rules.yaml` defines four rules:

| Rule | Lines | Issue |
|---|---|---|
| `unchecked-auth` | 2-10 | Writes `!Address::require_auth(...)` inside `<... ...>`. Semgrep has no `!` negation operator, so this matches the literal expression `!Address::require_auth(..)`, which never appears in the code. Negation needs `pattern-not` / `pattern-not-inside`. |
| `unchecked-panic` | 12-17 | Matches `panic!($MSG)`, but the contract sources contain no `panic!(` (CONTRIBUTING.md forbids it). The rule cannot fire on current code, and it misses the real panic sources: `.unwrap()`, `.expect()`, `panic_with_error!`. |
| `arithmetic-overflow` | 19-26 | Works, but flags every `+`, `-` and `*` at INFO level. That is mostly noise. |
| `unsafe-contract-call` | 28-33 | Matches `Address::from_contract_id(&env, &contract_id)`. In soroban-sdk 22.0.11 that function is `pub(crate)` (`src/address.rs:345`), so contract code cannot call it. It also only matches those exact variable names. |

There are no `semgrep --test` fixtures, so nothing shows that any rule fires.

## Fix

1. Run `semgrep --validate --config .semgrep/` and fix anything it reports.
2. Rewrite the rules to match patterns that occur in Soroban code:

```yaml
rules:
  - id: entrypoint-missing-require-auth
    message: Public contract entrypoint that writes storage without calling require_auth
    severity: WARNING
    languages: [rust]
    patterns:
      - pattern-inside: |
          #[contractimpl]
          impl $C { ... }
      - pattern: |
          pub fn $FUNC(...) { ... }
      - pattern: |
          pub fn $FUNC(...) { ... $ENV.storage().$KIND().set(...); ... }
      - pattern-not: |
          pub fn $FUNC(...) { ... $ADDR.require_auth(); ... }
      - pattern-not: |
          pub fn $FUNC(...) { ... $ADDR.require_auth_for_args(...); ... }

  - id: unwrap-in-contract
    message: unwrap()/expect() aborts the contract with an opaque error; return a ContractError instead
    severity: WARNING
    languages: [rust]
    patterns:
      - pattern-either:
          - pattern: $X.unwrap()
          - pattern: $X.expect(...)
      - pattern-not-inside: |
          #[cfg(test)]
          mod $M { ... }

  - id: raw-panic
    message: Use panic_with_error!/ContractError instead of panic!
    severity: WARNING
    languages: [rust]
    pattern: panic!(...)

  - id: unchecked-arithmetic-on-amounts
    message: Use checked_add/checked_sub/checked_mul on token amounts
    severity: INFO
    languages: [rust]
    patterns:
      - pattern-either:
          - pattern: $A + $B
          - pattern: $A - $B
          - pattern: $A * $B
      - metavariable-regex:
          metavariable: $A
          regex: (?i).*(amount|balance|total|funds).*

  - id: cross-contract-call
    message: Cross-contract call - verify the target address is trusted (stored at init, not caller-supplied)
    severity: WARNING
    languages: [rust]
    pattern-either:
      - pattern: token::Client::new($ENV, $ADDR)
      - pattern: token::TokenClient::new($ENV, $ADDR)
      - pattern: $ENV.invoke_contract(...)
```

Adjust the storage and auth patterns to match how `contracts/trellis_core/src/lib.rs`
is written. For example, if auth goes through a helper, add another
`pattern-not` for that helper. `raw-panic` stays as a cheap guard for the
CONTRIBUTING.md rule.

3. Add test fixtures next to the rules. Semgrep pairs `soroban-rules.yaml`
   with `soroban-rules.rs`:

```rust
// .semgrep/soroban-rules.rs
#[contractimpl]
impl Fixture {
    // ruleid: entrypoint-missing-require-auth
    pub fn bad_set(env: Env, a: Address) {
        env.storage().persistent().set(&a, &1u32);
    }

    // ok: entrypoint-missing-require-auth
    pub fn good_set(env: Env, a: Address) {
        a.require_auth();
        env.storage().persistent().set(&a, &1u32);
    }
}

fn unwraps(x: Option<u32>) -> u32 {
    // ruleid: unwrap-in-contract
    x.unwrap()
}

fn panics() {
    // ruleid: raw-panic
    panic!("boom");
}

fn math(amount: i128, fee: i128) -> i128 {
    // ruleid: unchecked-arithmetic-on-amounts
    let a = amount + fee;
    // ok: unchecked-arithmetic-on-amounts
    let b = amount.checked_add(fee).unwrap_or(0); // (unwrap flagged separately)
    a + b
}

fn calls(env: Env, token: Address) {
    // ruleid: cross-contract-call
    let c = token::Client::new(&env, &token);
}
```

4. Add both commands to the CI job that runs Semgrep:

```bash
semgrep --validate --config .semgrep/
semgrep --test .semgrep/
```

## Verification

```bash
pip install semgrep            # or: brew install semgrep
semgrep --validate --config .semgrep/
semgrep --test .semgrep/       # every rule: at least one ruleid hit, all ok lines clean
semgrep --config .semgrep/ contracts/   # review real findings; triage or fix
```

## Done when

`semgrep --validate --config .semgrep/` passes, and `semgrep --test .semgrep/`
shows every rule matched by at least one positive (`// ruleid:`) fixture.
