# Compliance Report — Dentalemon

---
oli-version: "1.1"
Audit Date: 2026-06-01
Audit Type: code-vs-spec compliance (COMPLIANCE dimension of /oli-check --auto) — regulated/data-governance focus pass
Scope this run: Step 9e (Data Governance) — WFG-006 erasure, §2 retention, §3 right-to-deletion, legal-hold. Full per-module sweep results from 2026-05-31 carried forward (unchanged; no code regressions detected in audited modules).
Modules Audited (governance touchpoints): erasure, legal-hold, retention, person, dental-patient, dental-clinical (consent), dental-imaging
Map provenance: engine v5, fields_unavailable=[], confidence_threshold=MEDIUM — trust thesis IN FORCE
HEAD: a3bfc9a5
last-modified: 2026-06-01
last-modified-by: oli-check (compliance dimension — --auto regulated pass)
---

## Verdict: **PASS** (0 P0 · 0 P1 · 1 P2 · 1 P3 · 0 unverified)

Carries forward the 2026-05-31 full-sweep PASS (0 P0 / 0 P1). This regulated pass assessed the new V-DG-002 erasure work against DATA_GOVERNANCE.md §2/§3 and WORKFLOW_MAP WFG-006. The implementation **satisfies** the governance spec. No new P0/P1. The S3 physical-delete gap is adequately documented (correctly classified as a follow-up, not a P0/P1). Two new low-severity findings raised below are documentation-drift only.

## Audit Scope (this pass)

| Artifact | Available | Step |
|----------|-----------|------|
| DATA_GOVERNANCE.md | ✓ | Step 9e (--auto treats governance as regulated) |
| WORKFLOW_MAP.md | ✓ | Step 11 (WFG-006 trace) |

## Step 9e — Data Governance Compliance

### 9e.2 Retention Policy Enforcement (§2)

| Item | Expected (Governance §2) | Actual (Code) | Severity | Status |
|------|--------------------------|---------------|----------|--------|
| Most entities `Auto-Purge? = No` | No scheduled purge; retain for legal minimum | `handlers/retention/retention-engine.ts` + `retention-targets.ts` + `jobs/`; consults legal-hold via `personsUnderLegalHold` batch facade | — | COMPLIANT |
| Legal-hold suspends retention | Hold blocks auto-retention action | `legal-hold.facade.ts:25` `personsUnderLegalHold` wired into retention-targets | — | COMPLIANT |

### 9e.3 Right-to-Deletion Compliance (§3)

| Entity (§3 row) | Expected | Actual (Code) | Severity | Status |
|-----------------|----------|---------------|----------|--------|
| `Person` | Anonymize (pseudonym), audit preserved | `person-erasure.facade` → `personTarget`; name→`[ERASED]` pseudonym, identifiers nulled, row kept | — | COMPLIANT |
| `Patient` | Anonymize, unlink | `patient-erasure.facade`; emergency contact/provider/pharmacy/history/prefs nulled | — | COMPLIANT |
| `ConsentForm` | Mark `[ERASED]`, anonymize signer | `clinical-erasure.facade` → `consentFormTarget`; signature/name-snapshot/revokedBy redacted, state kept | — | COMPLIANT |
| `ImagingStudy` | Partial — S3 delete + retain anonymized metadata | `imaging-erasure.facade`; DICOM/finding/annotation ids nulled, rows `archived`, **S3 object ids surfaced via `fileIdsPendingS3Delete` for out-of-band storage-service delete** | — | COMPLIANT (gap documented — see V-GOV-001) |
| `Visit`/`Treatment`/`Prescription`/`Invoice` | Anonymize patient reference | NO-OP targets — verified to hold only `patientId` (resolves to anonymized Person) + retained clinical/billing codes; Person+Patient anonymization fully covers. Intentional, documented `erasure-targets.ts:13-16` | — | COMPLIANT |
| `PMDDocument` | No delete — legal hold | Not an erasure target; legal-hold store blocks. Matches AG-3 | — | COMPLIANT |
| `AuditEvent` | Never delete | Engine has no purge path; append-only invariant in `erasure-engine.ts:12` | — | COMPLIANT |

**Hard invariants verified in `erasure-engine.ts`:** anonymize-not-delete, audit trail never touched, dry-run default, legal-hold blocks (`outcome: 'legal-hold-blocked'`). Legal-hold check is the **real DB store** (`erasure-service.ts:96` `isPersonUnderLegalHold`), with the reviewer-asserted predicate OR'd as defense-in-depth — NOT a bare predicate.

## WFG-006 Trace (Step 11)

WFG-006 (GDPR patient erasure) is marked **RESOLVED** in WORKFLOW_MAP.md:597 and traces to real code: two-step audited request→approve/reject over `dental_erasure_request`, 5 HTTP endpoints (`POST/GET /dental/erasure-requests[/{id}]`, `/approve`, `/reject`, admin-only), anonymize engine, 4 registered targets + 2 no-op-verified families, real LegalHold store (place/release/list). **WFG-006 is satisfied.**

## Findings (new this pass)

### P2 — Fix When Touching
| ID | Category | Description | File:Line | Suggested Fix |
|----|----------|-------------|-----------|---------------|
| V-GOV-002 | Spec drift (doc understates code) | DATA_GOVERNANCE.md §3 narrative (lines 88-91) still lists ConsentForm, ImagingStudy, and "a real LegalHold store" under "Still to add" — all three are now implemented. WORKFLOW_MAP WFG-006 was updated but the §3 prose lags. | docs/product/DATA_GOVERNANCE.md:88-91 | Move ConsentForm/Imaging/LegalHold-store out of "Still to add"; leave only Visit/Treatment/Prescription/Invoice noted as covered-by-reference (no-op) and S3 physical-delete as the storage follow-up. |

### P3 — Track
| ID | Category | Description | File:Line | Notes |
|----|----------|-------------|-----------|-------|
| V-GOV-003 | Stale comment | `approveErasureHandler.ts:3` describes the legal hold as "(reviewer-asserted)" only; the service now also consults the real DB store. Behavior is correct; comment understates it. | services/api-ts/src/handlers/erasure/approveErasureHandler.ts:3 | Cosmetic — update comment to note the store is consulted server-side. |

## S3 Physical-Delete Gap Assessment (explicit task ask)

**Adequately documented — correctly P2/P3-class, NOT a P0/P1.** The gap is recorded at three layers: `erasure-targets.ts:51-54`, `imaging-erasure.facade.ts:31-62` (with `fileIdsPendingS3Delete: string[]` surfaced to the orchestrator + a cross-reference back to §3), and DATA_GOVERNANCE.md §2:50 / §3:70 which classify ImagingStudy as "Partial — S3 delete". The DB-layer erasure is complete and correct (metadata anonymized, rows archived, backing object ids enumerated); only the physical S3 `DeleteObject` is deferred to the storage service, which is request-scoped and unavailable at the repo layer by design. This is a tracked, intentional, well-documented follow-up — it does not represent unenforced governance or a data-integrity defect, so it does not warrant P0/P1. Logged as informational below.

### V-GOV-001 (informational — already documented, no new severity)
ImagingStudy erasure surfaces but does not itself execute physical S3 radiograph deletion. Documented in code + spec. Recommend the storage-service follow-up slice consume `fileIdsPendingS3Delete` to close §3 "Delete S3 object" end-to-end. Not gating.

## Health Score (Data Governance dimension)

| Dimension | Score (0-10) | Notes |
|-----------|-------------|-------|
| Data governance compliance | 9/10 | All §3 right-to-deletion targets enforced via boundary-compliant facades; retention + legal-hold wired; hard invariants present. −1 for documented (non-gating) S3 physical-delete follow-up + §3 doc drift. |

## What's Next

Clean regulated pass — 0 P0 / 0 P1. Proceed with development. When next touching DATA_GOVERNANCE.md, apply V-GOV-002 (move implemented items out of "Still to add"). The S3 physical-delete is a tracked storage-service slice, not a compliance blocker.
