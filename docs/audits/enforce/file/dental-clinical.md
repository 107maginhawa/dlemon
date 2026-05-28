# dental-clinical — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

**Module spec:** `docs/product/modules/dental-clinical/MODULE_SPEC.md`
**Backend source:** `services/api-ts/src/handlers/dental-clinical/`
**Run focus:** F2 — Service-layer DI (file presence, direct DB calls in handlers, naming, size)

---

## Summary

- Files scanned: 68
- Findings: 11 (P0: 0, P1: 6, P2: 5, P3: 0)
- Service files present: `.service.ts` ❌ (absent), `.repo.ts` ✅ (9 repo files present)

---

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-CLI-001 | P1 | **Missing `.service.ts`** — module has complex multi-domain business logic (prescription allergy checks, FSM-governed prescription states, consent-billing coordination, amendment audit trail) with no service orchestration layer; logic is scattered across handler files | `dental-clinical/` (module-level) | — |
| EF-CLI-002 | P1 | **Direct `db.select()` in handler** — `createPostopTemplate.ts` queries `dentalBranches` directly, bypassing repo layer | `postop/createPostopTemplate.ts` | 22 |
| EF-CLI-003 | P1 | **Direct `db.select()` in handler** — `listPostopTemplates.ts` queries `dentalBranches` directly | `postop/listPostopTemplates.ts` | 25 |
| EF-CLI-004 | P1 | **Direct `db.select()` in handler** — `createInventoryItem.ts` queries `dentalBranches` directly | `inventory/createInventoryItem.ts` | 24 |
| EF-CLI-005 | P1 | **Direct `db.select()` in handler** — `listInventoryItems.ts` queries `dentalBranches` directly | `inventory/listInventoryItems.ts` | 21 |
| EF-CLI-006 | P1 | **Direct `db.select()` in handler** — `createPrescription.ts` queries `medicalHistoryEntries` directly for allergy cross-check; this is business logic that belongs in a service layer | `prescriptions/createPrescription.ts` | 37 |
| EF-CLI-007 | P2 | **Test file too large** (736 lines) — split into per-feature test files | `clinical-prescription-history.test.ts` | — |
| EF-CLI-008 | P2 | **Test file too large** (728 lines) | `clinical-consent-lab.test.ts` | — |
| EF-CLI-009 | P2 | **Test file too large** (616 lines) | `clinical-attachment-amendment.test.ts` | — |
| EF-CLI-010 | P2 | **Test file too large** (551 lines) | `dental-clinical-inventory.test.ts` | — |
| EF-CLI-011 | P2 | **Test file too large** (543 lines) — acceptance test monolith; split by feature slice | `acceptance.clinical-workflows.test.ts` | — |

---

## F2 Analysis: Service-Layer Presence

### `.service.ts` — ABSENT (P1)

No `dental-clinical.service.ts` (or sub-service files) exists. The module contains complex business logic that spans multiple repos and requires orchestration:

- **Prescription allergy check** (`createPrescription.ts:37`) — queries `medicalHistoryEntries` directly from a handler file, then cross-references with the prescription being created. This is multi-repo business logic.
- **FSM transitions** — `prescription.fsm.property.test.ts` (96 lines) confirms prescription state machine complexity. No service file wraps it.
- **Consent-billing coordination** — `repos/consent-billing.facade.ts` provides a facade but no service layer orchestrates the consent create → billing deduction → sign flow.
- **Amendment author resolution** — `amendments/createAmendment.ts` performs a raw membership query to resolve the author's membership ID; this belongs in a service.

**Recommended split:**
```
repos/prescription.service.ts    # allergy check + FSM + prescriber resolution
repos/consent.service.ts         # consent create-sign-revoke lifecycle + billing
repos/amendment.service.ts       # author resolution + approval stub
```

### `.repo.ts` — PRESENT ✅

9 repo files present, covering all functional sub-domains:

| Repo | Sub-domain |
|------|-----------|
| `amendment.repo.ts` | Amendments |
| `attachment.repo.ts` | Attachments |
| `consent-form.repo.ts` | Consent forms |
| `inventory.repo.ts` | Inventory |
| `lab-order.repo.ts` | Lab orders |
| `medical-history.repo.ts` | Medical history |
| `occlusion-screening.repo.ts` | Occlusion screening |
| `postop-template.repo.ts` | Postop templates |
| `prescription.repo.ts` | Prescriptions |

### `.types.ts` — ABSENT (P3/informational)

No `dental-clinical.types.ts`. Domain types (prescription FSM states, consent statuses, lab order statuses) are presumably co-located with schemas. Not raised as a blocking finding given current project conventions, but consolidating exported types would improve discoverability.

---

## Direct DB Calls in Handlers (P1 details)

All five violations follow the same pattern — `db.select().from(dentalBranches)` or `db.select().from(medicalHistoryEntries)` called directly inside a handler function. The correct pattern is to move these into a repo method or service function and inject via parameter.

