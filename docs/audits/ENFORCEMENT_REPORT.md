<!-- oli: oli-enforce-all | run-8 | 2026-05-29 | verification-driven re-baseline -->

# Enforcement Report — Run 8 (Verification-Driven Re-baseline)

**Run ID:** run-8-verify-2026-05-29
**Baseline-in SHA:** 032468d0 · **After-fixes SHA:** 9d1e5c5f
**Prior run:** run-7-strict-2026-05-29 (git 5035015a) — now superseded
**Method:** The run-7 report was stale. Rather than regenerate findings from specs, the run-7 finding set (54 P0 + key P1 clusters) was **verified against current source** by 7 parallel read-only agents, then confirmed-real findings were fixed this session.

---

## Headline

| Metric | Run-7 | Run-8 | Note |
|--------|-------|-------|------|
| P0 (claimed) | 54 | **0** | All 54 run-7 P0s verified RESOLVED against current source |
| Genuinely-open P0 found in verification | — | 1 | EM-AUD-002 (cross-tenant audit leak) — **fixed this session** |
| New P0/P1 regressions | 8 | **0** | — |
| --strict verdict | FAIL | **PASS** | No P0/P1 regressions |

**Why run-7 was stale:** prior sessions (typecheck restore 42→0, Wave4 branch-role guards, fee-schedule impl, membership audit logging, PIN branch guard, boundary re-fixes, acceptTreatmentPlan guard) cleared the entire P0 backlog **without re-running enforcement**. Run-7's top systemic finding — the "Wave3 defect" claiming AL-003/004 audit was applied to the wrong handlers — is fixed: both routed membership handlers (`DentalMembershipManagement_create/_deactivate`) emit `logAuditEvent`.

---

## Gates (authoritative, integrated tree @ 9d1e5c5f)

- `bun run typecheck` — **0 errors**
- `bun run check:boundaries:error` — **exit 0** (no cross-module repo violations)
- CI-equivalent `bun run test` — **294 pass / 0 fail** (23 files)
- Per-file verification of all modified/new handler tests — **all green** (per-file, on `monobase_test`)

---

## Fixed This Session (verified-real findings)

| Finding | Sev | Fix | Commit |
|---------|-----|-----|--------|
| EF-ORG-P020 | P0 | `getMemberRole` (branchSettings + consentTemplates) filters `status='active'` — revoked members no longer retain role access | e7b3e8b6 |
| EF-ORG-P022 | P2 | `getOrgContext` selects active branch, not `branches[0]` | e7b3e8b6 |
| AL-003/004 | P1 | Audit-persistence regression locks on the **routed** membership handlers | e7b3e8b6 |
| EM-AUD-002 | **P0** | `getAuditEvents` requires `branchId` (400) — closes cross-tenant audit-row leak | 1584ce1b |
| EF-BIL-001/003 | P1 | `createDentalInvoice` no-billable → 422 `NO_BILLABLE_TREATMENTS` | 35f8c2fc |
| AL-010 | P1 | `recordDentalPayment` persists audit (`payment.record`) | 35f8c2fc |
| EF-SCH | P1 | `cancelAppointment` missing reason → 422 `REASON_REQUIRED` | 0b6ede81 |
| EF-PER | P1 | `completePerioChart` blocks completion on locked visit (422 `VISIT_LOCKED`) | 2cb8c278 |
| EM-PER-001 (test) | P1 | Duplicate-chart test aligned to spec 409 `CHART_EXISTS`, made self-contained | 2cb8c278 |
| AL (patient archive) | P1 | `archiveDentalPatient` persists audit (`patient.archive`) | 2481b9fb |
| EM-PAT-007 | P2 | `mergePatients` stub returns 501, not 500 | 9d1e5c5f |

All fixes TDD RED→GREEN, dispatched as 4 parallel agents on a shared tree with disjoint files and isolated template-clone DBs, then integrated and gated by the orchestrator.

---

## Verified RESOLVED — no action needed (the run-7 P0 backlog)

