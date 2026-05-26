
---

## 06 — `docs/audits/prompts/06-ui-ux-ipad-carousel-audit.md`

```md
# UI/UX, iPad-First, and Timeline Carousel Audit

## Purpose

Audit whether the user interface supports a production-grade dental workflow, especially the iPad-first clinical workspace and timeline carousel charting concept.

Do not redesign the UI during this audit. Identify gaps, risks, and improvement opportunities. Generate redesign/implementation tasks later through the remediation generator.

---

## Required Guardrail

Before running this pass, load:

`docs/audits/prompts/01-audit-enforcement-guardrails.md`

Update:

- `docs/audits/AUDIT_COVERAGE_MANIFEST.md`
- `docs/audits/DENTAL_AUDIT_RUN_LOG.md`
- `docs/audits/DENTAL_GAP_REGISTRY.md`

---

## Inputs

Inspect if present:

- `CAROUSEL-CONCEPT.md`
- UI blueprint files
- frontend routes
- frontend components
- hooks
- tests
- E2E tests
- design docs/wireframes
- `docs/product/UI_CONVENTIONS.md`
- `docs/product/NAVIGATION_MAP.md`

---

## UI Product Direction

The app is intended to be an iPad-first dental management system.

The dental workspace should support chairside use by a dentist or clinical staff member.

The timeline carousel concept is a core UX direction:

- horizontally swipeable visit cards
- each card represents one patient visit
- each card renders a full dental chart snapshot
- visits are sorted oldest to newest
- most recent visit auto-selected
- clinician can move through patient history visually
- past completed/locked visits should be protected/read-only
- new visit should be easy to create
- tooth history should be visible and understandable

Local-first architecture is future-phase context. Do not block the current release only because local-first sync/offline is not implemented, unless current UI or architecture choices create clear migration risk.

---

## UI/UX Audit Areas

### 1. iPad and Touch Readiness

Check:

- touch targets
- spacing
- tap vs hover assumptions
- keyboard-only assumptions
- responsive layout for tablet
- portrait/landscape behavior if applicable
- chairside one-handed/quick interaction patterns
- large enough chart interactions
- slideout usability

### 2. Dental Workspace Navigation

Check:

- patient context visible
- active visit visible
- visit status visible
- charting context clear
- selected tooth clear
- treatment context clear
- easy return to patient profile
- easy access to billing/notes/imaging/perio

### 3. Timeline Carousel Compliance

Check:

- visit cards exist
- oldest-to-newest sorting
- most recent auto-selected
- active card visually distinguished
- non-active cards are read-only/display-only
- `+ New Visit` flow exists
- keyboard/swipe/click behavior works
- active visit syncs to workspace state
- carousel handles many visits

### 4. Cumulative Snapshot Model

Check:

- each visit has chart snapshot
- previous visit carries forward correctly
- past visit snapshots remain stable
- completed/locked visits are immutable or protected
- tooth changes over time are understandable
- diff/history is inferable by adjacent cards or explicit history view

### 5. Tooth Charting UX

Check:

- 32 teeth visible and usable
- surfaces selectable if in scope
- tooth state visible
- condition vs treatment workflow not confused
- selected tooth slideout/panel works
- save feedback clear
- validation feedback clear
- treatment save failure cannot be silent
- legend complete and understandable

### 6. State Vocabulary UX

Audit whether UI clearly separates or reconciles:

- tooth appearance/status
- treatment workflow status
- structural states
- existing restorations
- planned/proposed work
- completed/performed/verified work
- declined/dismissed work

If the UI uses a simplified display state, verify mapping is documented and tested.

### 7. Clinical Safety UX

Check:

- lock visit
- sign notes
- addendum flow
- consent requirement
- irreversible/destructive warnings
- audit trail visibility
- locked/past visit read-only behavior
- clear warning for partial save

### 8. Billing/Admin UX

Use Stripe/Square/QuickBooks-level clarity as benchmark.

Check:

- balance clarity
- invoice status clarity
- payment status clarity
- refund/reversal clarity
- receipts/statements
- discount auditability
- payment plan visibility
- collections dashboard usefulness

### 9. Org/Admin UX

Use GitHub/Slack/Linear-style clarity as benchmark.

Check:

- org switcher
- branch switcher/context
- role/membership management
- staff/provider distinction
- settings clarity
- access control clarity

### 10. Accessibility and Motion

Check:

- keyboard navigation
- accessible names
- ARIA where needed
- focus states
- screen reader labels
- reduced-motion fallback
- color-only indicators avoided
- contrast/tokens

### 11. Error, Empty, and Loading States

Check:

- empty patient state
- no visits state
- no chart data state
- loading chart
- failed chart load
- failed treatment save
- failed payment save
- offline/future sync status placeholder if relevant
- retry affordances

---

## Seeded Carousel Gaps to Verify

If `CAROUSEL-CONCEPT.md` is present, verify these known gaps against current code:

- state taxonomy mismatch
- no `dental_chart_version`
- time-lapse playback missing
- year-grouping tabs missing
- reduced-motion fallback missing
- N+1 query pattern in tooth history
- per-card chart fetch fan-out
- treatment save error silently swallowed
- dead-coded `panelOpen`
- incomplete legend
- pediatric charting unwired
- tamper-evidence deferred

Do not assume they still exist. Verify against current code.

---

## Output Section

Append to:

`docs/audits/DENTAL_SYSTEM_AUDIT_REPORT.md`

with:

```md
# UI/UX, iPad-First, and Timeline Carousel Audit

## Summary

## UI Coverage Matrix

| Area | Audited | Status | Risk | Notes |
|---|---:|---|---|---|

## Carousel Compliance Matrix

| Requirement | Status | Evidence | Severity |
|---|---|---|---|

## UX Findings

| Gap ID | Severity | Area | Finding | Evidence | Recommended Task |
|---|---|---|---|---|---|

## Pass Completion

Status:
Coverage:
Unaudited:
Resume instruction:
