# Issue #678 — Add Unit Tests for `amountToStroops` and `buildInitArgs`

**Issue:** [#678](https://github.com/Trellis-Ecosystem/trellis/issues/678)  
**Branch:** `feat/unit-tests-amountToStroops-buildInitArgs`  
**Scope:** `frontend/src/pages/CreateAgreementPage.tsx` (lines 40–80), `frontend/src/pages/CreateAgreementPage.test.tsx`

---

## Background

`amountToStroops` and `buildInitArgs` are exported from `CreateAgreementPage.tsx` and are the only code that converts user input into the `i128` value submitted to the contract's `init` entrypoint. Despite being the critical amount-encoding path, no test file references either function: a `grep` over `src/` finds them only in the source module itself, and `CreateAgreementPage.test.tsx` never inspects the encoded arguments.

This means regressions in the following areas would ship silently:

- **7-decimal padding** — `"100"` must produce `1000000000n`, not `100n`.
- **8th-decimal rejection** — `"1.12345678"` must throw.
- **Whitespace tolerance** — `" 5 "` (leading/trailing spaces) must succeed.
- **Argument order in `buildInitArgs`** — the contract's `init` signature is `(agreement_id, payer, payee, token, milestones, dispute_resolver)`; a transposed argument silently passes simulation but fails on-chain auth.
- **Milestone map key order** — `amount / proof_uri / status` must be sorted, as the XDR encoder is order-sensitive for maps.

---

## Current State

### `amountToStroops` (lines 40–58)

```typescript
// frontend/src/pages/CreateAgreementPage.tsx
export function amountToStroops(amount: string): bigint {
  const trimmed = amount.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount: "${trimmed}" is not a valid positive number.`)
  }

  const [intPart, fracPart = ''] = trimmed.split('.')
  const DECIMALS = 7

  if (fracPart.length > DECIMALS) {
    throw new Error(
      `Invalid amount: "${trimmed}" has more than ${DECIMALS} decimal places.`
    )
  }

  const paddedFrac = fracPart.padEnd(DECIMALS, '0')
  return BigInt(intPart + paddedFrac)
}
```

### `buildInitArgs` (lines 60–80)

```typescript
export function buildInitArgs(
  agreementId: string,
  formData: FormData,
  milestones: MilestoneInput[],
): xdr.ScVal[] {
  const milestoneScVals = milestones.map((m) =>
    milestoneToScVal({
      amount: amountToStroops(m.amount),
      status: 'Pending',
      proof_uri: null,
    })
  )

  return [
    agreementIdToScVal(agreementId),
    nativeToScVal(formData.payer.trim(), { type: 'address' }),
    nativeToScVal(formData.payee.trim(), { type: 'address' }),
    nativeToScVal(formData.token.trim(), { type: 'address' }),
    xdr.ScVal.scvVec(milestoneScVals),
    nativeToScVal(formData.resolver.trim(), { type: 'address' }),
  ]
}
```

### Existing test file

`CreateAgreementPage.test.tsx` renders the page component and asserts UI text; it imports neither `amountToStroops` nor `buildInitArgs`.

---

## Required Changes

### Add `amountToStroops` tests

Create a `describe('amountToStroops', ...)` block covering:

| Input | Expected output | Rationale |
|---|---|---|
| `'100'` | `1000000000n` | Whole-number, 7-decimal padding |
| `'0.0000001'` | `1n` | Minimum representable value |
| `'100.5'` | `1005000000n` | Fractional, partial padding |
| `' 5 '` | `50000000n` | Whitespace trimmed before parsing |
| `''` | throws | Empty string is not a number |
| `'-1'` | throws | Negative values fail the regex |
| `'1e3'` | throws | Scientific notation not accepted |
| `'1.'` | throws | Trailing dot fails the regex (`\d+(\.\d+)?` requires at least one digit after the dot) |
| `'1.12345678'` | throws | Eight decimal places exceed the 7-decimal limit |

The test suite must remain green if `DECIMALS` changes — test the relationship, not a hardcoded constant. One approach is to assert that `amountToStroops('1') === 10n ** 7n`.

### Add `buildInitArgs` tests

Create a `describe('buildInitArgs', ...)` block that:

1. Calls `buildInitArgs` with a known `agreementId`, `formData`, and one milestone.
2. Asserts the returned array has exactly **six** elements.
3. Asserts argument position `4` is an `ScVal` vector (`scvVec`) — the milestones array.
4. Asserts argument position `5` holds the resolver, not the token (guards against transposition).
5. For the milestone `ScVal`, inspects the `ScMap` to confirm:
   - Keys are `amount`, `proof_uri`, `status` in that (sorted) order.
   - `amount` encodes the expected stroops value as an `i128`.
   - `status` encodes `{Pending: null}`.
   - `proof_uri` encodes `{None: null}` (or the Option-None variant the SDK produces).

Mocking `nativeToScVal` and the Soroban SDK is acceptable if keeping the test unit-scoped; alternatively, use the real SDK and assert on `scValToNative` output.

---

## Files Affected

| File | Change |
|---|---|
| `frontend/src/pages/CreateAgreementPage.test.tsx` | Add `amountToStroops` and `buildInitArgs` test suites (import the exported functions directly). |

No production code changes are required.

---

## Done When

- The new tests pass with `npm test` (Vitest).
- Changing `DECIMALS` from `7` to `6` causes the padding tests to fail.
- Swapping argument positions 4 and 5 in `buildInitArgs` causes the argument-order test to fail.
- Changing milestone key order from `amount / proof_uri / status` to any other order causes the map-key-order test to fail.

---

## Verification Steps

```bash
cd frontend
npm test -- --run CreateAgreementPage
```

All tests in `CreateAgreementPage.test.tsx` pass.

Mutation verification (manual):

1. In `amountToStroops`, change `const DECIMALS = 7` to `6` — the `'100'` → `1000000000n` test fails.
2. In `buildInitArgs`, swap the positions of `nativeToScVal(formData.token…)` and `nativeToScVal(formData.resolver…)` — the argument-order test fails.
3. In `milestoneToScVal`, change key insertion order — the map-key-order test fails.

---

## Commit Message

```
test(frontend): add unit tests for amountToStroops and buildInitArgs

Cover decimal padding, 8th-decimal rejection, whitespace trimming,
invalid input shapes, six-argument contract order, and sorted milestone
map keys. Any regression in the i128 encoding path now produces an
immediate test failure.

Closes #678
```
