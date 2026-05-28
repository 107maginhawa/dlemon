# Cross-Module Enforcement
<!-- oli-enforce-cross-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->
<!-- skill: oli-enforce-cross-module | depth: full | auto: true -->
<!-- modules-scoped: all dental-* modules -->

## Summary

| Metric | Count |
|--------|-------|
| **Total findings** | **44** |
| P0 — Cross-module DB schema import | 25 |
| P1 — Cross-module handler/repo import, event contract gap | 16 |
| P2 — Indirect coupling, facade bypass | 2 |
| P3 — Style / infra inconsistency | 1 |
| Import boundary violations | 34 |
| Event contract gaps | 7 |
| API boundary violations | 7 |
| Auth propagation violations | 0 |

**Overall health: POOR.** Cross-module DB schema imports are pervasive (25 P0s). The pattern is widespread enough to be systemic, not incidental — every dental module with FK relationships directly imports the foreign module's Drizzle schema table object. No domain event emission exists anywhere in source code despite 24 events declared in EVENT_CONTRACTS.

---

## Findings

| ID | Sev | Type | Description | File | Line |
|----|-----|------|-------------|------|------|
| EX:dental-patient:dental-visit:f566a2f3 | **P0** | Cross-module DB schema import | `dental-patient` queries `dentalVisits` table directly from `dental-visit` repos | `dental-patient/identity/getDentalPatient.ts` | 15 |
| EX:dental-patient:dental-billing:c53e86f4 | **P0** | Cross-module DB schema import | `dental-patient` queries `dentalInvoices` table directly from `dental-billing` repos | `dental-patient/identity/getDentalPatient.ts` | 16 |
| EX:dental-patient:dental-visit:c8b7dd12 | **P0** | Cross-module DB schema import | `dental-patient` queries `dentalVisits` from `dental-visit` repos (patient statement) | `dental-patient/identity/getDentalPatientStatement.ts` | 13 |
| EX:dental-patient:dental-billing:c8aad36c | **P0** | Cross-module DB schema import | `dental-patient` queries `dentalInvoices`, `dentalInvoiceLineItems`, `dentalPayments` from `dental-billing` repos | `dental-patient/identity/getDentalPatientStatement.ts` | 14 |
| EX:dental-patient:dental-visit:d9acaea5 | **P0** | Cross-module DB schema import | `dental-patient` queries `dentalVisits` from `dental-visit` repos (list patients) | `dental-patient/identity/listDentalPatients.ts` | 17 |
| EX:dental-patient:dental-clinical:226e325d | **P0** | Cross-module DB schema import | `dental-patient` queries `medicalHistoryEntries` from `dental-clinical` repos (safety floor) | `dental-patient/identity/getDentalPatientSafetyFloor.ts` | 16 |
| EX:dental-clinical:dental-visit:e100282c | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalVisits` FK from `dental-visit` (amendment schema) | `dental-clinical/repos/amendment.schema.ts` | 7 |
| EX:dental-clinical:dental-org:77da2568 | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalMemberships` FK from `dental-org` (amendment schema) | `dental-clinical/repos/amendment.schema.ts` | 9 |
| EX:dental-clinical:dental-org:46928718 | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalBranches` FK from `dental-org` (postop-template schema) | `dental-clinical/repos/postop-template.schema.ts` | 3 |
| EX:dental-clinical:dental-visit:1c67021e | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalVisits` FK from `dental-visit` (attachment schema) | `dental-clinical/repos/attachment.schema.ts` | 7 |
| EX:dental-clinical:dental-org:fc68f5c3 | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalBranches` FK from `dental-org` (inventory schema) | `dental-clinical/repos/inventory.schema.ts` | 11 |
| EX:dental-clinical:dental-visit:dd31647d | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalVisits` FK from `dental-visit` (lab-order schema) | `dental-clinical/repos/lab-order.schema.ts` | 9 |
| EX:dental-clinical:dental-visit:a5226be7 | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalVisits` + `dentalMemberships` from `dental-visit`/`dental-org` (prescription schema) | `dental-clinical/repos/prescription.schema.ts` | 7 |
| EX:dental-clinical:dental-visit:5e8e22ba | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalVisits` + `treatmentPlanVersions` from `dental-visit` (consent-form schema) | `dental-clinical/repos/consent-form.schema.ts` | 7 |
| EX:dental-clinical:dental-visit:75674565 | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalVisits` from `dental-visit` in clinical-dashboard facade | `dental-clinical/repos/clinical-dashboard.facade.ts` | 11 |
| EX:dental-clinical:dental-visit:ccb039d4 | **P0** | Cross-module DB schema import | `dental-clinical` imports `dentalVisits` from `dental-visit` in clinical-imaging facade | `dental-clinical/repos/clinical-imaging.facade.ts` | 9 |
| EX:dental-billing:dental-visit:60d88414 | **P0** | Cross-module DB schema import | `dental-billing` imports `dentalVisits` + `dentalTreatments` FKs from `dental-visit` (invoice schema) | `dental-billing/repos/dental-invoice.schema.ts` | 10 |
| EX:dental-billing:dental-org:556683fc | **P0** | Cross-module DB schema import | `dental-billing` imports `dentalBranches` + `dentalMemberships` FKs from `dental-org` (invoice schema) | `dental-billing/repos/dental-invoice.schema.ts` | 13 |
| EX:dental-billing:dental-org:8871bb35 | **P0** | Cross-module DB schema import | `dental-billing` imports `dentalBranches` + `dentalMemberships` FKs from `dental-org` (payment schema) | `dental-billing/repos/dental-payment.schema.ts` | 12 |
| EX:dental-visit:dental-org:a3287ccf | **P0** | Cross-module DB schema import | `dental-visit` imports `dentalMemberships` FK from `dental-org` (treatment schema) | `dental-visit/repos/treatment.schema.ts` | 11 |
| EX:dental-visit:dental-org:a0226aa9 | **P0** | Cross-module DB schema import | `dental-visit` imports `dentalBranches` FK from `dental-org` (treatment-template schema) | `dental-visit/repos/treatment-template.schema.ts` | 10 |
| EX:dental-visit:dental-org:de72373e | **P0** | Cross-module DB schema import | `dental-visit` imports `dentalBranches` + `dentalMemberships` FKs from `dental-org` (visit schema) | `dental-visit/repos/visit.schema.ts` | 12 |
| EX:dental-imaging:dental-visit:c589ae73 | **P0** | Cross-module DB schema import | `dental-imaging` imports `dentalVisits` + `dentalBranches` FKs from `dental-visit`/`dental-org` (imaging_finding schema) | `dental-imaging/repos/imaging_finding.schema.ts` | 11 |
| EX:dental-pmd:dental-visit:39909324 | **P0** | Cross-module DB schema import | `dental-pmd` imports `dentalVisits`/`dentalBranches`/`dentalMemberships` FKs from `dental-visit`/`dental-org` (pmd-document schema) | `dental-pmd/repos/pmd-document.schema.ts` | 10 |
| EX:dental-scheduling:dental-visit:33046210 | **P0** | Cross-module DB schema import | `dental-scheduling` imports `dentalVisits` FK from `dental-visit` (dental-appointment schema) | `dental-scheduling/repos/dental-appointment.schema.ts` | 13 |
| EX:dental-patient:dental-visit:118575cf | **P1** | Cross-module handler re-export | `dental-patient/treatment-plans/getTreatmentPlanVersion.ts` is a pure re-export shim for a `dental-visit` handler | `dental-patient/treatment-plans/getTreatmentPlanVersion.ts` | 1 |
| EX:dental-patient:dental-visit:88e93216 | **P1** | Cross-module handler re-export | `dental-patient/treatment-plans/getTreatmentPlan.ts` is a pure re-export shim for a `dental-visit` handler | `dental-patient/treatment-plans/getTreatmentPlan.ts` | 1 |
| EX:dental-patient:dental-visit:76c3c851 | **P1** | Cross-module handler re-export | `dental-patient/treatment-plans/acceptTreatmentPlan.ts` is a pure re-export shim for a `dental-visit` handler | `dental-patient/treatment-plans/acceptTreatmentPlan.ts` | 1 |
| EX:dental-org:dental-scheduling:5e7e6b09 | **P1** | Cross-module handler re-export | `dental-org/updateWorkingHours.ts` is a pure re-export shim for a `dental-scheduling` handler | `dental-org/updateWorkingHours.ts` | 1 |
| EX:dental-org:dental-scheduling:750443cf | **P1** | Cross-module handler re-export | `dental-org/getWorkingHours.ts` is a pure re-export shim for a `dental-scheduling` handler | `dental-org/getWorkingHours.ts` | 1 |
| EX:dental-patient:dental-visit:6c085626 | **P1** | Cross-module service function import | `dental-patient` calls `findVisits()` from `dental-visit/utils/visit.service` directly | `dental-patient/identity/listPatientConditions.ts` | 15 |
| EX:dental-patient:dental-visit:9455d18d | **P1** | Cross-module facade import | `dental-patient` calls `getChartForPatientVisit`/`getTreatmentsForPatientConditions` from `dental-visit` repos facade | `dental-patient/identity/listPatientConditions.ts` | 16 |
| EX:dental-patient:dental-visit:7aa47f0a | **P1** | Cross-module repo class import | `dental-patient` instantiates `DentalChartRepository` and `VisitRepository` from `dental-visit` repos | `dental-patient/identity/initializeDentition.ts` | 14 |
| EX:dental-patient:dental-org:4f5df4fd | **P1** | Cross-module repo class import | `dental-patient` instantiates `BranchRepository` from `dental-org` repos | `dental-patient/identity/listDentalPatients.ts` | 13 |
| EX:dental-visit:EVENT_CONTRACTS:7ae5f63a | **P1** | Event contract gap — emitter missing | DE-001 (VisitCheckedIn), DE-002 (VisitCompleted), DE-003 (VisitLocked): zero event emission code found in `dental-visit/`; events declared in EVENT_CONTRACTS but never published | `dental-visit/` | — |
| EX:dental-visit:EVENT_CONTRACTS:88bb23d9 | **P1** | Event contract gap — emitter missing | DE-004 (TreatmentDiagnosed), DE-005 (TreatmentPerformed), DE-006 (TreatmentDismissed): zero event emission code found; `dental-billing` is declared subscriber but events are never emitted | `dental-visit/` | — |
| EX:dental-billing:EVENT_CONTRACTS:669a7972 | **P1** | Event contract gap — emitter missing | DE-007 (InvoiceCreated), DE-008 (InvoicePaid), DE-009 (InvoiceVoided): zero event emission code found in `dental-billing/` handlers | `dental-billing/` | — |
| EX:dental-scheduling:EVENT_CONTRACTS:9db2f4b8 | **P1** | Event contract gap — emitter missing | DE-010 (AppointmentBooked), DE-011 (AppointmentCancelled): zero event emission code found in `dental-scheduling/` handlers | `dental-scheduling/` | — |
| EX:dental-billing:EVENT_CONTRACTS:96796cc1 | **P1** | Event contract gap — consumer not implemented | `dental-billing` declared as consumer of DE-001..DE-006 (visit/treatment events) in EVENT_CONTRACTS §4 but no consumer/subscriber code exists in module | `dental-billing/` | — |
| EX:dental-pmd:EVENT_CONTRACTS:1b4e7b93 | **P1** | Event contract gap — consumer not implemented | `dental-pmd` declared as consumer of DE-002 (VisitCompleted) in EVENT_CONTRACTS §4 but no consumer code exists in module | `dental-pmd/` | — |
| EX:dental-audit:EVENT_CONTRACTS:07c379af | **P1** | Event contract schema mismatch | `dental-audit` consumer uses generic `DentalAuditDomainEvent{action, targetType}` envelope; does not match typed DE-001..DE-023 payload schemas (visit_id, patient_id, invoice_id, etc.) declared in EVENT_CONTRACTS | `dental-audit/consumers/domain-events.consumer.ts` | 7 |
| EX:dental-patient:dental-visit:1af67d7b | **P2** | Facade boundary bypass | `dental-patient` imports internal `visit-dental-patient.facade` directly from `dental-visit/repos/` rather than a published API surface | `dental-patient/identity/listPatientConditions.ts` | 16 |
| EX:dental-imaging:dental-clinical:f4be7918 | **P2** | Indirect coupling — 2-hop schema chain | `dental-clinical/repos/clinical-imaging.facade.ts` re-exports data that includes `dentalVisits` schema; `dental-imaging` consumes this creating an undeclared transitive schema dependency | `dental-clinical/repos/clinical-imaging.facade.ts` | 9 |
| EX:dental-audit:all:6fae3730 | **P3** | Audit infra inconsistency | `publishAuditEvent` / `DENTAL_AUDIT_EVENTS_QUEUE` defined in `dental-audit` but never imported by other modules; actual audit calls use `logAuditEvent` (core) which bypasses the typed event queue — inconsistent with EVENT_CONTRACTS consumer table declaring `dental-audit` as subscriber of DE-001..DE-023 | `dental-audit/consumers/domain-events.consumer.ts` | 19 |

---

## Import Graph (cross-module)

```
dental-patient  ──→ dental-visit   (schema: dentalVisits; repos: DentalChartRepository, VisitRepository; utils: findVisits; facade: visit-dental-patient.facade; handler re-exports: 3 shims)
dental-patient  ──→ dental-billing (schema: dentalInvoices, dentalInvoiceLineItems, dentalPayments)
dental-patient  ──→ dental-clinical (schema: medicalHistoryEntries)
dental-patient  ──→ dental-org     (repo class: BranchRepository)

