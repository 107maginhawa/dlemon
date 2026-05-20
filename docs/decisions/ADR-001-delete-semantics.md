# ADR-001: Delete Semantics

**Status**: Accepted  
**Date**: 2026-05-08  
**Context**: V2 Audit Gate #3 — delete semantics were undocumented, blocking Ambiguity Gate.

---

## Decision

Each entity uses the delete semantic that matches its domain requirements. There is no single global "soft delete" pattern (`deleted_at` / `is_deleted`). Each module owns its own strategy.

---

## Entity-Strategy Matrix

### Hard Delete (row permanently removed)

| Entity | Endpoint | Handler | Notes |
|--------|----------|---------|-------|
| BookingEvent | `DELETE /booking/events/:event` | `deleteBookingEvent.ts` | Cascades to slots and exceptions |
| ScheduleException | `DELETE /booking/events/:event/exceptions/:exception` | `deleteScheduleException.ts` | |
| BillingInvoice (draft only) | `DELETE /billing/invoices/:invoice` | `deleteInvoice.ts` | Only `draft` status allowed |
| Provider profile | `DELETE /providers/:provider` | `deleteProvider.ts` | Profile only; person record preserved |
| marketplace Patient profile | `DELETE /patients/:patient` | `deletePatient.ts` | Profile only; person record preserved |
| StorageFile | `DELETE /storage/files/:file` | `deleteFile.ts` | Removes from object storage AND DB; HIPAA-logged |
| Review | `DELETE /reviews/:review` | `deleteReview.ts` | Hard delete (see spec mismatch note below) |
| ClinicalAttachment | `DELETE /dental/visits/:visitId/attachments/:attachmentId` | `deleteAttachment.ts` | SQL DELETE RETURNING |

### Void (status → voided, row preserved, financial entries may be reversed)

| Entity | Endpoint | Handler | Key Fields |
|--------|----------|---------|-----------|
| BillingInvoice (Stripe) | `POST /billing/invoices/:invoice/void` | `voidInvoice.ts` | `status='void'`, `voidedAt`, `paymentStatus='canceled'` |
| DentalInvoice | `POST /dental/billing/invoices/:invoiceId/void` | `voidDentalInvoice.ts` | `status='voided'`, `voidedAt` |
| DentalPayment | `POST /dental/billing/invoices/:invoiceId/payments/:paymentId/void` | `voidDentalPayment.ts` | `isVoid=true`, `voidedAt`, `voidReason`, `voidedByMemberId` |

### Archive (status → archived, reversible)

| Entity | Endpoint | Handler | Key Fields | Guard |
|--------|----------|---------|-----------|-------|
| DentalPatient | `POST /dental/patients/:id/archive` | `archiveDentalPatient.ts` | `status='archived'`, `archivedAt`, `needsFollowUp=false` | EC1: blocks if active payment plan |
| DentalPatient (bulk) | `POST /dental/patients/bulk-archive` | `bulkArchiveDentalPatients.ts` | Same | Same EC1 per patient |
| DentalPatient (restore) | `POST /dental/patients/:id/restore` | `restoreDentalPatient.ts` | `status='active'`, `archivedAt=null` | Only archived patients |
| EmailTemplate | (via update) | — | `status='archived'` | — |
| AuditLog | (retention) | — | `retentionStatus`, `archivedAt` | Retention policy |

### Deactivate (active=false or status=inactive, row preserved)

| Entity | Endpoint | Handler | Key Fields |
|--------|----------|---------|-----------|
| Practitioner | `DELETE /providers/practitioners/:id` | `deactivatePractitioner.ts` | `active=false`, `deactivatedAt` |
| PractitionerRole | `DELETE /providers/practitioner-roles/:id` | `deactivatePractitionerRole.ts` | `active=false`, `deactivatedAt` |
| DentalMembership | `POST /dental/.../members/:membershipId/deactivate` | `deactivateMember.ts` | `status='inactive'` |

### Cancel (status → cancelled, row preserved)

| Entity | Endpoint | Handler | Guard |
|--------|----------|---------|-------|
| DentalAppointment | `DELETE /dental/appointments/:appointmentId` | `cancelAppointment.ts` | Only `scheduled` or `checkedIn` |
| Booking | `POST /booking/bookings/:booking/cancel` | — | — |
| EmailQueue | `POST /email/queue/:queue/cancel` | — | Cannot cancel sent emails |
| LabOrder | — | — | `cancelledAt` column |

### No Delete (immutable records)

These entities have no delete/archive/void endpoint. They are append-only or lifecycle-only:

- **Person** — central identity record
- **EMR / ConsultationNotes** — status lifecycle: `draft → finalized → amended`
- **DentalVisit** — status lifecycle: `draft → active → completed → billed`
- **DentalTreatment** — status lifecycle: `diagnosed → planned → performed → verified`
- **DentalChart** — immutable clinical snapshots
- **Prescription** — regulatory record
- **ConsentForm** — legal record
- **MedicalHistory** — clinical record
- **PMD Document** — `generated → viewed → shared`
- **DentalOrganization / DentalBranch** — org structure
- **ConsentTemplate / TreatmentTemplate** — templates with status fields only

---

## HTTP Verb Conventions

The `DELETE` verb is overloaded in several endpoints — the HTTP verb does NOT imply hard deletion:

| Endpoint | Actual Behavior |
|----------|----------------|
| `DELETE /patients/:id` | Archives (soft) via `archivePatient()` |
| `DELETE /dental/appointments/:appointmentId` | Cancels (soft) via `repo.cancel()` |
| `DELETE /providers/practitioners/:id` | Deactivates (soft) via `deactivateById()` |
| `DELETE /providers/practitioner-roles/:id` | Deactivates (soft) via `deactivateById()` |

**Rule**: Always check the handler implementation, not just the HTTP verb, to understand actual deletion behavior.

---

## Known Issues (deferred)

1. **Reviews spec mismatch**: `specs/api/src/modules/reviews.md` describes soft-delete but `deleteReview.ts` performs hard delete. Decision: accept hard delete as correct (GDPR compliance — user-generated content). Spec to be updated separately.

2. **voidDentalInvoice lacks status restriction**: Any non-voided invoice can be voided, including `paid` invoices. No status guard in `voidDentalInvoice.ts:30`. Needs business rule clarification — should paid invoices require a credit note/refund instead?

3. **voidDentalPayment lacks transaction wrapping**: Two DB operations (void payment + reverse invoice balance) execute without a transaction (`voidDentalPayment.ts:41-45`). If the second fails, data is inconsistent. Fix deferred to Phase 2.

4. **voidDentalInvoice lacks audit fields**: No `voidedBy` or `voidReason` on the invoice (asymmetric with payment void which tracks both). Fix deferred.

5. **cancelAppointment ignores cancellation reason**: Handler body type is `never` — `cancellationReason` is always `undefined` despite the schema supporting it. Fix deferred.

---

## Rule for New Entities

Before implementing any delete/remove/end-lifecycle operation for a new entity, declare its strategy in the module spec:

1. Choose one: hard delete / void / archive / deactivate / cancel / no-delete
2. Specify the HTTP endpoint and verb
3. Document any guards (status checks, business rule guards, financial guards)
4. Note whether the operation is reversible
