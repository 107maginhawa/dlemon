# dental-clinical — Module Enforcement
<!-- oli-enforce-module --strict | run: run-6-strict-2026-05-29 -->

## Summary
- Findings: 14 (P0: 3, P1: 6, P2: 4, P3: 1)
- Service-Layer Pattern: PARTIAL (repos present, no `.service.ts`, raw-DB leak in handlers)
- Compliance Score: 58/100
- New findings vs run-5: 4 (EM-CLI-011..014)
- Resolved vs run-5: 0

## Findings

| ID | Sev | Status | Description | File | Line | Spec Ref |
|----|-----|--------|-------------|------|------|----------|
| EM-CLI-001 | P0 | KNOWN | `revokeConsentForm` handler entirely absent — no file, no route; WF-035 and DE-013 (ConsentRevoked) unimplemented | `consent/` dir (absent) | — | WF-035; §10b DE-013; BR-014 |
| EM-CLI-002 | P0 | KNOWN | `updateMedicalHistoryEntry` implements mutable PATCH on append-only resource — repo `update()` runs real `db.update(medicalHistoryEntries).set(...)`. Spec mandates 405 `MEDICAL_HISTORY_IMMUTABLE` | `medical-history/updateMedicalHistoryEntry.ts`, `repos/medical-history.repo.ts` | all | §5 append-only; §15 |
| EM-CLI-012 | P0 | **NEW** | `prescription` schema has no `status` field — spec §7 requires `status` (pending/dispensed/cancelled); spec §8 defines state machine `pending→dispensed\|cancelled`. No FSM exists for prescription lifecycle | `repos/prescription.schema.ts` | all | §7 Data Requirements; §8 State Transitions |
| EM-CLI-003 | P1 | KNOWN | `createPrescription` calls raw `db.select().from(medicalHistoryEntries)` inline (allergy cross-check, L37–46) — bypasses repo layer | `prescriptions/createPrescription.ts` | 37–46 | F2 Service-Layer/DI |
| EM-CLI-004 | P1 | KNOWN | No `.service.ts` exists anywhere in module — business logic (allergy check, visit-immutable guard, FSM) scattered across handlers and repos | entire module | — | F2 Service-Layer/DI |
| EM-CLI-005 | P1 | KNOWN | `createPrescription` relies solely on Zod for `prescriberMemberId` presence — no explicit runtime 422 `PRESCRIBER_REQUIRED` guard; BR-017 requires active-membership validation beyond type presence | `prescriptions/createPrescription.ts` | 49–60 | BR-017; §15 PRESCRIBER_REQUIRED |
| EM-CLI-006 | P1 | KNOWN | BR-003 visit-immutable check absent from `createPrescription`, `createConsentForm`, `createAttachment` — only `createLabOrder` enforces it | `prescriptions/createPrescription.ts`, `consent/createConsentForm.ts`, `attachments/createAttachment.ts` | all | BR-003; §15 VISIT_IMMUTABLE |
| EM-CLI-011 | P1 | **NEW** | `createAmendment` uses `getActiveMembershipId` (membership-presence check only) instead of `assertBranchRole([dentist_owner, dentist_associate])` — spec §6 limits amendments to dentist roles; any active branch member can currently create amendments | `amendments/createAmendment.ts` | 30–31 | §6 Permissions; §20 AI Instructions |
| EM-CLI-013 | P1 | **NEW** | Lab order state names diverge from spec — spec §8 defines `ordered→sent→completed/cancelled`; implementation uses `ordered→in_fabrication→delivered→fitted/cancelled`. API contract and TypeSpec must be reconciled with implementation or spec updated | `repos/lab-order.schema.ts` | 13–16, 40–48 | §8 State Transitions; §10 API |
| EM-CLI-007 | P2 | KNOWN | `postop/createPostopTemplate.ts:22` and `postop/listPostopTemplates.ts:25` call raw `db.select().from(dentalBranches)` inline — should use shared repo/facade | `postop/createPostopTemplate.ts`, `postop/listPostopTemplates.ts` | 22, 25 | F2 Service-Layer/DI |
| EM-CLI-008 | P2 | KNOWN | Same raw-DB branch lookup in `inventory/createInventoryItem.ts:24` and `inventory/listInventoryItems.ts:21` | `inventory/createInventoryItem.ts`, `inventory/listInventoryItems.ts` | 24, 21 | F2 Service-Layer/DI |
| EM-CLI-009 | P2 | KNOWN | `createAttachment` accepts any `mimeType` from body — no server-side allow-list; spec §15 requires 422 `UNSUPPORTED_MIME_TYPE` for non-`image/*`/`application/pdf` | `attachments/createAttachment.ts` | all | §15 UNSUPPORTED_MIME_TYPE; §16 |
| EM-CLI-014 | P2 | **NEW** | Zero domain events emitted anywhere in module — DE-012 (ConsentSigned), DE-013 (ConsentRevoked), DE-014 (LabOrderCreated), DE-015 (LabOrderCompleted), DE-016 (PrescriptionWritten) all absent; no `emit`, `publish`, or event-bus call in any non-test handler | entire module | — | §10b Domain Events |
| EM-CLI-010 | P3 | KNOWN | All handlers instantiate repos ad-hoc per request via `new XxxRepository(db)` — no singleton/factory pattern | all handler files | — | F2 Service-Layer/DI |

