# Module Audit — dental-clinical

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — 1 real consent-integrity bug fixed (TDD): a revoked consent could be re-signed and then satisfy the treatment/billing consent gate, silently overturning a patient's revocation. Plus contract/spec/registry/comment drift reconciled. Gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-clinical/` | ✅ present — prescriptions, consent, attachments, lab-orders, amendments, medical-history, **+ inventory, occlusion, postop, consent-refusal, medical-history-review, drug-interactions** (impl wider than v1.0 spec) |
| TypeSpec | `dental-clinical.tsp` + `dental-clinical-ops.tsp` | ✅ present (ops file carries inventory/occlusion/postop) |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-clinical/` | ✅ present (both carried route drift `/consent-forms`→`/consents` + wrong sign method + medical-history path — reconciled) |
| Tests | 31 `*.test.ts` (+1 added this round = 32) | ✅ present |

**/module-review result:** **PASS** — no `test.skip`/`xit`/`.only`; the single `Not implemented` hit is the **intentional** BR-019 `approveAmendment` 501 stub (matches spec §5/§13); no TODO/FIXME in handler code; the single non-test `as any` is documented + eslint-disabled (pre-validated inventory field map). Audit logging present on consent sign/revoke, lab-order create/complete, prescription create, amendment create.

---

## STEP 3 — KG mapping (query-only)

`domain:clinical-care` and `flow:manage-clinical-records` + `flow:approve-amendment`
cover the module. Summaries are **honest** — "consent forms (with patient e-signature)",
"amendments to locked records", "approve (owner/associate only)", "hard gates prevent
completion with … unsigned consent". No over-claims found.

**KG-backlog (lossy, not a blocker):** the graph does not model the consent/lab-order/
prescription FSM states, nor inventory / occlusion / post-op templates / consent-refusals /
medical-history-review / drug-interaction checks as distinct nodes. Fix on next KG
regeneration (not regenerated this round).

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file) | Strength | Verdict |
|------|-------|-------|----|-------------|----------|---------|
| **BR-003** locked/completed visit → no clinical writes → 422 VISIT_IMMUTABLE | ✅ | ✅ create{Prescription,ConsentForm,Attachment,LabOrder}, recordConsentRefusal | NONE | dental-clinical.consent-content.test.ts (recordConsentRefusal 422 locked) | VERIFIED (create-side) | 🟢 |
| **BR-014** consent signed → immutable; re-sign → 422 CONSENT_FORM_SIGNED | ✅ | ✅ signConsentForm.ts:39; repo.sign WHERE signed=false | ✅ | clinical-consent-lab.test.ts (422 re-sign) | VERIFIED | 🟢 |
| **BR-014 / V-CLN-010** signed⊥revoked: signed→revoke 422 **and** revoke→sign 422 | implied (§8) | ✅ **FIXED** (was asymmetric) | NONE | clinical-consent-lab + consent-form.test.ts + clinical-visit.facade.test.ts (**NEW**) | VERIFIED (after fix) | 🟢 |
| **Consent gate** treatment status=performed requires signed **non-revoked** consent | ✅ (WF-035) | ✅ **HARDENED** hasSignedConsentForVisit (+revoked=false) | ✅ | clinical-visit.facade.test.ts (**NEW**); dental-visit business-rules/treatment-fsm | VERIFIED (after fix) | 🟢 |
| **BR-017** prescription requires dentist-role prescriberMemberId → 403 | ✅ | ✅ createPrescription assertBranchRole + membership validation | ✅ | em-cli-005 (3× 403: diff-branch/inactive/nonexistent) | VERIFIED | 🟢 |
| **BR-018** lab FSM ordered→in_fabrication→delivered→fitted/cancelled, forward-only | ✅ | ✅ LAB_ORDER_TRANSITIONS; updateLabOrder 422 | ✅ | lab-order.test.ts (skip+backward rejected); clinical-consent-lab (422 INVALID_STATUS_TRANSITION); prescription.fsm.property (200-run fast-check) | VERIFIED | 🟢 |
| **Prescription FSM** pending→dispensed/cancelled (terminal); illegal → 422 | ✅ (WF-016) | ✅ PRESCRIPTION_TRANSITIONS; updatePrescription | NONE | prescription.status.test.ts (dispensed→dispensed/→pending/cancelled→cancelled all 422) | VERIFIED | 🟢 |
| **BR-019** amendment supervisor approval NOT IMPLEMENTED → 501 | ✅ | ✅ approveAmendment 501 NOT_IMPLEMENTED | ✅ | amendments/approveAmendment.test.ts | VERIFIED | 🟢 |
| **AC-CLI-005** medical history append-only; PATCH → 405 MEDICAL_HISTORY_IMMUTABLE | ✅ | ✅ updateMedicalHistoryEntry 405; no DELETE route | NONE | (route + 405 by source) | PARTIAL (no 405 pin) | 🟡 |
| **Amendment RBAC** create → dentist only; staff_full/hygienist → 403 | ✅ | ✅ createAmendment assertBranchRole | ✅ | em-cli-011 (staff_full 403, hygienist 403) | VERIFIED | 🟢 |
| **Cross-tenant** all writes/reads authorize against resource's OWN branch | ✅ | ✅ visit.branchId / patient.preferredBranchId (never caller-supplied branchId) | — | em-cli-005 (cross-branch prescriber 403) | VERIFIED (by source) | 🟢 |
| **Drug-interaction / allergy cross-check** (advisory, non-blocking) | ❌ (not in v1.0 spec) | ✅ utils/drug-interactions.ts | NONE | drug-interaction-check + prescription-allergy-check (warning present/absent, still 201) | VERIFIED | 🟢 |
| **updatePrescription** field/status edits on a **locked** visit | ⚠ WF-016 "lock blocks edits" | ❌ no BR-003 guard | NONE | — | PRODUCT DECISION (surfaced) | 🟡 |

---

## STEP 7 — Gaps Closed This Round

### REAL bug fixed (TDD: RED proven by source + failing tests, GREEN verified)

| # | Bug | Class | Fix |
|---|-----|-------|-----|
| 1 | **Consent revoke-then-sign integrity hole (V-CLN-010).** `revokeConsentForm` correctly blocks signed→revoke (`CONSENT_ALREADY_SIGNED`) and `repo.revoke()` guards `WHERE signed=false AND revoked=false`, but the **sign path was asymmetric**: `signConsentForm` checked only `existing.signed` and `repo.sign()` guarded only `WHERE signed=false`. So a patient could revoke a still-pending consent (WF-035, legitimate) → `revoked=true`, and a dentist could then **sign that revoked form** → `signed=true, revoked=true`. The treatment status=performed gate **and** the billing gate (`hasSignedConsentForVisit`, in two facades) matched `signed=true` only, ignoring `revoked` → a treatment/invoice could proceed on a consent the patient had **revoked**. The revoke flag was effectively cosmetic. | consent integrity / patient-safety | **3 layers:** (a) `signConsentForm` rejects `existing.revoked` → 422 `CONSENT_FORM_REVOKED` (symmetric with revoke); (b) `consent-form.repo.sign()` adds `eq(revoked,false)` to WHERE (race-safe); (c) both `hasSignedConsentForVisit` facades (clinical-visit + consent-billing) add `eq(revoked,false)` so a revoked consent never satisfies the treatment/billing gate (WF-035). |

**New/updated tests (all RED before fix, GREEN after):**
- `repos/clinical-visit.facade.test.ts` (**NEW**, 4 tests) — first coverage for the consent gate; asserts a signed+revoked row returns `false`.
- `repos/consent-form.test.ts` — `sign()` on a revoked form returns null, stays unsigned.
- `clinical-consent-lab.test.ts` — signing a revoked form → 422 `CONSENT_FORM_REVOKED`, remains unsigned.

### Doc / contract / registry / comment drift reconciled

| # | Drift | Fix |
|---|-------|-----|
| 2 | **API_CONTRACTS route/method drift** — consent endpoints documented as `/consent-forms` (real: `/consents`) and sign as **PATCH** (real: **POST**); a fictional `signed_by` body field; medical-history documented as `/dental/patients/:id/medical-history` (real: `/dental/clinical/medical-history`, patientId in body). | Corrected paths/methods/body; documented branch-derived-from-patient auth; added the new `CONSENT_FORM_REVOKED(422)` to the sign endpoint. |
| 3 | **MODULE_SPEC §10/§11/§20 drift** — same `/consent-forms` path; AC-CLI-005 "no PATCH/DELETE endpoints available" (real: PATCH route exists, hard-returns 405); AI-instruction #4 only covered signed-immutability. | Corrected routes; AC-CLI-005 + AI-instr #3/#4 now state the 405 behavior and the signed⊥revoked symmetry + the gate's `revoked=false` rule. |
| 4 | **MODULE_SPEC spec-behind-impl** — v1.0 spec documents only 6 entity types; inventory / occlusion / postop / consent-refusal / medical-history-review / drug-interaction checks ship with handlers+tests but are undocumented. | Added a "Spec-behind-impl note" enumerating the shipped-but-unspecced sub-modules + their routes. |
| 5 | **br-registry** — BR-014 lacked the revoke/sign symmetry + test refs; no V-CLN-010 entry. | BR-014 enriched (symmetric codes + tests); **+V-CLN-010** registered with all 4 source files + 3 test files. |
| 6 | **Stale test docstring** — `prescription.fsm.property.test.ts` claimed "the prescription schema has no status FSM" (false since EM-CLI-012 added `PRESCRIPTION_TRANSITIONS`). | Docstring corrected: the file exercises the LabOrder FSM (historical name); the prescription FSM exists and is covered by `prescription.status.test.ts`. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**Product/contract decisions (not unilaterally changed):**
1. **`updatePrescription` has no BR-003 immutability guard.** Field edits AND status changes are allowed on a locked/completed visit (all 5 *create* handlers block this). WF-016 says "visit lock blocks further edits," but §13 explicitly carves out post-lock lab-order updates as external — and pharmacy *dispense* is similarly external. So status-progression vs field-edit need a product call. CHECKPOINT before adding a guard (would change real behavior + may churn prescription tests).
2. **Post-signing consent withdrawal unsupported (WF-035 narrative vs §8 state machine).** `revoke()` requires `signed=false`, so once a consent is signed it can never be revoked — a patient cannot withdraw consent after signing. The state machine (§8: "immutable after signed") and the impl agree; the WF-035/WF-018 narrative ("patient revokes → treatment blocked") implies post-sign withdrawal. Decide whether withdraw-after-sign is required (would need revoke-of-signed + the now-`revoked`-aware gate, which is already in place).

**REAL test gaps (impl present, assertion not added this round):**
3. **AC-CLI-005 405 pin** — `updateMedicalHistoryEntry` returns 405 by source but no test asserts it (marked 🟡 PARTIAL).
4. **BR-003 create-side coverage breadth** — only `recordConsentRefusal` has an explicit locked-visit 422 test; prescription/consent/attachment/lab-order create guards are by-source-identical but not all individually pinned.

**KG-backlog:** consent/lab/prescription FSMs + inventory/occlusion/postop/refusal/MH-review/drug-check not modeled (lossy projection) — fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-clinical module suite (`test-with-db.ts`, 32 files) | ✅ **296 pass / 0 fail** (290 baseline + 6 new) |
| Gate consumers (dental-visit + dental-billing, 6 files) | ✅ **126 pass / 0 fail** (stricter `revoked=false` gate — no regression) |
| `eslint` (changed files) | ✅ 0 errors, 0 warnings |
| `check:boundaries:dental-clinical` | ✅ no cross-module repo violations |
| Contract suite (fresh `:7213`) | ✅ **43/46 files** — `dental-clinical.hurl` (41 req) Success + `dental-visit.hurl` (35) Success. The 3 failures are **pre-existing environmental, outside this module** (auth-verification + auth-password-reset: mailpit:8025 down; billing-lifecycle: Stripe). Identical to the dental-visit/scheduling/patient rounds. |

---

## Files Changed

- `services/api-ts/src/handlers/dental-clinical/consent/signConsentForm.ts` — V-CLN-010 revoked-guard (422 CONSENT_FORM_REVOKED)
- `services/api-ts/src/handlers/dental-clinical/repos/consent-form.repo.ts` — `sign()` WHERE `revoked=false`
- `services/api-ts/src/handlers/dental-clinical/repos/clinical-visit.facade.ts` — gate `revoked=false`
- `services/api-ts/src/handlers/dental-clinical/repos/consent-billing.facade.ts` — gate `revoked=false`
- `services/api-ts/src/handlers/dental-clinical/repos/clinical-visit.facade.test.ts` — **NEW** 4 gate tests
- `services/api-ts/src/handlers/dental-clinical/repos/consent-form.test.ts` — sign-revoked repo test
- `services/api-ts/src/handlers/dental-clinical/clinical-consent-lab.test.ts` — sign-revoked 422 handler test
- `services/api-ts/src/handlers/dental-clinical/prescription.fsm.property.test.ts` — corrected stale docstring
- `specs/api/docs/standards/br-registry.json` — BR-014 enriched; +V-CLN-010
- `docs/product/modules/dental-clinical/API_CONTRACTS.md` — consent/medical-history route+method+error reconciliation
- `docs/product/modules/dental-clinical/MODULE_SPEC.md` — routes, AC-CLI-005, AI-instructions, spec-behind-impl note
- `docs/audits/modules/MODULE_dental-clinical_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — rollup entry
