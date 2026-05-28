# Enforcement Coverage Report — Run 5 (F2 Service-Layer/DI)
<!-- oli-enforce-coverage v1.0 | generated: 2026-05-28 | run: run-5-f2-service-layer-di -->

## Summary

| Module | Spec Completeness | Handler Coverage | API Contracts | Service-Layer Section | Overall |
|--------|------------------|-----------------|---------------|-----------------------|---------|
| dental-audit | 70% (14/20) | 35 ops in shared dir | ✅ | ❌ | WARN |
| dental-billing | 100% (20/20) | 15 ops | ✅ | ❌ | WARN |
| dental-clinical | 100% (20/20) | 27 ops | ✅ | ❌ | WARN |
| dental-emr-integration | 65% (13/20) | 6 ops (future_phase) | ✅ | ❌ | WARN |
| dental-imaging | 100% (20/20) | 42 ops | ✅ | ❌ | WARN |
| dental-org | 100% (20/20) | 35 ops | ✅ | ❌ | WARN |
| dental-patient | 100% (20/20) | 46 ops | ✅ | ❌ | WARN |
| dental-perio | 95% (19/20) | 6 ops | ✅ | ❌ | WARN |
| dental-pmd | 95% (19/20) | 7 ops | ✅ | ❌ | WARN |
| dental-scheduling | 100% (20/20) | 11 ops | ✅ | ❌ | WARN |
| dental-visit | 100% (20/20) | 27 ops | ✅ | ❌ | WARN |

**Legend:** Handler Coverage = count of non-schema/non-repo `.ts` files in source dir (proxy for implemented ops). Service-Layer Section = presence of a dedicated service layer / DI section in MODULE_SPEC.

---

## Coverage Gate Result

- **Modules with spec < 70%:** dental-emr-integration (65%) — FUTURE_PHASE, `implementation_status: future_phase (Phase 3+)`, no source dir at `handlers/emr/` (stub exists). Exempted from enforcement.
- **Modules with spec 70–99%:** dental-audit (70%), dental-perio (95%), dental-pmd (95%)
- **Modules at 100%:** dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-scheduling, dental-visit (7 of 11)
- **API Contracts present:** 11/11 ✅
- **Service-Layer/DI section:** 0/11 ❌ — **UNIVERSAL GAP** (F2 target)

### Gate: **WARN** — continue F2 enforcement with caveats

Caveats:
1. `dental-emr-integration` is `future_phase` — exempt from F2 enforcement until Phase 3.
2. `dental-audit` spec at 70% (below 80% ideal); missing Workflow Details, UI/UX, Test Expectations, Edge Cases, Error Handling, Feature Flags sections.
3. No module has a Service-Layer/DI spec section — F2 must add this section to all 10 active modules.
4. Handler counts above include `*.ts` files in shared dirs; `dental-audit` shares the `dental-org/` source dir (audit handlers are co-located there by design).

---

## Per-Module Detail

### dental-audit
- **Spec:** 70% (14/20). Present: Overview, Domain Terms, Workflows, Business Rules, Permissions, Data Requirements, Aggregate Boundaries, State Transitions, API Expectations, Domain Events, Acceptance Criteria, Dependencies, Performance, Observability, Vertical Slice Plan, AI Instructions.
- **Missing sections:** Workflow Details, UI/UX Requirements, Test Expectations, Edge Cases, Error Handling, Feature Flags.
- **Source dir:** `handlers/dental-org/` (shared — audit handlers co-located by design per ARCHITECTURE.md).
- **Handler ops:** ~35 ts files in dir (org + audit mixed); audit-specific handlers not isolated.
- **Key gap:** No dedicated source dir; shared dir makes handler count ambiguous. Spec missing 6 sections.

### dental-billing
- **Spec:** 100% (20/20). All standard sections present.
- **Source dir:** `handlers/dental-billing/` — 23 total `.ts` files, ~15 operation handlers.
- **Operations (spec):** createInvoice, issueInvoice, voidInvoice, recordPayment, createPaymentPlan, updatePaymentPlan, getInvoice, listInvoices, listPayments, getPaymentPlan, getPatientBalance, getCollectionsSummary, applyDiscount, getReceipt, voidPayment.
- **Key gap:** Service-layer section absent.

### dental-clinical
- **Spec:** 100% (20/20). All standard sections present.
- **Source dir:** `handlers/dental-clinical/` — 53 total `.ts` files, ~27 operation handlers.
- **Sub-domains covered:** prescriptions, lab-orders, consent forms, amendments, attachments, medical history, occlusion screening, postop templates, inventory.
- **Key gap:** Service-layer section absent.

### dental-emr-integration
- **Spec:** 65% (13/20). `implementation_status: future_phase (Phase 3+)`.
- **Missing sections:** Workflow Details, UI/UX Requirements, Test Expectations, Edge Cases, Error Handling, Observability, Feature Flags.
- **Source dir:** `handlers/emr/` — 8 `.ts` files (stub implementation: createConsultation, finalizeConsultation, getConsultation, listConsultations, listEMRPatients, updateConsultation + repo + schema).
- **Note:** Spec and stub exist but are marked future_phase. Exempt from F2 active enforcement.

