# AHA Product Decisions Log

**Session date:** 2026-06-12 · **Branch:** `chore/workflow-verification-sweep` · **Type:** focused product-decision session (no code) · **Source queue:** [`consolidated-remediation-roadmap.md`](./consolidated-remediation-roadmap.md) §13 (20 decisions + lower-priority confirmations).

This log is the **single new artifact** from the decision session. It does **not** rewrite the gap-plans, fix-ready plans, fix-reports, or audit outputs. It records the adjudicated resolution for each §13 decision so the gated 04-module batches can proceed.

**Two resolutions deviated from the recommended default** (the rest adopted the recommendation): **#13 treatment templates = WIRE now** (not park) and **#14 contact editing = EXPOSE contactInfo** (not remove). Both expand V1 scope; downstream implications flagged in the notes.

---

## 1. High-Priority Blockers (gated P1 work)

| # | Decision | Resolution | Rationale | Unblocks | Date |
|---|----------|------------|-----------|----------|------|
| 1 | Who may erase + erasure list/get/approve tenant-scope | **Owner + platform approval.** Clinic `dentist_owner` initiates erasure; platform-admin approves. list/get/approve tenant-scoped to caller's org via the FIX-001 resolution facade. | Gives clinics their data-controller right (GDPR/RA-10173) while keeping a platform safety gate; closes the cross-tenant PII list-leak. | data-governance **Batch E** (admin UI + E2E); finalizes role names + cross-cutting fix #4 (RBAC `["user"]`→`["admin"]`); cross dental-audit/dental-org RBAC | 2026-06-12 |
| 2 | Platform no-AI / voice-charting stance (decide ONCE) | **Hold no-AI, align docs.** Confirm binding no-AI + no-voice-charting. FakeDetector stays a manual/dev fixture only (not a shipped feature); perio stays manual entry. Reconcile MODULE_SPEC ↔ STANDARDS_COMPLIANCE to the no-AI truth. | Matches binding product non-goals (local-first/offline, no-AI); the disagreement is doc drift, not a missing feature. | dental-perio **GAP-5** (voice doc alignment) + dental-imaging **Q1/FIX-007** (Auto-detect); resolves §17 "ceph AI / perio voice" DO-NOT-ADD | 2026-06-12 |
| 3 | Claims/insurance vertical — park vs finish | **Park as Phase-2.** Billing owns the single source of truth; disable the half-shipped FE worklist's dead create path, document backend Phase-2-dormant, defer schema order-8 FKs. Do **not** wire claims in patient independently. | Backend is 100% built but Phase-2; finishing now risks two divergent claim subsystems across billing+patient; PH installment plans outrank claims for V1. | dental-billing claims (parked); dental-patient claims-consumption (not wired); schema order-8 (claim_number unique + 4 FKs) deferred until claims UI lands | 2026-06-12 |
| 4 | PMD signing — wire vs strip | **Strip + defer honestly.** Remove the misleading non-repudiation/checksum-sealed language, leave signature absent, document signing as Phase-2 (FR12.4 honestly deferred). | `sign()` has 0 callers and signature is always NULL; shipping non-repudiation we don't enforce is a compliance liability; honest deferral is pilot-safe. | dental-pmd **Batch E** (sign-or-strip → strip path) | 2026-06-12 |
| 5 | PMD author/attestor identity | **Treating dentist.** Record the visit's assigned/treating dentist as the attesting clinician in the (now unsigned) snapshot; the triggering actor is already captured in the audit trail. | Medico-legally correct — the PMD attests clinical care; cannot be changed retroactively, so bind the clinician now. Coupled to #4. | dental-pmd author-semantics (snapshot attestor field); part of Batch B/E | 2026-06-12 |

## 2. Remaining Decisions (#6–#20)