---

## §1–20 Section-by-Section Compliance

| § | Topic | Status | Notes |
|---|-------|--------|-------|
| §1 | Overview | PASS | Rx, lab orders, consent, med history, attachments all present |
| §2 | Domain Terms | PASS | All 5 entities modelled in schema |
| §3 | Workflows | PARTIAL | WF-016/017/018/038/039 implemented; WF-035 (consent revoke) absent |
| §4 | Workflow Details | PARTIAL | WF-038 correct (supervisor approval 501); WF-016 missing visit-immutable pre-check |
| §5 | Business Rules | PARTIAL | BR-003 only in `createLabOrder`; BR-017 Zod-only; BR-018 FSM correct; BR-019 501 correct |
| §6 | Permissions | PARTIAL | Rx/lab dentist-only correct; amendment: membership check only, no dentist-role restriction (EM-CLI-011) |
| §7 | Data Requirements | PARTIAL | `prescription` missing `status` field (EM-CLI-012); consent schema uses boolean `signed` not enum — no `revoked` state persisted |
| §7b | Aggregate Boundaries | PASS | All visit-scoped via `visit_id` FK |
| §8 | State Transitions | PARTIAL | Lab order state names diverge from spec (EM-CLI-013); consent has no revoke transition; prescription has no status FSM (EM-CLI-012) |
| §9 | UI/UX | N/A | Frontend not in scope |
| §10 | API | PARTIAL | `revokeConsent` endpoint absent; prescription status update endpoint absent |
| §10b | Domain Events | FAIL | DE-012..016 all absent (EM-CLI-014) |
| §11 | ACs | PARTIAL | AC-MED-01..05 and AC-PRES-01..05 covered; consent revoke, prescription status FSM untested |
| §12 | Test Expectations | PARTIAL | 9 test files; revoke, domain events, prescription status FSM untested |
| §13 | Edge Cases | PARTIAL | Duplicate-sign guard works; locked-visit guard missing from 3 handlers (EM-CLI-006) |
| §14 | Dependencies | PASS | dental-org, dental-visit, storage, dental-patient all referenced |
| §15 | Error Handling | PARTIAL | VISIT_IMMUTABLE 422 only in `createLabOrder`; MEDICAL_HISTORY_IMMUTABLE 405 not implemented |
| §16 | Performance | PARTIAL | 50 MB limit stored as bigint in schema; not enforced at handler layer |
| §17 | Observability | PASS | PHI clean: `drugName` and `signatureData` absent from all log calls |
| §18 | Feature Flags | PASS | None required |
| §19 | Vertical Slice Plan | PARTIAL | CLI-S1..S5 done; CLI-S6 (amendments + G-003 decoupling) in progress |
| §20 | AI Instructions | PARTIAL | assertBranchAccess/Role present in 13/14 write handlers; `createAmendment` uses weaker check (EM-CLI-011) |

