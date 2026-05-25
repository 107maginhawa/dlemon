---
slice: p1-001-consent-gate
phase: audit-fix-sprint
modules: [dental-billing, dental-clinical]
gap_ref: GAP-DENTAL-001
agent_skills: [skills/oli-execution-gate]
---

## Goal

Enforce BR-011: a signed consent form must exist for a visit before an invoice can be created.

## Acceptance Criteria

AC-001: createDentalInvoice returns 422 with code CONSENT_REQUIRED when no signed consent form exists for the visit
AC-002: createDentalInvoice returns 201 when a signed consent form exists for the visit
AC-003: CONSENT_REQUIRED check fires before the double-billing check (consent is the first safety gate)

## Business Rules

BR-011: IF creating an invoice for visitId AND no consent_form row exists WHERE visit_id = visitId AND signed = true THEN throw BusinessLogicError('Signed consent required before invoicing', 'CONSENT_REQUIRED') → 422

## Notes

- consent_form is in dental-clinical module, schema at repos/consent-form.schema.ts
- consent_form.visitId links consent to visit; no branchId on the table — check is per-visit
- Fixture pattern: business-rules.test.ts:145 seedSignedConsent()
- After fix: re-run Hurl contract tests (new 422 code is a wire-contract change)
