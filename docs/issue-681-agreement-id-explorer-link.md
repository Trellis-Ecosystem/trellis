# Issue #681 — `AgreementDetail` Links the Agreement ID to a Non-Existent Stellar Expert Page

**Issue:** [#681](https://github.com/Trellis-Ecosystem/trellis/issues/681)  
**Branch:** `fix/agreement-id-not-an-explorer-contract`  
**Scope:** `frontend/src/components/AgreementDetail.tsx` (line 22), `frontend/src/components/AgreementDetail.test.tsx`

---

## Background

`AgreementDetail.tsx` renders the agreement ID row as:

```tsx
<ExplorerLink type="contract" value={agreement.agreement_id} />
```

This produces a Stellar Expert URL of the form:

```
https://stellar.expert/explorer/testnet/contract/<64 hex chars>
```

The agreement ID is a `BytesN<32>` storage key inside the Trellis escrow contract. It is **not** a Stellar contract address. Stellar Expert has no record for it, so the link navigates to a 404 or empty page.

`explorer.ts` already accounts for this: the `ExplorerEntity` type includes `'agreement'` specifically to signal that no explorer link exists for this kind of ID, and `explorerUrl` returns `null` for it. `StatusPage.tsx` (line 168) correctly passes `type="agreement"` to `ExplorerLink`, which then renders nothing. `AgreementDetail.tsx` does not follow the same pattern.

---

## Current State

```tsx
// frontend/src/components/AgreementDetail.tsx — line 22
<ExplorerLink type="contract" value={agreement.agreement_id} />
<CopyButton text={agreement.agreement_id} label="Copy agreement ID" />
```

`ExplorerLink` with `type="contract"` treats the 64-hex-character value as a contract ID and builds a link that goes to a non-existent explorer page.

### Correct pattern already in use — `StatusPage.tsx` line 168

```tsx
<ExplorerLink type="agreement" value={agreement.agreement_id} full />
```

`explorerUrl('agreement', …)` returns `null`, so `ExplorerLink` renders nothing. The agreement ID is therefore shown only as text — which is the right behaviour.

---

## Required Changes

### 1. Replace `ExplorerLink` with a plain monospace display in `AgreementDetail.tsx`

Remove the `ExplorerLink` for the agreement ID and replace it with a truncated monospace span. Keep the `CopyButton` so users can still copy the full ID.

```tsx
// Before (line 22 area)
<ExplorerLink type="contract" value={agreement.agreement_id} />
<CopyButton text={agreement.agreement_id} label="Copy agreement ID" />

// After
<span
  className="font-mono text-sm text-white dark:text-white light:text-gray-900"
  title={agreement.agreement_id}
>
  {agreement.agreement_id.slice(0, 8)}…{agreement.agreement_id.slice(-8)}
</span>
<CopyButton text={agreement.agreement_id} label="Copy agreement ID" />
```

Truncating to `first8…last8` matches the style used elsewhere in the UI for long identifiers. The `title` attribute exposes the full ID on hover without taking up layout space.

If a separate link to the Trellis contract itself is desired, it can be added as a second element:

```tsx
{/* Optional: link the Trellis contract, not the agreement ID */}
<ExplorerLink type="contract" value={CONTRACT_ID} />
```

Import `CONTRACT_ID` from `'../lib/config'` if that link is included.

### 2. Update `AgreementDetail.test.tsx`

The issue's done criterion requires a test that asserts no explorer link is rendered for the agreement ID while the copy button still copies the full value.

Add to `AgreementDetail.test.tsx`:

```typescript
it('renders no explorer link for the agreement ID', () => {
  renderAgreementDetail(mockAgreement)

  // The agreement_id is 'a'.repeat(64) — a 64-hex BytesN<32>, not a contract address.
  // No anchor element should point to stellar.expert with this value.
  const explorerLinks = document.querySelectorAll(`a[href*="${mockAgreement.agreement_id}"]`)
  expect(explorerLinks).toHaveLength(0)
})

it('still provides a copy button for the full agreement ID', () => {
  renderAgreementDetail(mockAgreement)

  // CopyButton renders a button with aria-label "Copy agreement ID"
  const copyButton = screen.getByRole('button', { name: /copy agreement id/i })
  expect(copyButton).toBeInTheDocument()
})
```

---

## Files Affected

| File | Change |
|---|---|
| `frontend/src/components/AgreementDetail.tsx` | Replace `<ExplorerLink type="contract" value={agreement.agreement_id} />` with a plain truncated monospace span. |
| `frontend/src/components/AgreementDetail.test.tsx` | Add assertions: no explorer link for the agreement ID; copy button still present. |

---

## Done When

- `AgreementDetail.test.tsx` asserts that no `<a>` element links to Stellar Expert using the 64-hex agreement ID.
- `AgreementDetail.test.tsx` asserts the `CopyButton` for the agreement ID is still rendered.
- Visiting `/agreement/<hex>` in the browser shows the agreement ID as a truncated monospace string with a copy button, and no link.

---

## Verification Steps

```bash
cd frontend
npm test -- --run AgreementDetail
```

All tests in `AgreementDetail.test.tsx` pass, including the two new ones.

Manual check:

1. Navigate to any `/agreement/<hex>` page.
2. In the **Agreement Details** card, confirm the **Agreement ID** row shows a truncated hex string (e.g. `aaaaaaaa…aaaaaaaa`).
3. Confirm there is no hyperlink on that row.
4. Click the copy button and paste — confirm the full 64-character hex ID is in the clipboard.

---

## Commit Message

```
fix(frontend): render agreement ID as plain text in AgreementDetail

The agreement ID is a BytesN<32> storage key, not a Stellar contract
address, so linking it to stellar.expert/contract/<hex> produces a
broken page. Render it as a truncated monospace span with a CopyButton
instead, matching the pattern StatusPage already uses via
ExplorerLink type="agreement".

Add AgreementDetail tests asserting no explorer link is rendered for
the agreement ID and that the copy button remains.

Closes #681
```

---

## Related Issues

- **#680** — Meta tags and document title; both touch `AgreementStatusPage` / `AgreementDetail` and can be batched in the same PR.
- `StatusPage.tsx` already uses `type="agreement"` correctly and does not need changes.
