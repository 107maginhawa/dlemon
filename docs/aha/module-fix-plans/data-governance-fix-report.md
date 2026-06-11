# AHA Fix Report: Data Governance — Batch A (Erasure Tenancy Hardening)

**Executed:** 2026-06-11 · **Prompt:** `docs/aha/prompts/04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed)
**Batch:** A (FIX-001 erasure subject→tenant resolution + FIX-002 list/scoping pins). Backend-only; no regen (TypeSpec body-field removal deferred to Batch C per plan).

## Verified before coding ([NEEDS CONFIRMATION] resolved)

The plan flagged the subject→tenant resolution source and org-vs-branch granularity as unconfirmed. Verified in the repos:
- **Resolution source:** the subject is a `subjectPersonId` (+ optional `subjectPatientId`); a patient resolves via `patients.id` (when patientId given) or `patients.person` (unique index) → `preferredBranchId` → `dentalBranches.organizationId`.
- **tenant = organizationId** (NOT branchId): the schema has BOTH `tenant_id` and `branch_id` columns and `dentalBranches.organizationId` exists. The adversarial reviewer confirmed every reader (`erasure-request.repo` filter, `approveErasure`→engine audit, `dental_audit_log`) treats `tenantId` as an opaque/org-granular value — org granularity is correct for multi-branch orgs and breaks no reader.
- **`tenantId` is metadata-only:** the anonymize engine operates on `subjectPersonId`; no target uses `tenantId`. So this is a tenancy **attribution/integrity** fix (compliance + audit correctness), not a wrong-data-deletion fix.
- **Handlers are platform-admin only** (`user.role !== 'admin' → 403`), which bounded the prior risk.

## What shipped

### FIX-001 — server resolves tenancy from the subject (erasure-service.ts `requestErasure`)
- New facade `getErasureSubjectPatient` (`patient-erasure.facade.ts`) resolves the subject's patient (by patientId or personId).
- New facade `getBranchOrganizationId` (`org-erasure.facade.ts`, new) resolves branch → org.
- In `requestErasure`: when the subject is a patient that fully resolves (has a branch + org), the server **sets** `tenantId`=org and `branchId`=branch and **rejects** (400) a forged/mismatched body `tenantId` or `branchId`. Hard rejections also for: a `subjectPatientId` that doesn't belong to `subjectPersonId`, and a **non-existent** `subjectPatientId` (the adversarial-review bypass). Bare-person subjects (no patient) or unresolvable patients (no branch / orphan branch) fall back to the supplied values — decision-free, non-breaking, still admin-gated.

### FIX-002 — list/scoping semantics pinned (Q2 lean)
The list endpoint is platform-admin only and **platform-wide by design**; the optional `tenantId` filter scopes by the now server-resolved attribution. Pinned explicitly (admin sees all; `?tenantId=ORG_A` returns only ORG_A's, now that attribution is trustworthy). No handler change needed — FIX-001 made the attribution the list filters on correct.

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| New `erasure-tenancy.test.ts` | **8 pass / 0 fail** (forged tenant/branch, person-only resolution, cross-person patientId, ghost patientId, bare-person fallback, list scoping) |
| Regression: erasure-routes / service / engine / legalhold / s3 | 7 / 6 / 7 / 1 / 4 pass, 0 fail |
| api-ts typecheck (`bunx tsc`) | **exit 0** |
| Module-boundary check | **clean** (facade imports are the allowed cross-module pattern) |
| Contract `dental-erasure.hurl` (server restarted) | **33/33** (non-patient subjects fall back → no regression) |

## Adversarial review (focused code-reviewer) — 1 real finding, fixed pre-commit

- **[FIXED P2]** Ghost `subjectPatientId`: a non-existent patientId returned null → resolution skipped → forged tenant persisted for a person who actually has a branched patient. Now a supplied-but-nonexistent `subjectPatientId` is rejected (400) + regression test added.
- Reviewer **confirmed clean:** tenant=org semantic (all readers opaque/org-granular), person-path guard, approve-path isolation, service-test compatibility, bare-person fallback.

## Decision queue

| Item | Note |
| --- | --- |
| **Q2 cross-tenant visibility (lean adopted)** | Implemented the lean default: platform-admin sees all (platform-wide), `tenantId` filter scopes. Pinned. Ratify or revise. |
| **Bare-person erasure subjects** | Subjects without a patient row keep the supplied `tenantId` (no resolution source). If product requires ALL erasure subjects to be patients, that's a scope decision (would tighten requestErasure to reject non-patient subjects) — surfaced, not implemented (the contract suite + likely real flows use non-patient subjects today). |
| **Batch C (deferred):** remove the now-server-owned `tenantId`/`branchId` from `RequestErasureRequest` TypeSpec + the 8 erasure/legal-hold `["user"]`→`admin` role declarations (FIX-005) | Per plan, the TypeSpec/regen cycle is Batch C. |

## Not implemented (per plan §9–§11)

Batch B (enforced-mode retention integration test), Batch C (retention read API + role-truth regen), Batch D (retention settings panel — blocked on dental-org settings shell), Batch E (governance admin UI — blocked on Q1 who-may-erase). No changes to `erasure-targets.ts` / `legal-hold.facade.ts` (frozen safety core), no new scheduler, no FE.