dental-clinical ──→ dental-visit   (schema: dentalVisits, treatmentPlanVersions — 7 schema files)
dental-clinical ──→ dental-org     (schema: dentalBranches, dentalMemberships — 4 schema files)

dental-billing  ──→ dental-visit   (schema: dentalVisits, dentalTreatments)
dental-billing  ──→ dental-org     (schema: dentalBranches, dentalMemberships)

dental-visit    ──→ dental-org     (schema: dentalBranches, dentalMemberships — 3 schema files)

dental-imaging  ──→ dental-visit   (schema: dentalVisits)
dental-imaging  ──→ dental-org     (schema: dentalBranches)
dental-imaging  ──→ dental-clinical (facade: clinical-imaging.facade — indirect via schema)

dental-pmd      ──→ dental-visit   (schema: dentalVisits)
dental-pmd      ──→ dental-org     (schema: dentalBranches, dentalMemberships)

dental-scheduling ──→ dental-visit  (schema: dentalVisits)
dental-scheduling ──→ dental-org    (schema: dentalBranches, dentalMemberships)

dental-org      ──→ dental-scheduling (handler re-exports: 2 shims)
```

> **dental-org is the gravitational center.** Every module pulls its schema directly. This is the primary remediation target.

---

## Event Contract Status

| Event | Declared | Emitter in code | Consumer in code | Status |
|-------|----------|----------------|-----------------|--------|
| DE-001 `VisitCheckedIn@1` | ✅ | ❌ not found | ❌ dental-audit (generic only) | GAP |
| DE-002 `VisitCompleted@1` | ✅ | ❌ not found | ❌ dental-pmd: missing, dental-audit: generic | GAP |
| DE-003 `VisitLocked@1` | ✅ | ❌ not found | ❌ dental-audit (generic only) | GAP |
| DE-004 `TreatmentDiagnosed@1` | ✅ | ❌ not found | ❌ dental-billing: missing | GAP |
| DE-005 `TreatmentPerformed@1` | ✅ | ❌ not found | ❌ dental-billing: missing | GAP |
| DE-006 `TreatmentDismissed@1` | ✅ | ❌ not found | ❌ dental-billing: missing | GAP |
| DE-007 `InvoiceCreated@1` | ✅ | ❌ not found | ❌ notifs: no consumer found | GAP |
| DE-008 `InvoicePaid@1` | ✅ | ❌ not found | ❌ notifs: no consumer found | GAP |
| DE-009 `InvoiceVoided@1` | ✅ | ❌ not found | ❌ dental-audit (generic only) | GAP |
| DE-010 `AppointmentBooked@1` | ✅ | ❌ not found | ❌ notifs: no consumer found | GAP |
| DE-011 `AppointmentCancelled@1` | ✅ | ❌ not found | ❌ notifs: no consumer found | GAP |
| DE-012 `ConsentSigned@1` | ✅ | ❌ not found | ❌ dental-audit (generic only) | GAP |
| DE-013 `ConsentRevoked@1` | ✅ | ❌ not found | ❌ dental-audit (generic only) | GAP |
| DE-014 `LabOrderCreated@1` | ✅ | ❌ not found | ❌ none confirmed | GAP |
| DE-015 `LabOrderCompleted@1` | ✅ | ❌ not found | ❌ notifs: no consumer found | GAP |
| DE-016 `PrescriptionWritten@1` | ✅ | ❌ not found | ❌ none confirmed | GAP |
| DE-017 `PMDGenerated@1` | ✅ | ❌ not found | ❌ notifs: no consumer found | GAP |
| DE-018 `ImagingStudyUploaded@1` | ✅ | ❌ not found | ❌ none confirmed | GAP |
| DE-019 `ImagingFindingConfirmed@1` | ✅ | ❌ not found | ❌ dental-clinical: no consumer code | GAP |
| DE-020 `CephAnalysisComputed@1` | ✅ | ❌ not found | ❌ none confirmed | GAP |
| DE-021 `PatientRegistered@1` | ✅ | ❌ not found | ❌ notifs: no consumer found | GAP |
| DE-022 `MembershipAssigned@1` | ✅ | ❌ not found | ❌ notifs: no consumer found | GAP |
| DE-023 `MembershipRevoked@1` | ✅ [INFERRED] | ❌ not found | ❌ dental-audit (generic only) | GAP |
| DE-024 `PatientMergeRequested@1` | ✅ [NOT IMPLEMENTED] | ❌ n/a | ❌ n/a | FUTURE |

> **All 23 active events: emitter = ❌.** The event system is fully specified but not wired. No module publishes typed domain events. `dental-audit` has a consumer registered for a generic internal queue `dental.audit.domain-events` but this queue is never triggered from other modules — only `logAuditEvent` (core) is called.

---

## Dependency Health Matrix

| Module A → Module B | Import Type | Count | P0 | P1 | Declared in MODULE_MAP? |
|---------------------|-------------|-------|----|----|------------------------|
| dental-patient → dental-visit | schema + repo-class + handler re-exports + service fn + facade | 9 | 3 | 6 | Yes (undocumented depth) |
| dental-patient → dental-billing | schema | 3 | 3 | 0 | No |
| dental-patient → dental-clinical | schema | 1 | 1 | 0 | No |
| dental-patient → dental-org | repo-class | 1 | 0 | 1 | No |
| dental-clinical → dental-visit | schema (7 files) | 7 | 7 | 0 | Yes (documented as P1 risk) |
| dental-clinical → dental-org | schema (4 files) | 4 | 4 | 0 | Yes |
| dental-billing → dental-visit | schema | 2 | 2 | 0 | Yes (documented as P2 risk) |
| dental-billing → dental-org | schema | 2 | 2 | 0 | Yes (documented as P2 risk) |
| dental-visit → dental-org | schema (3 files) | 3 | 3 | 0 | Not documented |
| dental-imaging → dental-visit | schema | 1 | 1 | 0 | Loose coupling OK (UUID) |
| dental-imaging → dental-org | schema | 1 | 1 | 0 | Not documented |
| dental-imaging → dental-clinical | facade (indirect) | 1 | 0 | 0 | No |
| dental-pmd → dental-visit | schema | 1 | 1 | 0 | Not documented |
| dental-pmd → dental-org | schema | 1 | 1 | 0 | Not documented |
| dental-scheduling → dental-visit | schema | 1 | 1 | 0 | Not documented |
| dental-scheduling → dental-org | schema | 2 | 2 | 0 | Not documented |
| dental-org → dental-scheduling | handler re-export | 2 | 0 | 2 | Not documented |

---

## Analysis Notes

### Why so many P0 schema imports?

All FK references in Drizzle ORM schemas require importing the parent table's Drizzle table object for the `.references()` call. This is idiomatic Drizzle — you cannot define a FK without the parent table object. The **root cause** is that all dental modules share a single PostgreSQL database with cross-schema FK constraints modeled in Drizzle. This makes these P0s unavoidable under the current architecture.

**Remediation path (choose one):**
1. **Consolidate schema** — move all `dental-*` Drizzle schemas into a single `dental-core/schemas/` package consumed by all modules as a shared type layer (allows FK references without module boundary violations)
2. **Decouple FKs** — replace cross-module FK columns with bare UUID columns; enforce referential integrity at the application layer or via DB triggers instead of Drizzle `.references()`. Schema imports then become pure `type` imports only
3. **Accept as structural debt** — document schema imports as "allowed structural FK coupling" in MODULE_BOUNDARIES.md; enforce that only `*.schema.ts` files may cross-import schemas (no handler or repo logic allowed)

Option 3 is the lowest-friction path for an MVP-stage codebase. The MODULE_BOUNDARIES.md **Exempt Modules** section should be expanded to cover schema FK coupling explicitly.

### Handler re-exports (P1)

Five shim files (`dental-patient/treatment-plans/*.ts`, `dental-org/getWorkingHours.ts`, `dental-org/updateWorkingHours.ts`) are thin pass-through re-exports from another module's handler. These exist because route registration needed the handler under a different URL namespace. Fix: either move the handler to a shared location, duplicate the registration in the source module, or accept the re-export as a documented routing adapter (lower priority than schema issues).

### Event system (P1 — systemic)

Zero domain events are emitted anywhere in the codebase. The entire event system in EVENT_CONTRACTS is aspirational. No publication, no typed consumer subscriptions (dental-billing, dental-pmd, notifs). Only `dental-audit` has a consumer registered, but it uses a bespoke generic queue not triggered by any other module. This is a complete event system gap — the CONTRACT is declared but the wire is not connected.

---

## What's Next

### Immediate (P0 remediation)
1. **Decide schema coupling strategy** — pick Option 1, 2, or 3 above. Document in MODULE_BOUNDARIES.md. This resolves 25 P0s in one architectural decision without necessarily rewriting code.
2. **Expand MODULE_BOUNDARIES.md** — add explicit rule: "`*.schema.ts` files may import FKs from other dental modules; handler and repo logic files may NOT"

### Short-term (P1 remediation)
3. **Remove handler re-export shims** — consolidate treatment-plan handlers under `dental-visit`; register `dental-patient` routes to `dental-visit` handlers directly in the router (no shim files needed)
4. **Working hours ownership** — decide: does `workingHours` belong in `dental-org` or `dental-scheduling`? Move handler to the owning module; update router. Remove shim files.
5. **Replace cross-module repo/service calls** — `listPatientConditions` and `initializeDentition` in `dental-patient` should call `dental-visit` via an HTTP sub-request or a published service interface, not by directly instantiating `VisitRepository`/`DentalChartRepository`

### Medium-term (event system)
6. **Implement domain event emission** — instrument `checkIn`, `completeVisit`, `createInvoice`, `bookAppointment`, etc. to publish typed events matching EVENT_CONTRACTS payload schemas via pg-boss (already in use for dental-audit)
7. **Implement dental-billing event consumer** — subscribe to DE-004..DE-006 for treatment billing triggers
8. **Implement dental-pmd event consumer** — subscribe to DE-002 (VisitCompleted) to auto-generate PMD
9. **Migrate dental-audit consumer** — replace generic `DentalAuditDomainEvent` with per-event typed handlers matching DE-001..DE-023 payload schemas

### Run after fixes
- Re-run `/oli-enforce-module` on `dental-patient`, `dental-clinical`, `dental-billing`, `dental-visit`
- Re-run `/oli-enforce-cross-module` to verify P0 count reduction