All 54 run-7 P0s confirmed fixed against current source. Highlights:
- **dental-clinical (8):** BR-003 visit-lock guards on prescription/consent/attachment; signed-consent revoke blocked (double-layer); `staff_full` role; append-only medical-history reject; inventory/occlusion/postop branch auth.
- **dental-patient (7):** `assertBranchRole(['dentist_owner'])` on export/bulk-archive/restore/update-archive; list strictly branch-scoped; acceptTreatmentPlan + addFollowUpNote archived guards on routed handlers.
- **dental-org (6):** membership + org create auth; recoverPin branch access; fee-schedule endpoints; `invited`/`revoked` enum; `TIER_LIMIT_REACHED` in taxonomy.
- **dental-audit (1):** EM-AUD-001 viewer reachable by dentist_owner.
- **dental-imaging (2):** `draft`/`not_placed` enum states; tier-blocked WARN emitted.
- **dental-emr (1):** no cross-module DB FKs; EX-004 patient access via facade.
- **billing/perio/pmd/scheduling/visit:** invoice/payment events, error codes, role matrices, treatment immutability, getTreatmentPlan branch check.
- **audit-compliance:** AL-001..025 audited on routed handlers.

---

## Deferred Open Findings (documented — need decision / dedicated effort)

These are real but NOT auto-fixable in an enforcement-fix wave:

1. **Audit-table divergence** (EM-AUD-005/008/009, EF-AUD-001..005) — P1. dental-org membership/PIN events write to platform `audit_log_entry`, not `dental_audit_log` (what the dental audit viewer reads), so they're invisible there; `dental_audit_log` schema also missing ~5 AUDIT_CONTRACTS §2 fields. **Schema migration + handler convergence — dedicated effort.**
2. **Domain events** (visit DE-001..006 dead publishers; clinical/imaging/patient unimplemented; PATCH-cancel) — P1. Publish mechanism exists (pg-boss), 5/23 wired, **no consumers yet** → low functional value. Dedicated event-wiring sprint when the consumer story is defined.
3. **Imaging features** (study-list + annotation endpoints, `IMAGING_TIER_REQUIRED` code, `NOT_CALIBRATED` guard, annotation status column) — P1/P2 feature work.
4. **dental-org misc** (EM-ORG-003 `updateMember` unrouted; EM-ORG-006 invitation email; EF-ORG-P021 envelope inconsistency) — P1/P2.

---

## Resolved Post-Run-8

- **EMR namespace re-scope** (EM-EMR-001/002/003/006/007, EF-EMR-001..008, EX-005/006) — **RESOLVED 2026-05-29** (remaining-work matrix Item #3). Product decision: **Option A — re-spec in place**. The live `handlers/emr/` module is telemedicine **consultation-notes** (`consultation_note`, namespace `/emr`) and is now documented as the `emr-consultation` MODULE_SPEC. The future external-EMR/EHR **import** bridge was renamed `dental-emr-integration → external-records-import` and re-namespaced `/dental/emr → /dental/emr-import` (the two never shared a route prefix). **EX-005/006 decoupled**: `emr.repo.ts` no longer imports `patient`/`provider`/`person` schemas (the `findOneWithDetails`/`findManyWithDetails` joins were removed; expansion is composed in `getConsultation` via `patient-emr.facade` + a new `provider-emr.facade`); all 6 EMR handlers now use facades instead of `ProviderRepository`. TDD RED→GREEN (`provider-emr.facade.test.ts`) plus a `getConsultation.expand.test.ts` characterization lock. Gates: `typecheck` 0, `check:boundaries:error` exit 0, EMR+facade suite green.

---

## --strict Verdict

**PASS** — zero P0/P1 regressions vs the run-7 baseline; the entire run-7 P0 backlog is resolved, and the one genuinely-open P0 surfaced during verification (EM-AUD-002) was fixed this session.

---

*Generated by oli-enforce-all (verification-driven) | run-8 | 2026-05-29 | git 9d1e5c5f. Run-7 detail preserved in git history.*
