# Project Research Summary

**Project:** Dentalemon v1.2 Wire & Ship
**Domain:** Dental Practice Management (assembly milestone)
**Researched:** 2026-05-06
**Confidence:** HIGH

## Executive Summary

v1.2 is an **assembly milestone**, not greenfield development. The codebase already contains 22/28 built wireframes, ~87 backend handlers, and 5 complete components that were never wired into the route tree. Zero new dependencies are needed — every feature maps to existing installed primitives (Shadcn Sheet/Dialog/Table, TanStack Query, native file input). The work is integration and gap-filling.

The recommended approach is dependency-ordered wiring: start with the workspace action bar (unlocks 5 sheet overlays in one phase), then fill the most visible placeholder (treatment plan tab), then build remaining screens (patient profile, attachments, payment modal, report drilldown). The action bar phase has the highest unlock-to-effort ratio.

Key risk: the 5 orphaned components use raw `fetch()` instead of TanStack Query hooks, which bypasses cache invalidation. Minimal mitigation (call `queryClient.invalidateQueries()` in fetch callbacks) is sufficient for v1.2; full hook refactor is tracked tech debt for v1.3. Secondary risk: PMDViewer lacks `open`/`onClose` props and needs a wrapper component, unlike the other 4 sheets.

## Key Findings

### Recommended Stack

Zero new dependencies. All features map to existing primitives. See [STACK.md](STACK.md).

**Existing technologies covering all needs:**
- **Shadcn Sheet/Dialog**: Overlay patterns for all 5 orphaned components + payment modal — focus trap, ESC, animation built in
- **Native `<input type="file">`**: File uploads for attachments — no dropzone/uppy library warranted
- **Existing billing APIs**: `payInvoice` accepts `{method, amount, reference}` — recording modal, not payment gateway

**Not needed (explicitly rejected):**
- Charting library (Recharts) — report drilldown is tabular, not graphical. Revisit in v1.3
- Stripe Elements — no payment gateway integration, just recording
- File upload libraries — native input sufficient for clinical attachments

### Expected Features

See [FEATURES.md](FEATURES.md).

**Must have (table stakes):**
- Workspace action bar with quick-access clinical sheets (Rx, Consent, Lab Orders, PMD)
- Treatment plan view grouped by urgency with accept/decline
- Patient profile with demographics, contact, insurance, visit history
- Clinical file attachments (X-rays, intraoral photos)
- Payment recording from workspace context
- Report drilldown from summary to detail

**Should have (competitive):**
- Insurance panel on patient profile (net-new UI)
- Attachment metadata (tooth number, image type)

**Defer (v1.3+):**
- Periodontal charting (no backend schema/handler)
- AI-assisted imaging analysis
- Claims EDI / insurance billing integration
- PACS integration

### Architecture Approach

$patientId.tsx is the single integration point. All 5 orphaned sheets wire in via local `useState` flags. 8 new components and 7 new hooks needed, with 3 existing components modified. See [ARCHITECTURE.md](ARCHITECTURE.md).

**Major components:**
1. **WorkspaceActionBar** — footer bar between treatment summary and payment button; houses sheet trigger icons
2. **TreatmentPlanTab** — replaces "Coming in PR2" placeholder with live data from `getTreatmentPlan` API
3. **PatientProfilePanel** — composes 5 existing form components + new insurance panel
4. **AttachmentsPanel** — upload/gallery using dental-clinical attachment module
5. **QuickPaymentModal** — records payment via existing `recordDentalPayment` API
6. **PMDViewerSheet** — wrapper around PMDViewer (which lacks open/onClose props)

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 13 pitfalls.

