# AHA Fix Report: Dental Audit — MODULE COMPLETE (Batches A + B + C)

**Executed:** 2026-06-11 (Batch A FIX-001) + 2026-06-12 (Batch A FIX-002 finish + B + C) · **Prompt:** `04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Commits:** FIX-001 (prior) · FIX-002 `7b260884` · FIX-003 `576590d7` · FIX-004 `c1b55686`.

## What shipped (FIX-001 — WF-028 audit viewer)

Pure FE wiring over the already-generated `getAuditEvents` SDK hook (no backend/TypeSpec/regen):
- `hooks/use-audit-log.ts` — `useAuditLog(branchId, filters, offset)` over `getAuditEventsOptions`; branch-scoped (branchId from org-context, required by the endpoint), `from`/`to` coerced to `Date` (SDK query type), only-set filters included.
- `components/audit-log.tsx` — owner-only viewer: filter bar (eventType / action / actorId / targetType / from / to) + table (when / actor UUID / role / type / action / target / reason) + pagination (offset/limit, page X/Y). Renders **only DTO fields — no snapshots** (latent-PHI guard); actor shown as UUID, never a name.
- `settings-panels.tsx` — appended one registry entry `{ key: 'audit', label: 'Audit Log', Component: AuditLog }`. The settings route is owner-only (`requireRole('settings')` → `settings: true` only for `dentist_owner`), so the panel is implicitly owner-only — no per-panel RBAC framework added (consistent with the registry's design).

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| Component (`audit-log.test.tsx`) | **7 pass / 0 fail** — rows from `{data, meta}` envelope, no-snapshot guard, branchId scoping, eventType filter round-trip into query params, Next advances offset, empty + error states |
| Settings feature suite (incl. settings-page registry) | **76 pass / 0 fail** |
| Typecheck (root FE + api-ts) | both **exit 0** |

## Batch A finish (FIX-002 — journey-10 E2E proof) — DONE 2026-06-12 (`7b260884`)

**§15 killed the fix-ready premise.** Despite its filename, `10-void-amend-audit.journey.spec.ts` does **not** void an invoice — it drives clinical *notes* sign-and-lock → add-addendum on Sofia Cruz. The plan's "journey 10 already provisions the void + voidable invoice; assert `invoice.voided`" was false (same false-premise class as dental-patient FIX-006). Verified ground truth before coding:
- `pinAuth(page, 'dentist')` resolves to **`dentist_owner`** (Dr. Maria Reyes) → it *can* reach the owner-only viewer; no re-auth needed.
- Journey 10's writes produce real, viewer-visible audit events: `visit_note.signed` + `visit_note.amended` (both `logAuditEvent` → `dental_audit_log`, exactly what `getAuditEvents` reads). It produces **no** `invoice.voided` (that handler lives elsewhere; the existing billing E2Es only void *payment plans*).

**AskUserQuestion → user delegated ("what's industry-compliant").** Decision: assert **`visit_note.amended`** (Option 1). Rationale: HIPAA §164.312(b) / PH DPA don't privilege invoice-void; amending a **signed clinical record** is the textbook audit-trail scenario, and an amendment carries a **reason** (the "why"). "Who voided this invoice" is one instance of the same control. Avoids fabricating a fixture / bloating the fragile journey.

What shipped: extended journey 10's success block — after the addendum write, SPA-navigate to `/settings` (**not** `page.goto`: the PIN session is in-memory; the org-context `branchId` survives SPA nav so the branch-scoped viewer query runs), open the Audit Log panel, filter by action, and assert the `visit_note.amended` row shows the actor (col 1, non-empty/non-`—`) + reason `Correction`. Inserted **before** `recordJourneyPass` so it gates the pass. Mutation-tested non-vacuous (bogus `visit_note.amended__MUTANT` filter → RED with the exact "must appear in the audit viewer" assertion). Journey 10 GREEN (7.5s).

## Batch B (FIX-003 — stale pg-boss/async doc sweep) — DONE 2026-06-12 (`576590d7`)

Doc/comment-only (ADR-005 settled inline-sync; the docs still implied an async pg-boss pipeline).
- `core/audit-logger.ts` — **verified COMMENT-ONLY** (zero executable change in the 98-caller file; `git diff | grep` for non-comment add/remove lines returned empty): removed the phantom "pg-boss consumer" from the sanitizer docstring; corrected the header's stale "Never throws" to the real default-fire-and-forget + fail-closed (security / `failClosed` opt-in) contract.
- `MODULE_SPEC.md` — reconciled all 8 present-tense pg-boss/async claims (§1/§3/§6/§10b/§14/§16/§19/§20 + AC-AUD-001) to the inline-synchronous reality; updated the ADR-005 banner to say the body is now reconciled (≤5s budget retained only as historical traceability).

## Batch C (FIX-004 — legacy dual-write divergence canary + sink boundary doc) — DONE 2026-06-12 (`c1b55686`)

**§15 before coding:** confirmed `logAuditEvent` dual-writes **every** event unconditionally (authoritative `dental_audit_log` FIRST + fail-closed for security/opt-in; legacy `dental_audit` SECOND + fire-and-forget/swallowed) — so parity is over ALL event types, not a subset (canary isn't vacuous).
- NEW `services/api-ts/src/handlers/dental-audit/legacy-sink-divergence.test.ts` (run via `scripts/test-with-db.ts`, same harness as `audit-immutability-db.test.ts`): after N mixed-type `logAuditEvent` calls, asserts `count(dental_audit) == count(dental_audit_log) == N` AND per-action multiset parity, isolated by a unique tenant (immune to pre-existing rows), TRUNCATE cleanup. **Read-only observation — `logAuditEvent` untouched.** Mutation-tested non-vacuous (disabled the legacy write → RED at `expect(legacy).toBe(authoritative)` 0≠6).
- `MODULE_SPEC.md §10c "Sink boundary"`: the 3 sinks (1 `dental_audit_log` authoritative/viewer-read · 2 `dental_audit` legacy/no-viewer · 3 base `audit_log_entry` written by `handlers/audit` + `audit.retention` 7y purge) + a CAN/CANNOT-see table. Base-module PHI-access reads (sink #3) are **not** surfaced in the dental viewer — the intentional, now-documented boundary (Q2 input). 3→1 merge + base-PHI routing stay deferred.

## Not implemented (Track 3 / deferred — per plan §8–§11)

GAP-2 auditor role (Q1/#17 owner-only resolve), GAP-3 base-PHI routing INTO the dental viewer + 3→1 sink consolidation + legacy sunset (Q2/Q3/#18), append-only trigger build, CSV export, `access.denied` rollout. `logAuditEvent` untouched (frozen, 98 callers) across all three batches.

## 3-lens adversarial review (test-touching batches)

- **FIX-002 (E2E):** Lens 1 honesty/flake — SPA-nav (not `page.goto`) keeps the in-memory PIN session; assertion inserted before the pass so it gates; mutation-proven non-vacuous. Lens 3 §15 — viewer reads `{data, meta}` `dental_audit_log`; asserted event type matches what the journey actually writes.
- **FIX-004 (canary):** Lens 1 — deterministic DB test, isolated tenant, no flake. Lens 2 non-vacuousness/blast-radius — mutation-proven; test-only + per-file clone (TRUNCATE never touches a real DB). Lens 3 — dual-write confirmed unconditional → total + per-action parity is the correct shape.
- **FIX-003 (comment-only):** self-review — diff confirmed comment-only.

## Gate (fresh runs)

| Layer | Result |
| --- | --- |
| Backend canary (`legacy-sink-divergence.test.ts`) | **1 pass / 0 fail** (+ mutation RED proven) |
| E2E journey 10 (`--project=journeys`) | **PASS** (7.5s; + mutation RED proven) |
| FE component (`audit-log.test.tsx`, unchanged) | **7 pass / 0 fail** |
| Typecheck (root FE + api-ts) | both **exit 0** |
| Lint (changed api-ts files + E2E journey) | clean |

## Decision queue

| Item | Note |
| --- | --- |
| Q1/#17 auditor-role visibility | **RESOLVED 2026-06-13 (`bd33f664`)** — owner-only (code already enforced; ROLE_PERMISSION_MATRIX reconciled). |
| Q2/#18 single-pane sink routing (base PHI → dental viewer) | **RESOLVED 2026-06-13 (`f561388e`)** — read-time union (NOT a write-path change / NOT the 3→1 merge). |
| Q3 legacy `dental_audit` sunset | FIX-004 canary now provides the divergence baseline; confirm before sunset. |

## Track 3 — auditor-role + sink (#17/#18) — DONE 2026-06-13 (`f561388e` feat + `bd33f664` docs)

**§15 corrected the fix-ready premise on BOTH items** (treated as unverified, per protocol):
- **#17 = doc-only, not code.** The viewer was ALREADY owner-only — `getAuditEvents.ts:129` `assertBranchRole(db, user.id, branchId, ['dentist_owner'])`, with a `staff_full`→403 pin and a cross-tenant (ORG_A owner passing ORG_B branchId)→403 pin in `getAuditEvents.test.ts`. The append-only DB trigger (migration `0080`, proven by `audit-immutability-db.test.ts`) and the FIX-004 divergence canary were ALSO already in place. So #17 collapsed to reconciling the internally-inconsistent `ROLE_PERMISSION_MATRIX.md` (line 100 "auditor/observer" analog implied audit-read vs line 183 owner-only) → owner-only binding, auditor read-only role = Phase-2.
- **#18 = read-time union, the faithful reading of "single pane NOW + defer 3→1 merge to V2".** The fix-ready flagged the *write-routing* interpretation as cross-module-risky ("touches other modules' write paths, plan as its own batch"); a READ-side union avoids that entirely. §15 traced that 8 dental PHI-read handlers (listMedicalHistory/listPrescriptions/listConsentForms/listLabOrders/listAmendments/listAttachments/getDentalInvoice/getImportedPMD) record `data-access` reads into the BASE `audit_log_entry` sink #3 via `audit.logEvent` — these are the "base PHI reads the owner couldn't see."

**Scoping (the hard part):** base `audit_log_entry` carries NO branch/tenant column (`baseEntityFields` only). Resource-scoping is heterogeneous (visitId×5 / patientId×2 / invoiceId / importedPmdId) and partially unreliable (patient branch anchor is nullable per C-batch). So the union scopes by **actor ∈ active members of the viewed branch** (`dental_membership.personId == audit_log_entry.user`, the same table the viewer authorizes against). Leak-safe for V1's single-org product; documented residual = a bare resource UUID only under hypothetical cross-org membership (not creatable in V1) → ROADMAP harden to resource-scope when the patient anchor is non-nullable.

**PHI-safety:** the facade projection never SELECTs base `details` (structural guarantee, stronger than a runtime drop); rows surface as ids/actor/resourceType/timestamp + `metadata.source='base'`; FE tags them "platform".

**Real bug caught by the dental-audit hurl (not the unit):** the viewer's freeform `action` filter (e.g. `patient.registered`) reached the base ENUM `audit_log_entry.action` comparison → `invalid input value for enum audit_action` → **500**. Fixed with a `BASE_AUDIT_ACTIONS` guard (non-base action ⇒ base sink contributes nothing) + a regression unit pin.

**3-lens adversarial (mechanism+consumer = product code):** Lens-1 security SHIP (empty-member early-return can't degrade to unscoped; details never selected; actor-scope is in-query not post-filter). Lens-2 correctness — REJECTED its "pagination BLOCKER" (the `window=offset+limit` per-source fetch is the correct k-way-merge bound: any global top-N row is within its own source's top-N); folded its MINORs (dropped `resolvedTenant` caller-param echo → stamp base rows `branchId`). Lens-3 test-quality — folded MAJORs (added a positive control to the no-leak test so absence ≠ accidental-empty; assert `details` absent from the DTO; FE badge row-identity). count-scan MAJOR left (mirrors the authoritative `audit-log.repo.ts` `select({id}).length` convention).

**Gate:** backend viewer **14/0** (mutation-RED proven on actor-scope + details-drop), FE settings **87/0** (audit badge), dental-audit hurl **10/10** + all-audit hurl **20/20** (fresh :7213), api-ts+FE typecheck **0**, lint **0 errors**, boundaries clean. No TypeSpec/SDK regen (response shape unchanged — `metadata` already on the model). **dental-audit MODULE fully closed (A–C + Track-3 #17/#18).** Deferred to V2/Phase-2: 3→1 sink merge, legacy `dental_audit` sunset (Q3), auditor read-only role, resource-scope hardening, CSV export.
