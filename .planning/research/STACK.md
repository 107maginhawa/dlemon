# Technology Stack — Wire & Ship Milestone

**Project:** Dentalemon v1.2
**Researched:** 2026-05-06
**Overall confidence:** HIGH

## Verdict: No New Dependencies Required

The existing stack covers every feature in this milestone. The orphaned components, workspace action bar, treatment plan tab, patient profile, attachments, payment modal, and report drilldown all wire into primitives already installed. This section documents what to use and what NOT to add.

## Existing Stack (Validated — Do Not Change)

### Core Framework
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| React | ^19.1.1 | UI framework | Installed |
| Vite | ^7.1.4 | Build tool | Installed |
| TanStack Router | ^1.131.31 | File-based routing | Installed |
| TanStack Query | ^5.85.9 | Server state / data fetching | Installed |
| Tailwind CSS | ^3 | Styling | Installed |
| Zod | ^4.1.12 | Validation | Installed |

### UI Primitives
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| @radix-ui/react-dialog | ^1.1.15 | Dialog/modal primitive | Installed |
| @radix-ui/react-tabs | ^1.1.13 | Tab switching | Installed |
| @radix-ui/react-progress | ^1.1.7 | Progress bars | Installed |
| @radix-ui/react-select | ^2.2.6 | Dropdowns | Installed |
| @radix-ui/react-scroll-area | ^1.2.10 | Scrollable regions | Installed |
| @radix-ui/react-separator | ^1.1.7 | Visual dividers | Installed |
| lucide-react | ^0.451.0 | Icons | Installed |
| framer-motion | ^12.23.12 | Animations | Installed |
| sonner | ^2.0.7 | Toast notifications | Installed |
| react-hook-form | ^7.63.0 | Form state | Installed |
| @hookform/resolvers | ^5.2.2 | Zod form validation | Installed |

### Shadcn Components Already Inlined
| Component | File | Use For |
|-----------|------|---------|
| Sheet | `components/sheet.tsx` | Bottom sheets (Rx, Consent, LabOrders, PMD) |
| Dialog | `components/dialog.tsx` | Center modals (payment, attachments) |
| Card | `components/card.tsx` | Profile sections, report cards |
| Table | `components/table.tsx` | Treatment plan rows, report tables |
| Tabs | `components/tabs.tsx` | Workspace tabs, profile sections |
| Badge | `components/badge.tsx` | Status indicators |
| Button | `components/button.tsx` | All CTAs |
| Form | `components/form.tsx` | React Hook Form integration |
| Select | `components/select.tsx` | Payment method, template selectors |
| Progress | `components/progress.tsx` | Payment plan progress |
| Skeleton | `components/skeleton.tsx` | Loading states |
| Empty State | `components/empty-state.tsx` | Zero-data views |
| Alert Dialog | `components/alert-dialog.tsx` | Destructive confirmations |
| Scroll Area | `components/scroll-area.tsx` | Long lists in sheets |
| Separator | `components/separator.tsx` | Section dividers |
| Tooltip | `components/tooltip.tsx` | Icon button labels |
| Dropdown Menu | `components/dropdown-menu.tsx` | Action bar overflow |

## Feature-to-Stack Mapping

### 1. Orphaned Sheet Components (Rx, Consent, LabOrders, PMD, PMDImport)

**Current state:** Custom `<div>` overlays with manual backdrop, no animation, no keyboard trap.

**Stack answer:** Refactor to use the existing Shadcn `Sheet` component (`components/sheet.tsx`) with `side="bottom"`. This gives: Radix focus trap, ESC dismiss, enter/exit animations, portal rendering.

**No new deps.** The Sheet component wraps `@radix-ui/react-dialog` (already installed). The orphaned components just need their outer `<div>` wrapper replaced with `<Sheet>/<SheetContent side="bottom">`.

### 2. Workspace Action Bar Footer

**Current state:** Simple footer with treatment count + "Continue to Payment" button.

**Stack answer:** Pure Tailwind layout + existing `Button` component + `lucide-react` icons. Action buttons (Rx, Consent, Lab, PMD) trigger sheet open state.

**No new deps.** `DropdownMenu` from Shadcn handles overflow if action count exceeds bar width. `Tooltip` wraps icon-only buttons.

### 3. Treatment Plan Tab (Live Data)

**Current state:** Placeholder text "coming in PR2" in workspace tab switcher. `useTreatments` hook already fetches `GET /dental/visits/:visitId/treatments`.

**Stack answer:** Build a treatment plan view component using `Table` from Shadcn. Group by status (diagnosed/planned/in_progress/completed). Totals row uses existing `CURRENCY_SYMBOL`/`APP_LOCALE` constants.

**No new deps.** Treatment data is already fetched. This is pure UI assembly with existing Table + Badge + Button primitives.

### 4. Patient Profile Screen

**Current state:** No route exists. Person forms (personal-info, contact-info, address, preferences) exist under `features/person/components/`.

**Stack answer:** Create route `_dashboard/patients/$patientId.tsx`. Compose from existing person form components + `Card` + `Tabs`. Patient data comes from existing `usePatients` hook + a new `usePatientProfile` detail hook (just a `useQuery` wrapper around `GET /dental/patients/:id`).

**No new deps.** All form components exist. Layout is Card + Tabs, both installed.

### 5. Workspace Attachments

**Current state:** Backend has full CRUD (`createAttachment`, `listAttachments`, `deleteAttachment`) with `DentalAttachment` schema. Storage module has presigned upload flow (`uploadFile` + `completeFileUpload`). No frontend component.