1. **Stale cache from raw fetch()** — orphaned components mutate via fetch(), bypassing TanStack Query cache. Fix: call `queryClient.invalidateQueries()` in fetch callbacks. Full refactor deferred.
2. **z-index collision** — hand-rolled overlays use z-40, Radix Sheet uses z-50. Wrapping in Shadcn Sheet fixes this automatically (removes custom overlay divs).
3. **PMDViewer has no open/onClose** — needs a dedicated wrapper component, not just prop threading like the other 4 sheets.
4. **prescriberMemberId missing in workspace** — available via `localStorage.getItem('currentMemberId')` (set by `_dashboard.tsx` beforeLoad) but workspace route has no equivalent guard.
5. **Action bar must REPLACE existing payment footer** — not coexist with it. Current footer is just treatment summary + payment button.

## Implications for Roadmap

### Phase 1: Workspace Action Bar + Sheet Wiring
**Rationale:** Highest unlock-to-effort ratio. 5 features unlocked by wiring existing components. Establishes Sheet overlay pattern used by later phases.
**Delivers:** Action bar footer with Rx, Consent, LabOrders, PMD sheet triggers + PMDImport nested in Notes tab
**Addresses:** All 5 orphaned components, footer redesign
**Avoids:** z-index collision (by wrapping in Shadcn Sheet), stale cache (minimal invalidation)

### Phase 2: Treatment Plan Tab
**Rationale:** Most visible placeholder ("Coming in PR2"). Single hook + single component. Low risk.
**Delivers:** Treatment plan view with urgency grouping, accept/decline UI
**Addresses:** Treatment plan presentation, branchId param plumbing

### Phase 3: Patient Profile
**Rationale:** Composes existing form components. One net-new panel (insurance). Independent of other features.
**Delivers:** Patient profile screen with demographics, contact, insurance, visit history
**Addresses:** Patient profile wireframe gap

### Phase 4: Attachments + Payment Modal
**Rationale:** Both need API integration. Attachments is highest-risk feature — placing it late prevents blocking other phases.
**Delivers:** Clinical file attachments (upload/gallery) + quick payment recording modal
**Addresses:** ws-attachments and ws-payment-modal wireframe gaps

### Phase 5: Report Detail + Smoke Test
**Rationale:** Lowest scope (client-side drilldown from existing data). Natural place for full integration walkthrough.
**Delivers:** Report drilldown view + full smoke test of all wired features
**Addresses:** report-detail wireframe gap, end-to-end verification

### Phase Ordering Rationale

- Action bar first because it establishes the Sheet overlay pattern reused by attachments and payment modal
- Treatment plan second because it's the most visible user-facing gap
- Patient profile third because it's independent and composes existing components
- Attachments + payment grouped because both involve API integration and can share patterns
- Report detail last because it's trivial and provides natural smoke test checkpoint

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Sheet overlay integration patterns — verify all 5 components' prop interfaces
- **Phase 4:** Attachment upload flow — verify presigned URL pattern from storage module

Phases with standard patterns (skip research-phase):
- **Phase 2:** Treatment plan — straightforward hook + view component
- **Phase 3:** Patient profile — composing existing form components
- **Phase 5:** Report detail — client-side data transformation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct inspection of package.json, all component files, backend handlers |
| Features | HIGH | Well-established dental practice patterns, verified against codebase |
| Architecture | HIGH | Read every source file, verified all prop interfaces and API endpoints |
| Pitfalls | HIGH | All 13 pitfalls grounded in actual code inspection |

**Overall confidence:** HIGH

### Gaps to Address

- **Insurance schema**: Does dental-patient schema already store insurance subscriber fields? May need backend addition for patient profile.
- **Attachment metadata**: Does storage module support metadata tags (tooth number, image type)? May need schema extension.
- **Touch events**: CSS `touch-none` class observed on some components — needs device testing (not blocking for web MVP).

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all 5 orphaned components, workspace route, backend handlers, Shadcn inventory
- Existing wireframes in docs/context/wireframes/ — 22/28 already built

### Secondary (MEDIUM confidence)
- Dental practice software patterns (Dentrix, Open Dental, CareStack conventions)

---
*Research completed: 2026-05-06*
*Ready for roadmap: yes*
