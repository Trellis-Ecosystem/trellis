# Requirements Document

## Introduction

Trellis is a trustless milestone escrow dApp built on Stellar's Soroban platform. Its primary target markets are Nigeria, Kenya, and Ghana, where a majority of users access the internet via mobile devices. The current frontend has limited mobile responsiveness: the `NetworkStatus` label in the Navbar is hidden at smaller viewports with no equivalent fallback, the `NetworkBackground` canvas can overflow horizontally on narrow screens, the `AgreementDetail` milestones table has no horizontal scroll wrapper on mobile, and interactive controls throughout the app fall below the 44 × 44 px minimum tap target size.

This feature refactors the entire Trellis frontend to be mobile-first and fully responsive across the tested breakpoints of 320 px, 375 px, 414 px, 768 px, and 1,024 px. The refactor covers the existing `Navbar`, `NetworkBackground`, `AgreementDetail`, `MilestoneBuilder`, `WalletConnect`, and landing-page components, as well as the planned `AgreementStatusPage` and `CreateAgreementPage` pages, which must be mobile-first from the start.

## Glossary

- **App**: The Trellis React/Vite frontend application.
- **Breakpoint_Set**: The five tested viewport widths — 320 px, 375 px, 414 px, 768 px, and 1,024 px.
- **Tap_Target**: An interactive element (button, link, or input) whose touch-actionable area measures at least 44 × 44 px, per WCAG 2.5.5.
- **Horizontal_Overflow**: A condition where page content extends beyond the right edge of the viewport, producing a horizontal scrollbar or clipped content at the document root.
- **Mobile_First**: A CSS authoring approach where base styles target the smallest viewport and `min-width` media queries (Tailwind responsive prefixes) progressively enhance layout for larger screens.
- **Navbar**: The top navigation bar implemented in `src/components/Navbar.tsx`.
- **NetworkBackground**: The animated particle-canvas component in `src/components/NetworkBackground.tsx`.
- **AgreementDetail**: The agreement details and milestones table component in `src/components/AgreementDetail.tsx`.
- **MilestoneBuilder**: The milestone creation form component in `src/components/MilestoneBuilder.tsx`.
- **AgreementStatusPage**: The agreement lookup page in `src/pages/AgreementStatusPage.tsx`.
- **CreateAgreementPage**: The agreement creation form page in `src/pages/CreateAgreementPage.tsx`.
- **HomePage**: The landing page in `src/pages/HomePage.tsx`.
- **WalletConnect**: The wallet connection control in `src/components/WalletConnect.tsx`.
- **StatsBar**: The timestamp display component in `src/components/StatsBar.tsx`.
- **Single_Column_Layout**: A layout where content sections stack vertically in one column.
- **Multi_Column_Layout**: A layout where content sections are arranged in two or more columns side by side.

---

## Requirements

### Requirement 1: Prevent Horizontal Overflow on All Pages

**User Story:** As a mobile user in Nigeria, I want the page to never produce a horizontal scrollbar, so that I can read and interact with all content without sideways scrolling.

#### Acceptance Criteria

1. THE App SHALL constrain the root document and all page containers so that `document.documentElement.scrollWidth` does not exceed `window.innerWidth` at any viewport in the Breakpoint_Set (320 px, 375 px, 414 px, 768 px, and 1,024 px).
2. IF the viewport width is 375 px or less, THEN THE NetworkBackground SHALL render its canvas with `position: fixed` or `overflow: hidden` on its parent so that `document.documentElement.scrollWidth` does not exceed `window.innerWidth`.
3. WHILE the viewport width is less than 768 px, THE App SHALL apply `overflow-x: hidden` on the `<body>` or the root layout container so that `document.documentElement.scrollWidth` does not exceed `window.innerWidth`.

---

### Requirement 2: Mobile-First Navbar with Collapsible Navigation

**User Story:** As a mobile user, I want the Navbar to display essential controls without overflowing or cramping the screen, so that I can navigate the app easily on a small phone.

#### Acceptance Criteria

