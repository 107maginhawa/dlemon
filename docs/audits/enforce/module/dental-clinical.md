# dental-clinical — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Findings: 10 (P0: 2, P1: 4, P2: 3, P3: 1)
- Service-Layer Pattern: PARTIAL (repos present, no `.service.ts`, raw-DB leak in handlers)
- Compliance Score: 66/100

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|----------|
| EM-CLI-001 | P0 | `PATCH /visits/:id/consent-forms/:cid/revoke` endpoint entirely missing — no handler, no route | `consent/` dir (absent) | — | API_CONTRACTS: PATCH …/revoke; BR-014 |
| EM-CLI-002 | P0 | `updateMedicalHistoryEntry` implements mutable PATCH on append-only resource — contract mandates 405 `MEDICAL_HISTORY_IMMUTABLE`, not a real update | `medical-history/updateMedicalHistoryEntry.ts` | all | API_CONTRACTS: PATCH/DELETE → 405 |
| EM-CLI-003 | P1 | `createPrescription` performs raw `db.select().from(medicalHistoryEntries)` inline for allergy cross-check — Drizzle called directly in handler, bypassing repo layer | `prescriptions/createPrescription.ts` | 37–46 | F2: Service-Layer/DI |
| EM-CLI-004 | P1 | No `.service.ts` file exists anywhere in the module — business logic (allergy check, visit-immutable guard, FSM) split across handlers and repos with no coordinating service boundary | entire module | — | F2: Service-Layer/DI |
| EM-CLI-005 | P1 | `createPrescription` does not validate that `prescriberMemberId` is non-null/non-empty at runtime — BR-017 requires 422 `PRESCRIBER_REQUIRED`; relies solely on generated Zod schema with no explicit guard | `prescriptions/createPrescription.ts` | 49–60 | BR-017; §15 Error Handling |
| EM-CLI-006 | P1 | `createPrescription`, `createConsentForm`, `createAttachment` skip BR-003 visit-immutable check — only `createLabOrder` guards against writes to completed/locked visits; three other write handlers silently accept them | `prescriptions/createPrescription.ts`, `consent/createConsentForm.ts`, `attachments/createAttachment.ts` | — | BR-003; §15 VISIT_IMMUTABLE |
| EM-CLI-007 | P2 | `postop/createPostopTemplate.ts:22` and `postop/listPostopTemplates.ts:25` call `db.select().from(dentalBranches)` inline — branch lookup should route through a shared repo/facade | `postop/createPostopTemplate.ts`, `postop/listPostopTemplates.ts` | 22, 25 | F2: Service-Layer/DI |
| EM-CLI-008 | P2 | Same raw-DB branch lookup in `inventory/createInventoryItem.ts:24` and `inventory/listInventoryItems.ts:21` | `inventory/createInventoryItem.ts`, `inventory/listInventoryItems.ts` | 24, 21 | F2: Service-Layer/DI |
| EM-CLI-009 | P2 | `createAttachment` accepts `mimeType` from request body with no server-side allow-list check — contract specifies 422 `UNSUPPORTED_MIME_TYPE` for non-`image/*`/`application/pdf`; enforcement deferred entirely to upstream Zod | `attachments/createAttachment.ts` | all | API_CONTRACTS: POST …/attachments; §15 |
| EM-CLI-010 | P3 | All handlers instantiate repos with `new XxxRepository(db)` ad-hoc per request — no singleton export or factory; minor testability inconsistency | all handler files | — | F2: Service-Layer/DI |

---

## F2: Service-Layer/DI Assessment

### Repository Layer: PRESENT (correct)
Nine dedicated `.repo.ts` files exist under `repos/` and are correctly used in most handlers:

```
repos/prescription.repo.ts       — extends DatabaseRepository, constructor(db)
repos/lab-order.repo.ts          — contains FSM (LAB_ORDER_TRANSITIONS), updateStatus()
repos/consent-form.repo.ts       — sign(), immutable-after-signed enforced in DB layer
repos/amendment.repo.ts
repos/attachment.repo.ts
repos/medical-history.repo.ts
repos/inventory.repo.ts
repos/occlusion-screening.repo.ts
repos/postop-template.repo.ts
```

### Service Layer: ABSENT
No `*.service.ts` exists. Business logic that belongs in a service is distributed:

