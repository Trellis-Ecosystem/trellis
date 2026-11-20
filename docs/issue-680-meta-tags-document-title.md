# Issue #680 — Missing Meta Tags and Static `document.title` Across All Routes

**Issue:** [#680](https://github.com/Trellis-Ecosystem/trellis/issues/680)  
**Branch:** `feat/meta-tags-document-title`  
**Scope:** `frontend/index.html`, `frontend/src/` (new `useDocumentTitle` hook, page components)

---

## Background

`frontend/index.html` contains only four head elements — `charset`, `viewport`, a favicon link, and a static `<title>Trellis - Trustless Milestone Escrow</title>`. There are no `<meta name="description">`, Open Graph (`og:*`), Twitter (`twitter:*`), or `theme-color` tags. As a result:

- Sharing a Trellis URL in Slack, Discord, Twitter/X, or iMessage renders as a bare URL with no image, description, or title preview.
- Screen-reader users cannot distinguish between pages because every route keeps the home-page title on client-side navigation — `document.title` is never updated.
- A `grep` for `document.title` across `frontend/src/` returns no results.

The affected routes are `/` (Home), `/create`, `/history`, `/agreement/:id`, and the `*` (404) route.

---

## Current State

```html
<!-- frontend/index.html — entire <head> today -->
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trellis - Trustless Milestone Escrow</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
```

No page component calls `document.title = …` anywhere.

---

## Required Changes

### 1. Add static meta tags to `index.html`

Add the following tags to `<head>` before the closing tag. These are static defaults; the per-route `<title>` is handled dynamically (see below).

```html
<!-- SEO -->
<meta name="description" content="Trellis — trustless milestone-based escrow on Stellar. Create, fund, and release agreements without intermediaries." />
<meta name="theme-color" content="#0f172a" />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Trellis" />
<meta property="og:title" content="Trellis — Trustless Milestone Escrow" />
<meta property="og:description" content="Create, fund, and release milestone-based escrow agreements on Stellar without intermediaries." />
<meta property="og:image" content="/og-image.png" />

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Trellis — Trustless Milestone Escrow" />
<meta name="twitter:description" content="Create, fund, and release milestone-based escrow agreements on Stellar without intermediaries." />
<meta name="twitter:image" content="/og-image.png" />
```

An `og-image.png` (1200×630 px) should be placed in `frontend/public/`. A simple branded graphic is sufficient; it can be a follow-up task.

### 2. Add a `useDocumentTitle` hook

Create `frontend/src/hooks/useDocumentTitle.ts`:

```typescript
import { useEffect } from 'react'

const BASE_TITLE = 'Trellis'

/**
 * Sets document.title for the current page.
 *
 * The title is formatted as "<pageTitle> - Trellis" so every page has a
 * consistent suffix that screen readers and browser tabs can distinguish.
 * Pass null or undefined to reset to the base title.
 */
export function useDocumentTitle(pageTitle?: string | null): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} - ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = BASE_TITLE
    }
  }, [pageTitle])
}
```

The cleanup function restores the base title when the component unmounts, so navigating back to a page without an explicit title does not carry over the previous page's title.

### 3. Call `useDocumentTitle` in each page component

| Route | Component | Suggested title |
|---|---|---|
| `/` | `HomePage.tsx` | `null` (renders bare `'Trellis'`) |
| `/create` | `CreateAgreementPage.tsx` | `'Create Agreement'` |
| `/history` | `AgreementHistoryPage.tsx` | `'Agreement History'` |
| `/agreement/:id` | `AgreementStatusPage.tsx` | `'Agreement ${id.slice(0, 8)}…'` or `'Agreement Details'` |
| `*` | `NotFoundPage.tsx` | `'Page Not Found'` |

Example for `CreateAgreementPage.tsx`:

```typescript
import { useDocumentTitle } from '../hooks/useDocumentTitle'

function CreateAgreementPage() {
  useDocumentTitle('Create Agreement')
  // ...
}
```

For `AgreementStatusPage`, use the agreement ID from `useParams` once it is available:

```typescript
const { id } = useParams<{ id: string }>()
useDocumentTitle(id ? `Agreement ${id.slice(0, 8)}…` : 'Agreement Details')
```

---

## Files Affected

| File | Change |
|---|---|
| `frontend/index.html` | Add `<meta>` description, Open Graph, Twitter, and `theme-color` tags. |
| `frontend/src/hooks/useDocumentTitle.ts` | New hook. |
| `frontend/src/pages/HomePage.tsx` | Call `useDocumentTitle()` (no argument). |
| `frontend/src/pages/CreateAgreementPage.tsx` | Call `useDocumentTitle('Create Agreement')`. |
| `frontend/src/pages/AgreementHistoryPage.tsx` | Call `useDocumentTitle('Agreement History')`. |
| `frontend/src/pages/AgreementStatusPage.tsx` | Call `useDocumentTitle` with the agreement ID. |
| `frontend/src/pages/NotFoundPage.tsx` | Call `useDocumentTitle('Page Not Found')`. |
| `frontend/public/og-image.png` | *(New, optional follow-up)* Social sharing image. |

---

## Done When

- `frontend/index.html` contains a `<meta name="description">` tag, at least `og:title`, `og:description`, and `og:image` Open Graph tags, and a `theme-color` tag.
- Each route sets a distinct `document.title` value.
- Page tests (e.g. `CreateAgreementPage.test.tsx`, `AgreementStatusPage.test.tsx`) assert `document.title` after rendering the page — this is the done criterion stated in the issue.

Example assertion for `CreateAgreementPage.test.tsx`:

```typescript
it('sets document title to "Create Agreement - Trellis"', () => {
  renderCreateAgreementPage()
  expect(document.title).toBe('Create Agreement - Trellis')
})
```

---

## Verification Steps

1. `npm test -- --run useDocumentTitle` — the new hook's tests pass.
2. `npm test` — all existing page tests pass with the new `useDocumentTitle` calls.
3. Navigate to `/create` in the browser — the browser tab shows `Create Agreement - Trellis`.
4. Navigate to `/agreement/<hex>` — the tab updates to `Agreement <first 8 chars>… - Trellis`.
5. Use the [Twitter Card Validator](https://cards-dev.twitter.com/validator) or the [Open Graph Debugger](https://developers.facebook.com/tools/debug/) on the deployed URL to confirm the tags render correctly.

---

## Commit Message

```
feat(frontend): add meta tags and per-route document title

Add description, Open Graph, Twitter, and theme-color meta tags to
index.html so shared links render with a title and description preview.

Add useDocumentTitle hook and wire it into every page component so
each route sets a distinct document.title, fixing screen-reader
navigation and browser-tab labelling.

Closes #680
```

---

## Related Issues

- **#679** — E2E spec; page title assertions added here may be useful additional E2E guards once the spec is updated.
- **#681** — AgreementDetail agreement ID link; both are `AgreementDetail` / `AgreementStatusPage` changes and can be batched in the same PR if desired.