1. THE Navbar SHALL render the brand name "Trellis" and the `WalletConnect` control on all viewports in the Breakpoint_Set (320 px, 375 px, 414 px, 768 px, and 1,024 px) such that no child element causes `document.documentElement.scrollWidth` to exceed `window.innerWidth`, including at the 320 px viewport.
2. WHILE the viewport width is less than 768 px (Tailwind `md` breakpoint), THE Navbar SHALL hide the inline navigation links ("Home", "Create Agreement", "Check Status") and display a hamburger menu button in their place.
3. WHEN the hamburger menu button is clicked or tapped, THE Navbar SHALL display the navigation links in a vertical dropdown or slide-in panel whose height does not exceed `window.innerHeight` and whose width does not exceed `window.innerWidth`, toggle `aria-expanded` from `false` to `true` on the button, and change the button icon from ☰ to ×.
4. WHILE the viewport width is at least 768 px, THE Navbar SHALL display the navigation links inline and hide the hamburger menu button.
5. THE hamburger menu button SHALL have a minimum CSS padding-box touch-actionable area of 44 × 44 px.
6. THE `NetworkStatus` badge SHALL remain visible at all viewports in the Breakpoint_Set; WHERE the viewport is less than 375 px, THE Navbar SHALL abbreviate the label to the status indicator dot only, retaining the full text for screen readers via `aria-label`.
7. THE `ExplorerLink` contract link SHALL be hidden at viewports narrower than 768 px to free horizontal space.
8. WHEN a navigation link inside the mobile menu is tapped, THE Navbar SHALL close the menu and reset `aria-expanded` to `false` on the hamburger button.
9. WHEN the Escape key is pressed or a click/tap occurs outside the open mobile menu, THE Navbar SHALL close the menu and reset `aria-expanded` to `false` on the hamburger button.

---

### Requirement 3: Touch-Friendly Input Sizes for All Forms

**User Story:** As a mobile user filling in agreement details, I want all form inputs and buttons to be large enough to tap without accidentally hitting adjacent elements, so that I can complete forms accurately.

#### Acceptance Criteria

1. THE CreateAgreementPage SHALL render all `<input>` elements with a minimum height of 44 px at all viewports in the Breakpoint_Set.
2. THE CreateAgreementPage SHALL render all `<button>` elements with a minimum height of 44 px and a minimum width of 44 px at all viewports in the Breakpoint_Set.
3. THE AgreementStatusPage SHALL render the search `<input>` with a minimum height of 44 px and the "Search" `<button>` with a minimum height of 44 px and a minimum width of 44 px at all viewports in the Breakpoint_Set.
4. THE MilestoneBuilder SHALL render the amount and description `<input>` fields with a minimum height of 44 px, and the "Add Milestone", move-up, move-down, and remove `<button>` controls with a minimum CSS padding-box size of 44 × 44 px, at all viewports in the Breakpoint_Set.
5. WHILE the viewport width is 320 px, THE CreateAgreementPage form action buttons ("Create Agreement" and "Cancel") SHALL each have a minimum height of 44 px and SHALL be arranged in a vertical stack (flex-direction: column) so that each button occupies the full available width without overflow.
6. THE WalletConnect "Connect Wallet" and "Disconnect" buttons SHALL each have a minimum height of 44 px and a minimum width of 44 px at all viewports in the Breakpoint_Set.

---

### Requirement 4: Responsive AgreementStatusPage Layout

**User Story:** As a mobile user, I want to look up and read agreement details on my phone without elements overlapping or text being cut off, so that I can check payment status from anywhere.

#### Acceptance Criteria

1. IF the viewport width is less than 768 px, THEN THE AgreementStatusPage SHALL render all content sections in a Single_Column_Layout (flex-direction: column or grid with one column) at viewports of 320 px, 375 px, and 414 px.
2. IF the viewport width is at least 768 px, THEN THE AgreementStatusPage SHALL render the `AgreementDetail` card and the `EventFeed` in a two-column Multi_Column_Layout where each column is at least 280 px wide with a gap of at least 16 px between them.
3. IF the viewport width is less than 480 px, THEN THE AgreementStatusPage search row SHALL display the search `<input>` and "Search" button in a vertical stack; IF the viewport width is at least 480 px, THEN they SHALL be displayed inline on one row.
4. THE AgreementDetail milestones table SHALL be wrapped in a container with `overflow-x: auto` so that the table does not cause `document.documentElement.scrollWidth` to exceed `window.innerWidth` at any viewport in the Breakpoint_Set (320 px, 375 px, 414 px, 768 px, and 1,024 px).
5. IF the viewport width is less than 768 px, THEN THE AgreementDetail SHALL render each address row (Agreement ID, Payer, Payee, Resolver, Token) with the label on its own line above the address (truncated to 12 characters followed by an ellipsis) and copy button, not inline on one row.
6. THE AgreementStatusPage SHALL apply a minimum of 16 px horizontal padding at the 320 px viewport and a minimum of 24 px horizontal padding at viewports of 768 px and wider.