---

## F2: Service-Layer/DI Assessment

### Repository Layer: PRESENT (correct)
Nine dedicated `.repo.ts` files under `repos/`:

```
repos/prescription.repo.ts       — DatabaseRepository; no status field/FSM (EM-CLI-012)
repos/lab-order.repo.ts          — LAB_ORDER_TRANSITIONS FSM, updateStatus()
repos/consent-form.repo.ts       — sign(), immutable-after-signed enforced at DB; no revoke() (EM-CLI-001)
repos/amendment.repo.ts
repos/attachment.repo.ts
repos/medical-history.repo.ts    — has update() method violating append-only (EM-CLI-002)
repos/inventory.repo.ts
repos/occlusion-screening.repo.ts
repos/postop-template.repo.ts
```

### Service Layer: ABSENT
No `*.service.ts` exists. Business logic distributed:

| Logic | Current location | Should be in |
|-------|-----------------|--------------|
| Allergy cross-check (FR1.12) | `createPrescription.ts` L37–46 raw Drizzle | `prescription.service.ts` |
| Visit-immutable guard (BR-003) | `createLabOrder.ts` only | shared `clinical.service.ts` |
| Prescription FSM | Not implemented | `prescription.service.ts` |
| Consent-revoke workflow | Not implemented | `consent.service.ts` |
| Medical-history immutability | Incorrectly mutable PATCH | `medical-history.service.ts` returning 405 |

### Raw Drizzle in Handlers (Violations — EM-CLI-003, EM-CLI-007, EM-CLI-008)

```typescript
// prescriptions/createPrescription.ts:37 — raw Drizzle in handler
const allergies = await db.select().from(medicalHistoryEntries).where(
  and(eq(medicalHistoryEntries.patientId, body.patientId), ...)
);

// postop/createPostopTemplate.ts:22 — raw Drizzle in handler
const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));

// inventory/createInventoryItem.ts:24 — raw Drizzle in handler
const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
```

### Constructor Injection Pattern
Repos accept `db` via constructor — correct. All handlers instantiate ad-hoc per request (no singletons).

### Input Validation
All typed handlers use `ctx.req.valid('json')` / `ctx.req.valid('param')` from `@/generated/openapi/validators`. No raw `z.parse()` in handlers. Consistent `ValidatedContext<Body, Query, Params>` pattern on mutation endpoints.

### Auth Guard Coverage (strict — all 17 endpoints)

| Handler | Auth check | Branch isolation | Result |
|---------|-----------|-----------------|--------|
| createPrescription | assertBranchRole([dentist_owner, dentist_associate]) | via visit.branchId | PASS |
| listPrescriptions | assertBranchAccess | via visit.branchId | PASS |
| updatePrescription | assertBranchRole([dentist_owner, dentist_associate]) | via visit.branchId | PASS |
| createLabOrder | assertBranchRole([dentist_owner, dentist_associate]) | via visit.branchId | PASS |
| listLabOrders | assertBranchAccess | via visit.branchId | PASS |
| updateLabOrder | assertBranchRole([dentist_owner, dentist_associate]) | via labOrder→visit.branchId | PASS |
| createConsentForm | assertBranchRole([dentist_owner, dentist_associate, hygienist]) | via visit.branchId | PASS |
| signConsentForm | assertBranchRole([dentist_owner, dentist_associate]) | via consent→visit.branchId | PASS |
| **revokeConsentForm** | **MISSING — handler absent (EM-CLI-001)** | — | FAIL |
| listConsentForms | assertBranchAccess | via visit.branchId | PASS |
| createMedicalHistoryEntry | assertBranchRole([dentist_owner, dentist_associate, hygienist, staff_full]) | via patient.preferredBranchId | PASS |
| updateMedicalHistoryEntry | assertBranchRole present; endpoint violates append-only (EM-CLI-002) | via patient.preferredBranchId | FAIL |
| createAttachment | assertBranchRole([dentist_owner, dentist_associate, hygienist]) | via visit.branchId | PASS |
| deleteAttachment | assertBranchRole([dentist_owner, dentist_associate]) | via attachment→visit.branchId | PASS |
| listAttachments | assertBranchAccess | via visit.branchId | PASS |
| **createAmendment** | **getActiveMembershipId only — no role restriction (EM-CLI-011)** | via visit.branchId | FAIL |
| listAmendments | assertBranchAccess | via visit.branchId | PASS |

