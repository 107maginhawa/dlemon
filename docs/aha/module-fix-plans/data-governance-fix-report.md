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

---

# Addendum — Batch C (retention read API + role-truth regen) — 2026-06-12

**Prompt:** `04-module-or-group-fix-tdd.md` (consolidated via `outputs/EXECUTION-TODO.md` Track 1) · **Superpowers:** Yes (TDD). Closes the two Batch-C items this report's decision queue flagged.

## Fixes
| Fix | Status | Commit | What shipped |
| --- | --- | --- | --- |
| Retention read API (FR8.14, schema-fix #5) | Fixed | `a1fc138c` | New `dental-retention.tsp` → `getRetentionStatus` (GET `/dental/retention-status`, admin, optional `tenantId`) wrapping the existing `summarizeRetentionEnforcement` (no logic change). Tag `Retention` → handler co-located in `handlers/retention/` (no cross-module import). SDK regen. |
| Erasure/legal-hold role truth (FIX-005, cross-cutting fix #4) | Fixed | `e595e150` | Flipped 8 ops `#["user"]→#["admin"]` (5 erasure + 3 legal-hold). Handlers already enforced admin + both module docstrings already said "Admin-only" → pure contract-correctness; the generated `authMiddleware` now gates admin too (defense-in-depth) and the published OpenAPI security is accurate. |

## Tests run (fresh)
| Command | Result |
| --- | --- |
| `getRetentionStatus.test.ts` (RED→GREEN: 401/403/200 never-run/200 enforced) | 4 / 0 |
| retention module suite | 10 files, 45 / 0 |
| erasure + legal-hold backend suites (post-regen) | 10 files, 49 / 0 |
| Contract `dental-retention.hurl` (fresh :7213) | **6 / 6** — admin 200 / non-admin 403 through the generated admin gate |
| Contract `dental-erasure.hurl` + `dental-legalhold.hurl` (fresh :7213) | **33/33 + 21/21** — admin gate now at middleware, zero regression |
| api-ts `tsc` + root typecheck | both exit 0 |

## Still deferred (out of consolidated Batch C scope)
| Item | Reason |
| --- | --- |
| Remove now-server-owned `tenantId`/`branchId` from `RequestErasureRequest` TypeSpec | Ties to decision **C-4 (patients-only erasure subjects)** + the Batch E governance-admin redesign — do the request-shape cleanup with that erasure-subject model, not piecemeal. |
| Batch B (enforced-mode retention proof), Batch E (governance admin UI #1/C-4), Batch D (settings panel) | Unchanged — Tracks 2/3 of EXECUTION-TODO. |

## Completion decision
`COMPLETE` (Batch C) — both consolidated Batch-C items fixed, gate-green at unit + contract layers.

---

# Addendum — Batch B (enforced-mode retention proof) — 2026-06-12

**Prompt:** `04-module-or-group-fix-tdd.md` (consolidated via `outputs/EXECUTION-TODO.md` Track 2, line 43) · **Superpowers:** Yes (TDD). **Closes Track 2 §8** — the final decision-free Track-2 item. Test-only; no code, no regen.

## Fix
| Fix | Status | Commit | What shipped |
| --- | --- | --- | --- |
| FIX-003: no end-to-end `dryRun:false` retention test through the real facades (GAP-6, `[TEST GAP]`) | Fixed | `8db01774` | New `services/api-ts/src/handlers/retention/retention-enforced-run.test.ts` exercises the **exact production seam** — `RetentionPolicyRepository.findEnabled()` loads a real, enabled, tenant-wide `attachment` policy row → `evaluateRetention(db, logger, policies, { dryRun:false, now })` runs through the **default `RETENTION_TARGETS`** (no injected fakes) and the **default `logAuditEvent`** writer (no injected spy), against a real seeded DB. The first enforced run is no longer the first real run. |

## What the test proves (against the real DB, no injection)
1. **Eligible attachment really soft-archived** — an aged (`createdAt` 2010) attachment past the 10-year cutoff has `deletedAt` set by the real `archiveAttachments` facade.
2. **Legally-held record untouched** — a second aged attachment whose owning Person (PATIENT_2) is under an active legal hold is excluded; its `deletedAt` stays `null`. Engine reports `eligibleCount:1 / legalHeldCount:1 / actionedCount:1`.
3. **`retention.enforced` audit row written** — a real `dental_audit_log` row (`actorId = RETENTION_SYSTEM_ACTOR`, `targetType = retention_policy`, `targetId = policyId`, metadata `actionedCount:1 / legalHeldCount:1 / dryRun:false`).
4. **Audit trail untouched** — a pre-existing `visit_note.signed` audit row in the same tenant survives the run (retention never purges the audit table).

## §15 / facade-bug check
The fix-ready flagged that the never-proven `dryRun:false` path "may expose real facade bugs — that is the point." **It did not.** The safety core is genuinely sound: the engine passes only non-held ids to the real facade, `archiveAttachments` soft-archives with a `deletedAt` stamp + `isNull(deletedAt)` guard, and `logAuditEvent` is a plain insert on the passed `db` (openTestTx-safe, no nested transaction). So Batch B stayed **test-only** (no facade change), matching the fix-ready's "test-only nominal" prediction.

## Non-vacuous proof (GREEN-on-arrival → mutation-tested)
Because the code was already correct, the test was GREEN on arrival; non-vacuousness was proven with two load-bearing mutations, each restored after:
- Defeat the engine's legal-hold filter (`eligible = candidates`) → held attachment wrongly counted/archived → **RED**.
- No-op the real `archiveAttachments` write (early `return ids.length`) → `deletedAt` never set despite the engine reporting `actionedCount:1` → **RED** (proves the test verifies the real DB mutation, not just the return count).

## Tests run (fresh)
| Command | Result |
| --- | --- |
| `retention-enforced-run.test.ts` (new) | 1 / 0 |
| Full `retention/` suite (per-file isolated, 10 files) | **42 / 0** |
| api-ts `tsc` + lint | tsc 0 errors · lint 0 errors (warnings pre-existing) |
| Contract / SDK / E2E | none — no handler/TypeSpec/SDK change (test-only) |

## Completion decision
`COMPLETE` (Batch B) — FIX-003 closed; the enforced-mode path is now proven end-to-end through the real facades + the real audit writer before any production enable of `RETENTION_ENFORCEMENT_ENABLED`. Track 2 §8 is **done**. Remaining data-governance work (Batch D settings panel, Batch E governance admin UI, GAP-5 target wiring, GAP-8 spec) is Track 3 / decision-gated, unchanged.

---

# Addendum — Batch E (governance admin UI + E2E, #1 / C-4) — 2026-06-12

**Prompt:** `04-module-or-group-fix-tdd.md` (consolidated via `outputs/EXECUTION-TODO.md` Track 3, line 46). **Superpowers:** Yes (Vertical TDD). Closes the data-governance Track-3 erasure operator-surface gap (GAP-1 erasure FE) + the C-4 patients-only backend hardening. Decision #1 (owner-initiates → platform-admin-approves) + C-4 (patients-only) from `product-decisions.md`.

## §15 — the fix-ready premise was two-sided stale
Decision #1's text ("clinic `dentist_owner` initiates → platform-admin approves; list/get/approve tenant-scoped to caller's org") was **internally tense** with its own "Unblocks" column ("admin UI + E2E" + the already-shipped `["user"]→["admin"]` RBAC), and the shipped backend had already taken the **platform-wide-by-design** list path (FIX-002, pinned in `erasure-tenancy.test.ts`). The erasure endpoints are gated to the Better-Auth **platform `admin`** role; the clinic app has only org roles and no platform-admin area. **Resolution (user-delegated):** ship the decision's concrete operationalization — a single **admin-operated** queue, no erasure-RBAC reopening (the fix-ready explicitly warned against speculative RBAC churn on this compliance-critical module). Clinic-owner-initiated requests deferred to Phase-2.

## Fixes
| Fix | Status | Commit | What shipped |
| --- | --- | --- | --- |
| C-4: person-only erasure subjects accepted (bare person keeps caller-supplied tenantId — the cross-tenant leak) | Fixed | `d837a56c` | `requestErasure` rejects a subject with no patient anchor (4xx) — every request now carries a server-resolved tenant via FIX-001. Flipped the bare-person tenancy pin (201→4xx, RED-proven); reworked the list-scoping test to two real patient subjects in two real orgs; reworked `dental-erasure.hurl` to a real patient subject (subject user self-onboards + registers a patient) + a person-only-reject pin (**36/36**). |
| GAP-1: zero FE for erasure (compliance workflow API-only) | Fixed | `cffadfda` | New **Data Erasure** Settings panel — platform-admin queue (list + status filter + status badges + legal-hold flag) with **Approve** (runs the anonymize engine) / **Reject** (with reason) on `requested` rows. Presentational `DataErasurePanel` (props, unit-tested 9/0) + thin container (useSession admin gate + generated react-query hooks). Self-gates so a non-admin owner sees a notice, not a 403 wall; server hard-gates independently. |
| GAP-1: no governance E2E | Fixed | `da612551` | Admin approve+reject journey through the real Settings panel + independent API read (`anonymized` + `rejected`). New dev-only `POST /dev/promote-admin` (mirrors `/dev/verify-email`) so a fresh self-onboarded owner can exercise the admin-gated queue. |

## What's deferred (documented, not built)
- **Clinic-owner-initiated erasure surface** (decision #1's two-tier ideal) → Phase-2. V1 = platform-admin-operated; clinic owners raise requests out-of-band.
- **Per-caller-org list scoping** → the list stays platform-wide-by-design for the platform admin (FIX-002), with per-row server-resolved **tenant attribution** (FIX-001) + a patients-only anchor (C-4) as the isolation guarantee; a tenant **filter** in the panel UI is a Phase-2 nicety (status filter shipped).
- **GAP-8** (dental-erasure MODULE_SPEC) — unchanged, P3.

## 3-lens adversarial review (FE panel)
Security lens **SHIP** (server hard-gates all 4 ops; non-admin never fires the list; PHI rendered as truncated UUIDs per the sibling audit-log convention; no XSS/log leak; no settings-shell regression — the panel lazy-mounts so unrelated settings tests need no auth-client context). Folded the one real FE-state finding (**lock the reject-reason input during a mutation** so the shown value can't diverge from the submitted one) + its pinning test. The double-action window is backend-guarded (double-approve → 400, hurl scenario 9). Lens-1's `body:{}`/invalidation "blockers" were verified non-issues (legal hold is server-derived; the no-args query key partial-matches all filtered variants).

## Tests run (fresh)
| Command | Result |
| --- | --- |
| `dental-erasure/*` backend suite (8 files) | **40 / 0** |
| `dental-erasure.hurl` (server restarted) | **36 / 36** |
| `data-erasure.test.tsx` (FE unit) | **9 / 0** |
| `features/settings` FE suite | **86 / 0** |
| `data-erasure-admin.spec.ts` (E2E, chromium, live API) | **1 / 1** |
| api-ts `tsc` · FE `tsc` · lint | 0 · 0 · 0 errors |
| regen | none — no TypeSpec/SDK change |

## Completion decision
`COMPLETE` (Batch E) — the right-to-erasure compliance workflow is now operable in-product by a platform admin, and person-only subjects can no longer be erased with a forged tenant (C-4). Closes EXECUTION-TODO Track-3 line 46.