**Pattern for remediation:**
```typescript
// WRONG — in handler file
const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));

// CORRECT — move to a repo or service
// repos/branch.repo.ts (shared) or dental-clinical.service.ts
async function getBranchOrThrow(branchId: string) {
  const [branch] = await db.select().from(dentalBranches).where(eq(dentalBranches.id, branchId));
  if (!branch) throw new NotFoundError('Branch not found');
  return branch;
}
```

Note: `updateMedicalHistoryEntry.ts:37` and `updatePostopTemplate.ts:20` and `lab-orders/updateLabOrder.ts:48` lines showing `repo.update(...)` are correct repo-delegated calls — not violations.

---

## Naming Convention Check

All handler files use camelCase `.ts` — PASS.
All repo files use `kebab-case.repo.ts` — PASS.
All schema files use `kebab-case.schema.ts` — PASS.
No PascalCase non-component files found — PASS.
Test files use `kebab-case.test.ts` — PASS.

One edge case: `dental-clinical.prescription-allergy-check.test.ts` uses dot-separated kebab. Non-standard but not a violation per current project conventions.

---

## Cross-Module Import Analysis

The following cross-module imports exist but follow the project's established **facade pattern** and are not violations:

- `repos/clinical-dashboard.facade.ts:11` — imports `dentalVisits` from `@/handlers/dental-visit/repos/visit.schema` (facade file, acceptable)
- `repos/clinical-imaging.facade.ts:9` — same pattern
- `medical-history/listMedicalHistory.ts:11`, `createMedicalHistoryEntry.ts:11`, `updateMedicalHistoryEntry.ts:11` — import `getPatientForClinical` from `@/handlers/patient/repos/patient-clinical.facade` (facade usage, acceptable)
- `amendments/createAmendment.ts:12` — imports `getActiveMembershipId` from `@/handlers/dental-org/repos/org-billing.facade` (facade, acceptable)
- `@/handlers/shared/assert-branch-access` and `assert-branch-role` — shared utilities, allowed

No direct cross-module schema imports (P0 pattern) found.

---

## File Inventory

### Handler Subdirectories

| Subdirectory | Files | Total Lines |
|-------------|-------|-------------|
| `amendments/` | 2 | 88 |
| `attachments/` | 3 | 138 |
| `consent/` | 3 | 129 |
| `inventory/` | 5 | 176 |
| `lab-orders/` | 3 | 144 |
| `medical-history/` | 3 | 134 |
| `occlusion/` | 2 | 68 |
| `postop/` | 3 | 97 |
| `prescriptions/` | 3 | 158 |

### Repo Files (all in `repos/`)

| File | Lines |
|------|-------|
| `amendment.repo.ts` | 43 |
| `amendment.schema.ts` | 24 |
| `amendment.test.ts` | 98 |
| `attachment.repo.ts` | 48 |
| `attachment.schema.ts` | 36 |
| `attachment.test.ts` | 102 |
| `clinical-dashboard.facade.ts` | 62 |
| `clinical-imaging.facade.ts` | 53 |
| `clinical-pmd.facade.ts` | 32 |
| `clinical-visit.facade.ts` | 22 |
| `consent-billing.facade.ts` | 22 |
| `consent-form.repo.ts` | 55 |
| `consent-form.schema.ts` | 30 |
| `consent-form.test.ts` | 97 |
| `inventory.repo.ts` | 94 |
| `inventory.schema.ts` | 60 |
| `lab-order.repo.ts` | 88 |
| `lab-order.schema.ts` | 50 |
| `lab-order.test.ts` | 153 |
| `medical-history.repo.ts` | 58 |
| `medical-history.schema.ts` | 37 |
| `medical-history.test.ts` | 140 |
| `occlusion-screening.repo.ts` | 50 |
| `occlusion-screening.schema.ts` | 25 |
| `postop-template.repo.ts` | 57 |
| `postop-template.schema.ts` | 21 |
| `prescription.repo.ts` | 48 |
| `prescription.schema.ts` | 27 |
| `prescription.test.ts` | 132 |

### Utils Files

| File | Lines |
|------|-------|
| `utils/inventory-validators.ts` | 36 |
| `utils/occlusion-validators.ts` | 35 |
| `utils/postop-validators.ts` | 28 |

### Module-Level Test Files

| File | Lines | Flag |
|------|-------|------|
| `acceptance.clinical-workflows.test.ts` | 543 | P2 — too large |
| `clinical-attachment-amendment.test.ts` | 616 | P2 — too large |
| `clinical-consent-lab.test.ts` | 728 | P2 — too large |
| `clinical-prescription-history.test.ts` | 736 | P2 — too large |
| `dental-clinical-inventory.test.ts` | 551 | P2 — too large |
| `dental-clinical-occlusion.test.ts` | 239 | OK |
| `dental-clinical-postop.test.ts` | 233 | OK |
| `dental-clinical.prescription-allergy-check.test.ts` | 216 | OK |
| `prescription.fsm.property.test.ts` | 96 | OK |

---

_Generated by oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | dental-clinical | 2026-05-28_