| Logic | Current location | Should be in |
|-------|-----------------|--------------|
| Allergy cross-check (FR1.12) | `createPrescription.ts` lines 37–46 — raw `db.select()` | `prescription.service.ts` |
| Visit-immutable guard (BR-003) | Only `createLabOrder.ts`; missing from 3 write handlers | shared `clinical.service.ts` |
| Consent-revoke workflow | Not implemented | `consent.service.ts` |
| Medical-history immutability | Incorrectly mutable PATCH | `medical-history.service.ts` returning 405 |

### Raw Drizzle in Handlers (Violations — EM-CLI-003, EM-CLI-007, EM-CLI-008)

```typescript
// prescriptions/createPrescription.ts:37 — raw Drizzle in handler
const allergies = await db.select().from(medicalHistoryEntries).where(
  and(
    eq(medicalHistoryEntries.patientId, body.patientId),
    eq(medicalHistoryEntries.entryType, 'allergy'),
    eq(medicalHistoryEntries.active, true)
  )
);

// postop/createPostopTemplate.ts:22 — raw Drizzle in handler
const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));

// inventory/createInventoryItem.ts:24 — raw Drizzle in handler
const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
```

### Constructor Injection Pattern
Repos accept `db` via constructor — correct. All handlers instantiate ad-hoc:
```typescript
// Current (ad-hoc per request):
const repo = new PrescriptionRepository(db);

// No singletons exported; acceptable for context-scoped DI but inconsistent
```

### Input Validation
All typed handlers use `ctx.req.valid('json')` / `ctx.req.valid('param')` from `@/generated/openapi/validators` — correct OpenAPI-first pattern. No raw `z.parse()` in handlers. `ValidatedContext<Body, Query, Params>` is consistently used on mutation endpoints. Two list handlers (`listPrescriptions`, `deleteAttachment`) correctly use `HandlerContext` with unvalidated `ctx.req.param()`.

### Auth Guard Coverage

| Handler | Auth check | Branch isolation |
|---------|-----------|-----------------|
| createPrescription | assertBranchRole([dentist_owner, dentist_associate]) | via visit.branchId |
| listPrescriptions | assertBranchAccess (read-only, correct) | via visit.branchId |
| updatePrescription | assertBranchRole([dentist_owner, dentist_associate]) | via visit.branchId |
| createLabOrder | assertBranchRole([dentist_owner, dentist_associate]) | via visit.branchId |
| updateLabOrder | assertBranchRole([dentist_owner, dentist_associate]) | via labOrder→visit.branchId |
| createConsentForm | assertBranchRole([dentist_owner, dentist_associate, hygienist]) | via visit.branchId |
| signConsentForm | assertBranchRole([dentist_owner, dentist_associate]) | via consent→visit.branchId |
| **revokeConsentForm** | **MISSING — handler absent (EM-CLI-001)** | **MISSING** |
| createMedicalHistory | assertBranchRole([dentist_owner, dentist_associate, hygienist, staff_full]) | via patient.preferredBranchId |
| updateMedicalHistory | assertBranchRole present but endpoint violates contract (EM-CLI-002) | via patient.preferredBranchId |
| createAttachment | assertBranchRole([dentist_owner, dentist_associate, hygienist]) | via visit.branchId |
| deleteAttachment | assertBranchRole([dentist_owner, dentist_associate]) | via attachment→visit.branchId |
| createAmendment | getActiveMembershipId (membership presence, no explicit role list) | via visit.branchId |

---

## Remediation Priority

1. **EM-CLI-001 (P0)** — Implement `revokeConsentForm` handler + route registration; add `revoke()` to `ConsentFormRepository`
2. **EM-CLI-002 (P0)** — Replace `updateMedicalHistoryEntry` body with 405 + `MEDICAL_HISTORY_IMMUTABLE` response; remove repo `update()` call
3. **EM-CLI-006 (P1)** — Add BR-003 visit-immutable guard to `createPrescription`, `createConsentForm`, `createAttachment` (copy pattern from `createLabOrder`)
4. **EM-CLI-005 (P1)** — Add runtime `if (!body.prescriberMemberId) throw new ValidationError('PRESCRIBER_REQUIRED')` in `createPrescription`
5. **EM-CLI-003/004 (P1)** — Extract allergy cross-check into `MedicalHistoryRepository.findActiveAllergiesByPatient(patientId)` and introduce optional `prescription.service.ts`
6. **EM-CLI-007/008 (P2)** — Replace inline `db.select().from(dentalBranches)` with a shared `BranchRepository.findById()` call in postop and inventory handlers
7. **EM-CLI-009 (P2)** — Add MIME allow-list runtime check in `createAttachment` before repo insert