**Stack answer for file upload:** Use native `<input type="file">` + `fetch` to hit the storage presigned URL flow. The backend returns a presigned S3 URL; the frontend uploads directly via `PUT` to that URL, then calls `completeFileUpload`.

**Why NOT add a file upload library:**
- `react-dropzone`: Unnecessary. The upload UX is a simple button + file picker, not a drag-and-drop zone. The attachment list wireframe shows a compact upload button, not a drop area.
- `uppy`/`filepond`: Overkill. These are for complex multi-file upload with progress bars. We have a single-file-at-a-time clinical attachment flow.

**Image preview:** For x-ray/photo thumbnails in the attachment list, use native `<img>` with the presigned download URL from `getFileDownload`. `react-easy-crop` is already installed if cropping is needed.

**No new deps.** Native file input + fetch + existing storage API.

### 6. Quick Payment Modal

**Current state:** `PaymentPlanView` exists but is read-only. No quick payment recording UI. Backend has `payInvoice` and `captureInvoicePayment` handlers.

**Stack answer:** Build a `Dialog`-based modal with a form: amount input, payment method select (cash/card/bank), reference number field. Uses existing `Dialog` + `Form` + `Select` + `Button`. Submit calls `POST /billing/invoices/:id/pay`.

**Why NOT add Stripe Elements / payment processing:**
- The PRD describes a **recording** modal (clinician records that patient paid), not an online payment gateway.
- Backend `payInvoice` accepts `{ method, amount, reference }` — no card tokenization needed.
- Stripe Connect is for merchant onboarding, not point-of-sale card capture.

**No new deps.** Dialog + react-hook-form + zod for validation.

### 7. Report Drilldown

**Current state:** `RevenueReport` component exists with date filter + summary cards + daily table + CSV export. Dashboard route exists at `_dashboard/reports.tsx`.

**Stack answer:** The drilldown means clicking a daily row expands/navigates to that day's invoice list. Use existing `Table` for the invoice list. No charting library needed — the wireframe shows tabular data, not graphs.

**Why NOT add a charting library:**
- `recharts`/`chart.js`: The revenue report wireframe is a **table**, not a chart. The summary cards show aggregate numbers. Adding a charting library for a table view is scope creep.
- If charts are needed later (v1.3+), `recharts` (React-native, composable, works with Tailwind) is the right choice. But not now.

**No new deps.** Table + Card + existing date-fns for date formatting.

## Alternatives Considered and Rejected

| Need | Considered | Why Rejected |
|------|-----------|--------------|
| File upload UX | react-dropzone | Simple button upload, not drag-drop. Native `<input type="file">` sufficient. |
| File upload UX | filepond, uppy | Enterprise upload libs. Single-file clinical attachment doesn't justify the bundle. |
| Charts | recharts | Report wireframe is tabular, not graphical. Defer to v1.3 if needed. |
| Charts | chart.js / visx | Same reasoning. No chart wireframe exists. |
| Payment processing | @stripe/react-stripe-js | Payment modal records cash/card payment, doesn't tokenize cards. Backend `payInvoice` is the endpoint. |
| Rich text editor | tiptap, lexical | Medical notes use `<textarea>`. No rich text in any wireframe. |
| PDF generation | @react-pdf/renderer | PMD export uses backend-side generation. Frontend just displays/shares. |
| Animation | react-spring | framer-motion already installed and sufficient. |
| State management | zustand | TanStack Query handles all server state. Sheet open/closed is local `useState`. No global client state needed. |

## What to Refactor (Not Add)

### Orphaned Components: raw fetch() to TanStack Query

The 5 orphaned components (RxSheet, ConsentSheet, LabOrdersSheet, PMDViewer, PMDImport) use raw `fetch()` with manual loading/error state. PROJECT.md marks this as tracked tech debt and out-of-scope for v1.2.

**Recommendation:** Wire them as-is for v1.2 (they work). Schedule TanStack Query migration for v1.3 alongside other refactors.

### Sheet Components: Custom Overlay to Shadcn Sheet

**DO refactor** the orphaned sheets from custom `<div className="fixed inset-0">` overlays to `<Sheet side="bottom">`. This is not tech debt — it's a bug class (no focus trap, no ESC handler, no animation). Use the existing `components/sheet.tsx` Shadcn primitive.

**Cost:** ~15 min per sheet (5 sheets = ~75 min). Change the wrapper, keep the inner form markup.

## Installation

```bash
# Nothing to install. All dependencies are present.
# Verify with:
cd apps/dentalemon && bun install --frozen-lockfile
```

## Summary

| Feature | Libraries Needed | Existing Primitives Used |
|---------|-----------------|------------------------|
| Sheet wiring | None | Sheet (Radix Dialog), ScrollArea |
| Action bar | None | Button, Tooltip, DropdownMenu |
| Treatment plan tab | None | Table, Badge, useTreatments hook |
| Patient profile | None | Card, Tabs, person form components |
| Attachments | None | Native file input, fetch, img |
| Payment modal | None | Dialog, Form, Select, Button |
| Report drilldown | None | Table, Card, date-fns |

**Zero new dependencies. Zero new dev dependencies. Ship with what exists.**

## Sources

- package.json — dependency audit (HIGH confidence, direct inspection)
- Orphaned component source code — RxSheet, ConsentSheet, LabOrdersSheet, PMDViewer, PMDImport (HIGH confidence, direct inspection)
- Backend handlers — storage/, billing/, dental-clinical/ (HIGH confidence, direct inspection)
- TypeSpec modules — dental-clinical.tsp attachment model (HIGH confidence, direct inspection)
- Shadcn component inventory — 17 inlined components (HIGH confidence, direct inspection)