---

### Requirement 5: Responsive CreateAgreementPage Layout

**User Story:** As a freelancer in Ghana creating an escrow agreement on a mobile phone, I want the form to be easy to complete without zooming or horizontal scrolling, so that I can set up agreements wherever I am.

#### Acceptance Criteria

1. THE CreateAgreementPage SHALL render the form in a Single_Column_Layout (one column, vertically stacked fields) at all viewports in the Breakpoint_Set (320 px, 375 px, 414 px, 768 px, and 1,024 px).
2. THE CreateAgreementPage form sections ("Agreement Parties" card and "Milestones" card) SHALL span 100% of the available container width at viewports narrower than 768 px, and SHALL be constrained to a maximum width of 768 px and horizontally centered at viewports of 768 px and wider.
3. THE MilestoneBuilder milestone rows SHALL arrange the amount input and the action buttons (move up, move down, remove) in a vertical stack at viewports narrower than 480 px, and SHALL display them on a single row at viewports of 480 px and wider.
4. THE CreateAgreementPage SHALL render all `<input>` fields with a `font-size` of at least 16 px to prevent iOS Safari from auto-zooming the viewport on focus.
5. IF a wallet is not connected, THEN THE CreateAgreementPage SHALL display the "Please connect your wallet" notice as a block-level element that spans the full available container width, is positioned above the submit button, and has a visually distinct background color or border not shared with adjacent `<input>` fields, along with a non-empty descriptive text string.

---

### Requirement 6: Responsive HomePage Layout

**User Story:** As a first-time visitor on a 375 px phone, I want the landing page hero, CTA buttons, and feature cards to lay out cleanly without overflow, so that I get a polished first impression of the product.

#### Acceptance Criteria

1. WHILE the viewport width is less than 640 px, THE HomePage SHALL display the CTA buttons ("Create Agreement" and "Check Status") in a vertically stacked column (flex-direction: column); WHILE the viewport width is at least 640 px, THE HomePage SHALL display those buttons as an inline row (flex-direction: row).
2. WHILE the viewport width is less than 768 px, THE HomePage features grid SHALL display cards in a Single_Column_Layout (one column, vertically stacked); WHILE the viewport width is at least 768 px, THE HomePage features grid SHALL display cards in a three-column grid.
3. WHILE the viewport width is less than 640 px, THE HomePage hero `<h1>` SHALL have a computed font-size of 36 px; WHILE the viewport width is at least 640 px, THE HomePage hero `<h1>` SHALL have a computed font-size of 48 px.
4. THE HomePage SHALL render such that `document.documentElement.scrollWidth` does not exceed `window.innerWidth` at viewport widths of 375 px, 640 px, 768 px, and 1,280 px.
5. IF the `prefers-reduced-motion: reduce` media query is active, THEN THE NetworkBackground canvas element SHALL be absent from the DOM; IF the `prefers-reduced-motion: reduce` media query is active, THEN THE HomePage SHALL display a static solid background using the `navy-900` design token color in place of the animated background.

---

### Requirement 7: Viewport Meta Tag and Build Integrity

**User Story:** As a mobile browser, I need the correct viewport meta tag to render the page at the device's natural width, so that the mobile-first layout is not zoomed out incorrectly.

#### Acceptance Criteria

1. THE App SHALL include a `<meta name="viewport" content="width=device-width, initial-scale=1">` tag in `index.html`.
2. WHEN `npm run build` is executed, THE App SHALL exit with code 0 and produce zero TypeScript or Vite compilation errors.
3. WHEN `npm run test` is executed after all responsive changes, THE App's test suite SHALL exit with code 0 and report zero failing tests.
4. THE App SHALL include new Vitest tests that assert, for each component whose rendered HTML contains at least one breakpoint-prefixed Tailwind class (`sm:`, `md:`, or `lg:`), that those breakpoint-prefixed class tokens are present in the rendered output.
5. THE new Vitest tests SHALL cover viewport breakpoints corresponding to Tailwind's `sm` (640 px) and `md` (768 px) prefixes at a minimum.