### dental-imaging
- **Spec:** 100% (20/20). All standard sections present. Includes v1.4 ceph workflows (WF-030, WF-031).
- **Source dir:** `handlers/dental-imaging/` — 48 total `.ts` files, ~42 operation handlers.
- **Sub-domains covered:** studies, patient images, findings, ceph landmarks, ceph analysis, ceph reports, calibration, modality.
- **Key gap:** Service-layer section absent.

### dental-org
- **Spec:** 100% (20/20). All standard sections present.
- **Source dir:** `handlers/dental-org/` — 46 total `.ts` files, ~35 operation handlers.
- **Sub-domains covered:** branches, memberships, consent templates, fee schedules, working hours, pin management, security questions.
- **Key gap:** Service-layer section absent.

### dental-patient
- **Spec:** 100% (20/20). All standard sections present.
- **Source dir:** `handlers/dental-patient/` — 69 total `.ts` files, ~46 operation handlers.
- **Sub-domains covered:** patient CRUD, alerts, contacts, insurance, medical history, safety floor, dentition.
- **Key gap:** Service-layer section absent. Largest handler surface area in codebase.

### dental-perio
- **Spec:** 95% (19/20). Missing: AI Instructions section (section 20).
- **Source dir:** `handlers/dental-perio/` — 10 total `.ts` files, ~6 operation handlers.
- **Operations:** completePerioChart, createPerioChart, getPerioChart, getVisitPerioChart, upsertToothReading + 1 more.
- **Key gap:** Service-layer section absent; AI Instructions section missing (minor).

### dental-pmd
- **Spec:** 95% (19/20). Missing: Workflow Details section (section 4).
- **Source dir:** `handlers/dental-pmd/` — 10 total `.ts` files, ~7 operation handlers.
- **Operations:** exportPMD, generatePMD, getImportedPMD, getPMDForVisit, importPMD + 2 more.
- **Key gap:** Service-layer section absent; Workflow Details section missing (no WF-xxx step sequences).

### dental-scheduling
- **Spec:** 100% (20/20). All standard sections present.
- **Source dir:** `handlers/dental-scheduling/` — 18 total `.ts` files, ~11 operation handlers.
- **Operations:** cancelAppointment, checkInAppointment, createAppointment, createQueueItem, getAppointment + 6 more.
- **Key gap:** Service-layer section absent.

### dental-visit
- **Spec:** 100% (20/20). All standard sections present.
- **Source dir:** `handlers/dental-visit/` — 42 total `.ts` files, ~27 operation handlers.
- **Sub-domains covered:** chart, dentition, treatments, treatment templates, treatment plans, visit CRUD, notes, carry-over.
- **Key gap:** Service-layer section absent.

---

## F2 Focus: Service-Layer Coverage

### Universal Gap

**0 of 11 modules** have a Service-Layer / DI section in their MODULE_SPEC.

This is the primary target for F2 enforcement. Every active module spec must gain a new section:

```
## 21. Service-Layer / Dependency Injection

### Service Class
- Class name: `[Module]Service` (e.g., `DentalVisitService`)
- File: `services/api-ts/src/handlers/[dir]/[module].service.ts`
- Pattern: constructor injection (repo instances injected for testability)

### Constructor Signature
```ts
constructor(
  private readonly repo: [Module]Repo = new [Module]Repo(),
  // ...additional repos
)
```

### DI Rules
- Handlers import service singleton; never instantiate repo directly
- Service methods carry `ctx: RequestContext` as first param
- No static methods; all instance methods for mockability
```

### Modules with existing `.service.ts` files (partial DI already in code)

Based on source tree scan:
- `dental-visit` → `visit.service.ts` found ✅ (code ahead of spec)
- All others → no `.service.ts` files detected (DI not yet implemented in code either)

### Priority Order for F2 Spec + Code Work

| Priority | Module | Reason |
|----------|--------|--------|
| P0 | dental-visit | `.service.ts` exists — spec must catch up |
| P1 | dental-patient | Largest handler surface (46 ops); highest DI payoff |
| P1 | dental-clinical | 27 ops, complex sub-domains |
| P1 | dental-imaging | 42 ops, ceph complexity |
| P2 | dental-org | 35 ops, shared dir with audit |
| P2 | dental-billing | 15 ops, payment safety critical |
| P2 | dental-scheduling | 11 ops, moderate complexity |
| P3 | dental-perio | 6 ops, simpler |
| P3 | dental-pmd | 7 ops, simpler |
| P3 | dental-audit | Co-located in org dir; spec needs 6 sections too |
| EXEMPT | dental-emr-integration | future_phase |

---

## Remediation Checklist (F2)

- [ ] Add section `21. Service-Layer / DI` to 10 active module specs
- [ ] Create `[module].service.ts` for 9 modules missing it (visit already has one)
- [ ] dental-audit: add 6 missing spec sections (Workflow Details, UI/UX, Test Expectations, Edge Cases, Error Handling, Feature Flags)
- [ ] dental-perio: add section 20 (AI Instructions)
- [ ] dental-pmd: add section 4 (Workflow Details with WF step sequences)
- [ ] dental-emr-integration: defer all F2 work to Phase 3

---

*Generated by oli-enforce-coverage | run-5-f2-service-layer-di | 2026-05-28*