### Strict Checks (run-6 additions)

**PHI Logging — PASS**
- `createPrescription` log fields: `{prescriptionId, visitId, prescriberMemberId, by}` — `drugName` NOT logged
- `signConsentForm` log fields: `{consentId, visitId, by}` — `signatureData` NOT logged

**Medical History Append-Only — FAIL (EM-CLI-002)**
- `updateMedicalHistoryEntry.ts` calls `repo.update(entryId, { displayName, notes, resolvedDate, active })`
- `MedicalHistoryRepository.update()` runs `db.update(medicalHistoryEntries).set({ ...patch, updatedAt: new Date() })`
- Direct mutation of append-only records; endpoint must return 405 `MEDICAL_HISTORY_IMMUTABLE`

**Consent `signature_data` in logs — PASS**
- `signConsentForm` log at L42–45 only logs IDs; `signatureData` not present

---

## Remediation Priority

### P0 — Block ship
1. **EM-CLI-012**: Add `status` pgEnum (`pending/dispensed/cancelled`) to `prescription` schema + migration + `updateStatus()` in `PrescriptionRepository` + enforce in `updatePrescription` handler
2. **EM-CLI-002**: Replace `updateMedicalHistoryEntry` handler body with 405 `MEDICAL_HISTORY_IMMUTABLE`; remove `update()` from `MedicalHistoryRepository`; add `revoke()` concept for resolving entries via new append-only `resolvedDate` entry
3. **EM-CLI-001**: Implement `revokeConsentForm` handler (`PATCH /visits/:id/consents/:cid/revoke`); add `revokedAt` + `revokedBy` to `consent-form.schema.ts`; emit DE-013

### P1 — Fix before next sprint
4. **EM-CLI-006**: Add BR-003 visit-immutable guard to `createPrescription`, `createConsentForm`, `createAttachment` (copy pattern from `createLabOrder`)
5. **EM-CLI-011**: Replace `getActiveMembershipId` in `createAmendment` with `assertBranchRole([dentist_owner, dentist_associate])`
6. **EM-CLI-013**: Decision required — either update MODULE_SPEC §8 to reflect richer lab-order states (`ordered→in_fabrication→delivered→fitted`) or align schema to spec (`ordered→sent→completed`)
7. **EM-CLI-003/004**: Extract allergy cross-check to `MedicalHistoryRepository.findActiveAllergiesByPatient()`; introduce `prescription.service.ts`
8. **EM-CLI-005**: Add runtime membership validation for `prescriberMemberId` in `createPrescription`

### P2
9. **EM-CLI-014**: Emit domain events (DE-012..016) in handlers post-save
10. **EM-CLI-009**: Add MIME allow-list check in `createAttachment` before DB write
11. **EM-CLI-007/008**: Replace inline `db.select().from(dentalBranches)` with shared `BranchRepository.findById()` in postop + inventory handlers

### P3
12. **EM-CLI-010**: Export repo singletons or factory functions

---

*Generated: 2026-05-29 | Run ID: run-6-strict-2026-05-29 | Baseline: run-5 (p0:2, p1:4, score:66)*