| # | Decision | Resolution | Rationale | Unblocks | Date |
|---|----------|------------|-----------|----------|------|
| 6 | PMD V1 snapshot field set | **Floor + demographics (narrowed).** Ship the minimum for V1; reconcile PRD FR12.1 → MODULE_SPEC by documenting the narrowed set as the V1 truth; full field set deferred. | Batch B proceeds now on the decision-free minimum; resolves the PRD-vs-spec conflict toward the shippable set. | dental-pmd **Batch B** (snapshot content scope bound) | 2026-06-12 |
| 7 | Is dental_attachment in V1 erasure scope | **Yes — erase by imaging parity.** Add erasure facade + target: null filename/note + delete the S3 object. | Imaging is already anonymized+S3-deleted; visit-tagged x-ray/photo filenames + notes persisting defeats Art.17/RA-10173. | dental-clinical erasure batch (schema order-2 / §8 order-19); data-governance erasure-targets extension | 2026-06-12 |
| 8 | Payment recordedByMemberId | **Derive from session.** Attribute payment to the authenticated caller's membership; reject any client-supplied value. No schema change. | Client-supplied attribution is forgeable today (recordDentalPayment.ts:120); session-derived is the secure default. | dental-billing handler-trust fix (must NOT be slipped into Batch B opportunistically) | 2026-06-12 |
| 9 | PIN recovery | **Owner-reset-only.** Clinic owner resets a staff member's PIN; no self-service security-question flow on shared devices. | Shared clinic iPads make security-question self-service a weak vector; owner-reset is simpler/safer and satisfies FR9.7 minimally. | dental-org **Batch C** | 2026-06-12 |
| 10 | Multi-branch UI scope | **Growth-phase (defer).** V1 ships single-branch UI; document multi-branch Phase-2; treat PRD §2.5 "day-one" as aspirational. | The product is single-branch-only in UI today; branch create/switcher is scope the pilot doesn't need. | dental-org **Batch D** (deferred — do not build branch create/switcher) | 2026-06-12 |
| 11 | Allergy conflict posture | **Restore blocking-with-override.** FE confirm-dialog on allergy conflict; backend unchanged (FR1.12/FR2.15). | Safety posture should match the PRD; blocking-with-override is the documented clinical-safety expectation; cheap FE-only fix. | dental-clinical **GAP-5** (allergy confirm-dialog) | 2026-06-12 |
| 12 | Occlusion / post-op templates / inventory | **Park + document dormant** [DO NOT OVERBUILD]. 10 orphan tested ops, no PRD anchor; document dormant, don't wire FE. | No PRD anchor means wiring is speculative; matches the roadmap's default lean. | dental-clinical **GAP-6/7/8 + GAP-12** (parked) | 2026-06-12 |
| 13 | Treatment templates (visit) | **⚠ WIRE FE now** (deviation from recommended park). Build create/apply template UI; **keep** the seeded template data. | Product chose to deliver templates in V1 rather than unseed the demo. | dental-visit **GAP-2** — now a BUILD (create/apply UI), not a park; seed retained | 2026-06-12 |
| 14 | Phone/email contact editing (V-PAT-014) | **⚠ EXPOSE contactInfo** (deviation from recommended remove). Add contactInfo to getDentalPatient; make it editable and **audited**. | Product chose to deliver contact editing in V1 rather than remove the dead rows. | dental-patient contact editing — now a BUILD. **NOTE:** new PHI surface → must be covered by the JSONB-recursive logger redaction (cross-cutting fix #2) and audited on write | 2026-06-12 |
| 15 | Alert source of truth (patient) | **Med-history-derived floor.** Derive alerts from the medical-history safety floor; do NOT introduce a parallel dental-alerts source. | Avoids dual-source drift before wiring alert FE; FIX-004 equality pin is decision-neutral and lands first. | dental-patient **GAP-6** (alert FE source resolved) | 2026-06-12 |
| 16 | Households (patient) | **Park writes.** Keep harmless reads; park write operations; document dormant (PRD §2.5 Phase-2). | Default per PRD; reads already shipped harmlessly. | dental-patient **GAP-7** (parked) | 2026-06-12 |
| 17 | Auditor / read-only role may read audit trail | **Owner-only for V1.** Resolve ROLE_PERMISSION_MATRIX toward owner-only (matching the shipped viewer); document auditor-role read Phase-2. | Owner-only viewer already shipped; widening spawns a follow-up build; keeps PHI-access history tightest for the pilot. | dental-audit/dental-org matrix refresh (line 100 vs 183); cross-cutting fix #4 | 2026-06-12 |
| 18 | Audit sink consolidation | **Trigger + canary, defer merge.** Add the append-only trigger now; land the FIX-004 divergence canary to baseline; ensure base-module PHI-reads surface in the dental viewer (single pane); defer the 3→1 sink merge to V2. | Big-bang merge is forbidden; the canary baseline must precede any sunset; append-only trigger is the incremental safety win now. | dental-audit **GAP-3** routing + FIX-004 canary | 2026-06-12 |
| 19 | Imaging superimposition + CBCT | **Declare both out of V1.** Superimposition = preview-only (not persisted); CBCT finalize chain = out of V1 launch scope. Document both Phase-2/addon-dormant; defer the schema unique-constraint. | Persist trio + finalizeCbctStudy both have 0 production consumers; selling an unreachable addon chain is dishonest; declaring scope honestly is pilot-safe. | dental-imaging **Batch D/E** (declared out); schema unique-constraint deferred | 2026-06-12 |
| 20 | Orphan migration 0063 safety-floor events | **Finish in Batch C.** Add the Drizzle model for `imported_pmd_safety_floor_events` + switch the merge path to append-only INSERT events (realize the intended immutability). | Pairs with the Batch C add-only safety-floor merge; also closes the "imported safety data is clinically inert" P1 (markSafetyFloorMerged 0 callers). | dental-pmd **Batch C** disposition | 2026-06-12 |

## 3. Structural Confirmations (explicit options)

| # | Decision | Resolution | Rationale | Unblocks | Date |
|---|----------|------------|-----------|----------|------|
| C-1 | Provisional-org PHI write-gating (dental_organization.status) | **Build scoped gate.** Restrict provisional orgs (status=provisional) from PHI writes until activated. | The unenforced status column is a latent compliance hole; the self-service onboarding flow already sets status. | dental-org/governance provisional-org gate (build) | 2026-06-12 |
| C-2 | Canonical member_status set (dental_membership.status: 4/3/2 disagree) | **Document-reserve 'revoked'.** Align the 3 systems on the smaller active set; keep 'revoked' reserved/Phase-2 with no live transition. | Avoids a destructive enum migration; 'revoked' has no transition today. | dental-membership status reconcile (doc-reserve) | 2026-06-12 |
| C-3 | Data-governance session-TTL posture (ADR-007 open item) | **Fixed conservative TTL.** Adopt a fixed short idle timeout for shared clinic devices (~15–30 min, **exact value to confirm**) + document in ADR-007; closes the compliance sign-off blocker. | Shared clinic iPads need a bounded session; a documented conservative default unblocks the sign-off. | data-governance ADR-007 session-TTL sign-off | 2026-06-12 |
| C-4 | Must all erasure subjects be patients? | **Yes — patients only for V1.** Resolve tenant via the patient-person facade (same FIX-001 resolution as #1); reject person-only subjects with no patient anchor. | Bare-person subjects currently keep the caller-supplied tenantId (the leak); requiring a patient anchor closes it. Ties to #1. | data-governance FIX-001 tenant-resolution facade shape | 2026-06-12 |

## 4. Lower-Priority Confirmations (batched defaults — all adopted)

All three batches were confirmed **Accept all**. Defaults adopted as V1 disposition:

**Batch A — org / patient / visit**
| Item | Resolution |
|------|------------|
| org tier-limit & export verify (Q3/Q4) | Verify enforcement + export work as-is; no new build; document |
| org dormant permission-grid (Q5) | Keep dormant + document (do not wire) |
| patient emergency-contact storage (Q4) | Store as JSONB on Person (consistent with consent JSONB pattern); no new entity |
| patient photo capture (Q6) | Defer to Phase-2; document dormant |
| visit carry-over placement (Q2) | Affordance on the returning-patient / new-visit entry point (per 2026-06-10 POST /carry-over decision) |
| visit hygiene visit type (Q3) | Add hygiene as a standard visitType enum value |
| visit-lock review period (Q4) | Fixed grace window then lock-cron; exact period documented |

**Batch B — clinical / scheduling / billing / case-pres / notifications**
| Item | Resolution |
|------|------------|
| clinical attachment max-size (Q5) | Single documented limit = **50MB** (accommodates x-ray/photo attachments) |
| scheduling queue intake (Q2) | Walk-in queue via the existing appointment-create path (no separate queue entity) for V1 |
| scheduling no-show role gate (Q4) | Gated to clinical/front-desk staff (not patient) |
| billing overpayment reconcile | Follow BR — credit overpayment to patient balance/ledger; reconcile PRD wording |
| billing receipt email V1 | Receipt **printable** in V1 (print primitive landed); email delivery Phase-2 |
| billing offline-payment replay | Use the shipped offline-first localId idempotency chain; no new mechanism |
| case-pres estimate (Q1) | Already covered by existing invoice/plan flows; do NOT build a separate estimate (FIX-003 = no new build) |
| case-pres option-acceptance ownership (Q3) | Owned by case-presentation (single owner); visit/billing consume |
| notifs push moment (Q2) | Prompt opt-in at first relevant clinical action (not at login) |
| notifs FIX-004 medical-priority branch | Medical-priority notifications bypass quiet-hours/batching (fail-open for safety) |

**Batch C — schema confirmations**
| Item | Resolution |
|------|------------|
| 0069 populated-DB exposure | Author the corrective forward migration **regardless**; confirm exposure separately ([NEEDS CONFIRMATION]) |
| insurance accrual | Keep manual benefit-remaining for V1 (no accrual engine); label |
| occlusion FK | None now — occlusion is parked (#12); add only if/when wired |
| recession / gm_* authority | Perio chart is the authority for recession / gingival-margin; document |
| medical_history erasure | No-op under clinical-legal-basis retention exception; documented |
| dental_chart.layer | Drop the vestigial stored column (layers are derived read-time) → enables plain unique(visit_id) |
| pending-booking | Park online/pending-booking until notifications Phase-2 reminder spec; document dormant |
| patient branch anchor | Keep nullable for V1; harden the root anchor Phase-2 (don't mass-add branch columns) — schema order-12 |
| base-route exposure | Base monobase routes intentionally exposed/decoupled; document |
| ceph-report patient-UUID retention | Retain patient-UUID (already version-pinned); confirm retention |
| GET /audit/logs reachability | Reachable for the owner-only viewer (ties #17); document |

---

## 5. Now-Unblocked Map (decision → 04 batch freed)

| Resolved decision | Module / batch now unblocked |
|-------------------|------------------------------|
| #1, #7, C-4 | data-governance **Batch E** (governance admin UI + E2E) + dental-clinical **dental_attachment erasure** batch (schema order-2 / §8 order-19) + FIX-001 facade shape |
| #2 | dental-perio **GAP-5** doc alignment + dental-imaging **C/D/E** Auto-detect disposition (declared out) |
| #3 | dental-billing claims **parked** (FE create-path disable) + dental-patient claims-consumption parked + schema order-8 deferred |
| #4, #5, #6, #20 | dental-pmd **Batch B** (snapshot content) + **Batch C** (safety-floor merge + mig-0063 finish + visit_id unique) + **Batch E** (strip signing) |
| #8 | dental-billing payment handler-trust fix (separate from Batch B) |
| #9 | dental-org **Batch C** (PIN recovery, owner-reset) |
| #10 | dental-org **Batch D** — explicitly deferred (no build) |
| #11 | dental-clinical **GAP-5** (allergy confirm-dialog) |
| #12 | dental-clinical **GAP-6/7/8 + GAP-12** — parked + documented |
| #13 | dental-visit **GAP-2** — now a BUILD (treatment-template create/apply UI) |
| #14 | dental-patient contact editing — now a BUILD (expose contactInfo + audit + logger redaction) |
| #15, #16 | dental-patient **GAP-6** (alert source resolved) + **GAP-7** (households parked) |
| #17, #18 | dental-audit auditor-role (owner-only) + **GAP-3** routing (append-only trigger + canary) + cross-cutting fix #4 |
| #19 | dental-imaging **Batch D/E** declared out; schema unique-constraint deferred |
| C-1, C-2, C-3 | dental-org provisional-org gate (build) + member_status reconcile + ADR-007 session-TTL sign-off |

## 6. Recommended Execution Order

1. **Decision-free P1 slice first** (per roadmap §19 — needs no product input, can already run): dental-scheduling `listAppointments` deletedAt filter, dental-pmd Batch B snapshot + Batch C `pmd_document.visit_id` unique index, data-governance Batch C retention read API, and the 0069 corrective forward migration (after [NEEDS CONFIRMATION] of populated-DB exposure).
2. **Decision-free module Batch B/C passes** (roadmap §8 orders 8–18): dental-visit carry-over B, dental-clinical consent/Rx/amendments B–F, dental-billing discount/void/payment-plan B/C, dental-patient trust-pins C, dental-audit FIX-002 E2E, notifications inbox-E2E/B/C, imaging B, perio B/C, governance enforced-mode B.
3. **Newly-unblocked decision-gated batches** (this session): data-governance Batch E (#1/C-4) + dental-clinical attachment erasure (#7) + dental-pmd Batch C/E (#4/#5/#20) + dental-org Batch C / provisional-org gate (#9/C-1) + the two scope-expanding builds (#13 visit templates, #14 contact editing) + audit auditor-role/sink (#17/#18) + the doc-alignment passes (#2 perio/imaging, #6 PMD spec, #10/#12/#16/#19 park-and-document).
4. **case-presentation journey-19** pin (decision-free; historically-broken highest-revenue flow).
5. **Platform fixes** (future specialized prompts, not 04): buildTestApp validator-mounting harness + raw-handler lint guard; JSONB-recursive logger redaction (now load-bearing for #14 contactInfo).

**Execution caveat (§15):** every 04 batch must verify SDK type vs handler shape (and contract vs handler) **before** wiring — treat any fix-ready "backend ready" as unverified.
