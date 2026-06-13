# Workspace-Workflow Gap Research — Top-Level Report (SYNTHESIS)

**Compiled:** 2026-06-10 · **Branch:** `chore/workflow-verification-sweep` · **Status:** decision-ready, read-only research (no code, no slices executed yet).
**Research spec:** `~/.claude/plans/1-so-the-wiggly-stearns.md` · **Reconciled against:** `docs/audits/MASTER-GAP-MATRIX.md` (Batches 1–4 IMPLEMENTED 2026-06-09).

This report synthesizes six chunk appendices. Detail lives in the appendices; this doc owns the
executive summary, cross-chunk reconciliation, the deduped master register, the cross-workflow
ordering invariants, the global slice plan, and the consolidated open-questions list.

**Appendix pointers (read for `file:line` detail):**
- **A** `appendix-A-visit-fsm.md` — visit FSM, treatment FSM, treatment-plan phasing/versioning/carry-over.
- **B** `appendix-B-odontogram.md` — living-document chart layers, compare/diff, mixed dentition, per-tooth merge.
- **C** `appendix-C-clinical-sheets.md` — SOAP/notes, EMR-consultation, Rx, consent, case-presentation, perio.
- **D** `appendix-D-ancillary-sheets.md` — lab orders, PMD, attachments, external-records-import, imaging/ceph/CBCT.
- **E** `appendix-E-commercial-recall.md` — billing (invoice/payment/void/plan/claims), recalls/recare.
- **F** `appendix-F-cross-cutting.md` — audit ordering/integrity, RBAC/branch-scope, offline P2P sync, retention/legal-hold.

---

## 1. Executive Summary

### Counts (post-dedup; cross-referenced duplicates counted once, owned by F)

| Class | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| **IMPLEMENTED** (baseline inventory, working + tested) | — | — | — | — | **~80 workflows/rules** (A:22, B:18, C:20, D:~12, E:~18, F:12) |
| **KNOWN gaps** (already in MASTER-GAP-MATRIX / module-gap-plans) | 0¹ | 17 | 14 | 6 | **37** |
| **NEW candidates / gaps** (grep+spine verified absent) | 0 | 7 | 19 | 13 | **39** |

¹ The two P0s in MASTER-GAP-MATRIX (dental-patient G1 sync-log leak; case-presentation G1 broken accept)
are **already FIXED** (Batch 1, 2026-06-09). No chunk surfaced a new P0. The highest NEW severity is **P1**.

**De-dup note:** the offline-sync idempotency/LWW finding appeared in **three** chunks (A18/A19, B-G3/B-G4/B-C2,
F-G02/F-G03/F-G16). It is consolidated into **one canonical set owned by F** (§2). The triple-counted rows are
folded — the register below marks them "see F-Gxx" and does **not** re-count them in the totals above.

### Headline numbers
- **No new P0.** Both pre-existing P0s are resolved. The research found **zero** new cross-tenant/PHI/money
  data-loss bug in a *currently-live* prod path. The genuine P1 data-loss findings are **offline-sync latent**
  (dangerous only once cadence is activated) plus one chart-baseline write-path bug that is live today (B-G1).
- **The dominant NEW theme is offline-first hardening** (idempotency keys, clock-aware merge, conflict
  persistence) — cheap and additive *now*, dangerous to retrofit *after* duplicate/clobbered data exists.
- **One contradiction of a "FIXED" claim found and verified** (E-NEW-02 invoice-void not fail-closed — §2).
- The bulk of KNOWN gaps are the same "orphan endpoint / dead trigger / split-brain config" classes the
  MASTER-GAP-MATRIX already catalogues; this research adds the *sequencing* and *offline* lenses on top.

### Top 12 highest-value findings (one line each)

1. **F-G02 (P1, data-loss)** — `localId` is persisted+echoed but **not an idempotency key** (no unique
   constraint, no dedup test); a retried offline create makes a duplicate visit/chart/treatment/invoice.
   *Subsumes A18/B-G3/E-NEW-05/F-G16.* Canonical owner: **F**.
2. **F-G03 (P1, data-loss)** — per-tooth chart merge is **incoming-array-wins with no clock**; concurrent
   two-device edits silently clobber. The TS handler does **not** use the cadence Lamport LWW. *Subsumes
   B-G4/B-C2/A18-chart.* Canonical owner: **F**.
3. **B-G1 (P1, data-loss, LIVE TODAY)** — `updateTooth` per-surface PATCH **skips the baseline merge**;
   only `upsertDentalChart` writes the baseline, so single-tooth edits are silently dropped from next-visit
   carry-over. The one offline-class finding that bites with no cadence needed.
4. **F-G16 / ADR-004 Tier-2 (P1, money)** — `recordDentalPayment` / `applyDentalDiscount` have **no
   idempotency guard**; offline replay or double-tap can double-charge. (ADR-004 explicitly flags this.)
5. **E-NEW-02 (P2, money) — CONTRADICTS the "P1-C fail-closed = FIXED" claim** — `voidDentalInvoice.ts:61`
   calls `logAuditEvent` **without** `{ failClosed: true }`; an invoice void can commit with no audit row.
   Verified (§2): payment-void/discount/payment ARE fail-closed; **invoice-void was missed.**
6. **GAP-A05 / CAND-A20 (P1)** — `acceptTreatmentPlan` (version snapshot) writes **no audit row** and does
   **not** move the header FSM; the two plan-accept systems drift (versioned-but-not-approved). Cross-ref
   MASTER-GAP-MATRIX §H "approval two paths".
7. **GC-05 / perio P1-1 (P1, clinical data-loss)** — perio Stage/Grade/Extent computed at completion but
   **not persisted** → the diagnosis vanishes on reopen. KNOWN (perio P1-1); still open.
8. **F-G07 / ER-P1-1 (P1, PHI-leak)** — erasure `tenantId` taken from body unchecked; `listErasureRequests`
   returns **all tenants' PII**. KNOWN, decision-gated on "who may erase". Distinct from the by-design
   cross-tenant governance modules (legal-hold/retention).
9. **F-G06 (P1, cross-tenant)** — the optional-branch-omission leak class is **closed for the 8 clinical
   modules + billing** but **un-swept for portal/emr/provider/external-import** (the sweep's own carry-forward).
10. **D05–D08 / PMD (P1, PHI-safety)** — PMD is **never signed** (`sign()` unused), **omits the Safety
    Floor** (allergies invisible at the receiving facility), and **import never merges** safety items
    (`markSafetyFloorMerged` never called). Decision-gated on PMD intent.
11. **E-NEW-01 (P2, workflow)** — manual `updateRecall status:sent` **races the cron**; a staff manual flip
    consumes the `sent` state and **suppresses the automated recare outreach** (no notif, no attempt bump).
12. **B-G6 (P2, clinical-correctness)** — `computeChartDiff` mislabels a **reclassification** (caries→fractured)
    as "worsened" and an **extracted-tooth dropout** as "resolved/treated" — clinically misleading compare.

---

## 2. Cross-Chunk Reconciliation

The researchers flagged five overlaps/conflicts. Resolved here; the master register (§3) reflects these.

### R1 — Offline-sync idempotency / LWW (A18/A19 · B-G3/B-G4/B-C2 · F-G02/F-G03/F-G16) → **one set, owned by F**

These are the same two underlying defects viewed from three chunks. Canonicalize:

| Canonical (F) | Finding | Folds in | Severity |
|---|---|---|---|
| **F-G02** | `localId` is not an idempotency key — retried create → duplicate row | A18 (treatment/visit create leg), **B-G3** (chart upsert), **E-NEW-05** (invoice), **F-G16** (payment) | P1 data-loss |
| **F-G03** | Per-tooth chart merge incoming-wins, no clock → concurrent clobber | **B-G4** (per-tooth RMW lost-update), **B-C2** (P2P per-tooth merge), A18-chart | P1 data-loss |
| **F-G16** | ADR-004 Tier-2 financial endpoints (payment/discount/plan) have no idempotency guard | E-NEW-05 invoice is the create-side instance of F-G02; payment/discount are the Tier-2 instance | P1 money |
| **CAND-A19** (kept in A, cross-ref F) | Offline concurrent **active-visit** creation collides only on sync; needs deterministic resolution | — (visit-FSM-specific; uses F-G02's localId mechanism) | P1 data-loss |

**Rule for the register:** F owns F-G02/F-G03/F-G16. A's GAP-A01/CAND-A18 and B's B-G3/B-G4/B-C2 are marked
**"see F-Gxx"** and are NOT independently counted. CAND-A19 (active-visit resolution) and B-G1 (baseline-merge-
on-PATCH — a *consistency* bug, not a sync-merge bug) remain distinct, real, and counted.

### R2 — Audit ordering on plan transitions (A20 vs F-G01) → **two distinct findings, both kept**

- **A20 (= GAP-A05/CAND-A20)** is a **coverage** gap: `acceptTreatmentPlan`/`acceptTreatmentOption`/
  `carryOverTreatments` emit **no audit row at all** for clinically-material plan transitions. *What to audit.*
- **F-G01** is an **ordering** gap: audit rows use **server-insert `timestamp`**, not event **`occurredAt`**,
  so offline-synced events mis-sort the compliance trail. *How to order what is audited.*

They compose: the SL-A01 slice (add the missing plan-accept audit rows) should write rows that, once F-G01
lands, carry an `occurredAt`. No double-count — A20 is owned by A (chunk-local plan-accept), F-G01 by F
(cross-cutting audit schema). Both kept.

### R3 — **E-NEW-02 CONTRADICTS MASTER-GAP-MATRIX P1-C "fail-closed void/discount/payment = FIXED"** → **VERIFIED; matrix claim is partially wrong**

**Corrected fact (grep-verified):**
- `applyDentalDiscount.ts:80` → `{ failClosed: true }` ✔
- `recordDentalPayment.ts:142` → `{ failClosed: true }` ✔
- `voidDentalPayment.ts:73` → `{ failClosed: true }` ✔ (this is the **payment**-void)
- **`voidDentalInvoice.ts:61-69` → `logAuditEvent(...)` with NO opts object → fire-and-forget** ✗

The MASTER-GAP-MATRIX §9 / P1-C entry says fail-closed was set on "void/discount/payment/visit-complete/
role-change". The **payment**-void path got it; the **invoice**-void path did not. So an invoice void can
commit while its `invoice.voided` audit row silently fails. **E-NEW-02 is correct and live** — register it as
a real P2-money residual under P1-C, not a "resolved" item. (One-line fix mirroring the three siblings.)

### R4 — KNOWN-vs-NEW integrity (mislabel check against MASTER-GAP-MATRIX ids)

Spot-checked the chunks' KNOWN/NEW tags against matrix ids. Corrections applied in §3:

- **A's GAP-A03 (no visit-lock job)** — tagged KNOWN but maps only to an `[INFERRED]` WF-046; matrix has no
  explicit row. Kept as **KNOWN-thin** (inventory-derived, decision-gated by OQ "locked tier in V1").
- **B-G2 (read-time overlay divergence)** correctly KNOWN (ADR-008); **B-G3** correctly KNOWN (GAP-001). All
  other B rows are genuinely NEW (grep-verified). ✔
- **C's GC-01..GC-12, GC-20** correctly carry their matrix ids (emr G1/G2/G3/G4/G6/G7, perio P1-1/P2-2/P3-1/
  P3-2, dental-clinical G3/G4/G5, dental-org G6). ✔ GC-13..GC-19, GC-21..GC-23 are genuinely NEW. ✔
- **D's D03–D15, D22–D25** correctly carry matrix ids (dental-clinical G1, dental-pmd P1-x/P2-x, imaging
  IMG-P1/P2/P3, external-import G1/G2/G7). ✔ D16–D21 NEW. ✔
- **E's E-KNOWN-10 (EM-BIL-002)** correctly marked **resolved+pinned** — not a relabel. E-NEW-01..07 NEW. ✔
- **F-G06/G07/G08/G09/G10/G11/G12/G14/G15** correctly carry sweep/erasure/audit/retention/legalhold ids. ✔
  **F-G01/G02/G03/G04/G05/G13** are genuinely NEW (grep+spine verified). ✔

No KNOWN gap was found mislabeled as a NEW discovery once R1 dedup is applied.

### R5 — "external-records-import" is **not** a single module (D's correction, ratified)

D verified there is **no `external-records-import` handler dir**; the surface is 3 disjoint artifacts (bulk
import in `dental-patient/identity/importPatients.ts`, external-PMD in `dental-pmd/importPMD.ts`, and the
deferred FHIR `/dental/emr-import` bridge). The register treats them as their owning modules; the
MASTER-GAP-MATRIX "external-records-import" gap-plan ids (G1/G2/G7) are retained as the spec surrogate.

---

## 3. Consolidated Gap & Candidate Register (deduped)

Schema: `| id | finding | chunk | class | lenses{S,R,O,C} | KG-node | MODULE/WF | BR-id | spine-op/handler | severity | blast-radius |`
Lenses: **S**=sequencing · **R**=RBAC/multi-tenant · **O**=offline P2P · **C**=clinical-correctness.
Cross-referenced duplicates show **"→ see F-Gxx"** and are NOT recounted. KNOWN rows cite their matrix id.

### Cross-cutting (F) — owns all canonical sync findings

| id | finding | chunk | class | lenses | KG-node | MODULE/WF | BR-id | spine-op/handler | sev | blast |
|---|---|---|---|---|---|---|---|---|---|---|
| **F-G02** | `localId` not an idempotency key → retried offline create duplicates (visit/chart/treatment/invoice/payment). **Subsumes A18-create, B-G3, E-NEW-05.** | F | NEW | O,S | dental-visit | dental-visit/GAP-001 | BR-#### (replay returns existing row) | createDentalVisit/Treatment/Invoice/upsertDentalChart | **P1** | data-loss |
| **F-G03** | Per-tooth chart merge incoming-wins, no clock → concurrent clobber (TS handler ≠ cadence LWW). **Subsumes B-G4, B-C2.** | F | NEW | O,C | dental-visit | dental-visit | BR-#### (LWW by monotonic clock) | upsertDentalChart / dental-chart-baseline.repo.ts:57 | **P1** | data-loss |
| **F-G16** | ADR-004 Tier-2 payment/discount/plan no idempotency guard → double-charge on retry | F | KNOWN | O,S | dental-billing | dental-billing | ADR-004 | recordDentalPayment/applyDentalDiscount | **P1** | money |
| **F-G06** | Optional-branch-omission un-swept for portal/emr/provider/external-import | F | KNOWN | R | dental-org | (sweep carry-forward) | EM-BIL-002 | (per-module) | P1 | cross-tenant |
| **F-G07** | Erasure: tenantId from body unchecked; listErasureRequests returns all tenants' PII | F | KNOWN | R | data-governance | dental-erasure/ER-P1-1 | ER-P1-1 | listErasureRequests | P1 `[NC]` | PHI-leak |
| **F-G14** | Legal-hold/erasure/retention governance UIs raw-API-only (0 FE) | F | KNOWN | R | data-governance | legal-hold/retention/erasure | — | placeLegalHold/listLegalHolds | P1 `[NC]` | cosmetic |
| **F-G01** | Audit timestamp = server-insert, not occurrence → offline events mis-order trail | F | NEW | S,O | audit | dental-audit/WF-028 | BR-#### (carry occurredAt; order by it) | getAuditEvents / audit-log.schema.ts:17 | P2 | correctness |
| **F-G04** | conflictPayload column never written/read → no durable conflict record/UI | F | NEW | O | dental-patient | dental-patient | BR-#### (persist conflictPayload) | (column orphan) | P2 | data-loss |
| **F-G05** | Offline sync-log write path unwired (createSyncLog/updateSyncLog 0 FE; cadence stubbed) → C1–C3 latent until activation | F | NEW | O | dental-patient | dental-patient | — | createSyncLog/updateSyncLog | P2 | data-loss |
| **F-G08** | Audit fan-in manual per-handler (no middleware) → new mutations can ship unaudited | F | KNOWN | S | audit | dental-audit/P1-B | AUD-BR-001 | logAuditEvent (~70 callers) | P2 | cross-tenant |
| **F-G09** | Audit write post-commit (residual after fail-closed): commit then 5xx, no row | F | KNOWN | S | audit | dental-audit/P1-C | dental-audit P1-C | audit-logger.ts | P2 (accepted) | money |
| **F-G10** | 3 audit sinks; base PHI-access reads invisible to viewer | F | KNOWN | R,S | audit | dental-audit/P2-B | — | (3 repos) | P2 | PHI-leak |
| **F-G11** | retention clinical/visit/prescription targets declared but unenforceable | F | KNOWN | C | data-governance | retention/G3 | — | retention-targets.ts | P2 `[NC]` | data-loss |
| **F-G12** | No live enforcement-ON E2E (cron→engine→facade→DB archive + held-row untouched) | F | KNOWN | S,C | data-governance | retention/G4 | AC-RET-002/004 | retention-engine.ts | P2 | data-loss |
| **F-G15** | Governance RBAC contract drift (tsp `user` vs handler `admin`) | F | KNOWN | R | data-governance | dental-legalhold | — | dental-legal-hold.tsp | P2 | cosmetic |
| **F-G13** | Legal hold placed AFTER a retention archive run not reversed (no un-archive path) | F | NEW | S,C | data-governance | legal-hold/WF-LH-004 | BR-#### (hold restores rows archived in lookback) | (none) | P3 | data-loss |

### A — Visit/Treatment/Plan FSMs

| id | finding | chunk | class | lenses | KG | MODULE/WF | BR | spine-op | sev | blast |
|---|---|---|---|---|---|---|---|---|---|---|
| **GAP-A05/CAND-A20** | `acceptTreatmentPlan` writes no audit row AND doesn't move header FSM → two plan systems drift on accept | A | KNOWN | S,R,C | TreatmentPlan | dental-visit G2 + matrix §H | BR-#### (canonical accept; audit it) | acceptTreatmentPlan.ts:75 | **P1** | data-loss |
| **CAND-A18** | Offline treatment-status merge can regress performed→planned (no monotonicity guard) | A | NEW | O,S,C | Treatment | dental-visit/cadence | BR-#### (status merge monotone along FSM) | updateDentalTreatment / **see F-G03 mechanism** | P1 | data-loss |
| **CAND-A19** | Two offline `active` visits collide only on sync; no deterministic resolution | A | NEW | O,R,S | Visit | dental-visit/cadence | BR-#### (resolve to one; loser discarded+audited) | createDentalVisit / uses F-G02 localId | P1 | data-loss |
| GAP-A08 | Carry-over has no FE trigger (cons=0); "Carried Over" subtotal only from seed | A | KNOWN | S | TreatmentPlan | dental-visit G1 `[NC]` | BR-008 | carryOverTreatments | P1 | cosmetic |
| GAP-A02 | `acceptTreatmentOption` 2 un-transactioned UPDATEs → double-accept window | A | NEW | S,C | Treatment | dental-patient P1-19 | BR-#### (atomic option accept) | acceptTreatmentOption | P2 | data-loss |
| GAP-A04 | Option-accept & carry-over write status directly, bypassing TREATMENT_TRANSITIONS | A | NEW | S,C,R | Treatment | dental-visit/WF-009 | BR-006 (strengthen) | acceptTreatmentOption/carryOverTreatments | P2 | data-loss |
| GAP-A07 | `→performed` consent gate visit-scoped, not procedure-scoped; carried item performs under unrelated consent | A | NEW | S,C,R | Consent/Treatment | dental-visit/WF-010 | BR-014 (scope) | updateDentalTreatment.ts:70 | P2 | clinical-correctness |
| GAP-A01 | Two-step create→activate / Mark-Done PATCH leg not idempotent | A | NEW | S,O | Visit/Treatment | dental-visit/WF-007,010 | **→ see F-G02** | use-create-visit.ts:38 | P2 | data-loss |
| CAND-A14 | Locked-visit treatment/chart amendment (corrigenda) missing — only notes amend today | A | NEW | S,C,R | Visit/Treatment | dental-visit/new WF | BR-#### (additive amendment) | createAmendment | P2 | data-loss |
| CAND-A15 | Reverse/re-open wrongly-completed visit — no path (only discard open-only) | A | NEW | S,R,C | Visit | dental-visit/new WF | BR-#### (owner reopen, gated) | (none) | P2 | data-loss |
| GAP-A09 | Accepted-plan version viewer unwired (cons=0) | A | KNOWN | S | TreatmentPlanVersion | dental-visit G2 | BR-VIS-010 | getTreatmentPlanVersion | P2 | cosmetic |
| GAP-A10 | Plan header FSM (approve/derive/status-history/appt-link) unwired | A | KNOWN | S | TreatmentPlan | dental-patient G9 | TP-BR-005/P1-21 | approveTreatmentPlan | P2 | cosmetic |
| GAP-A11 | Treatment templates built+seeded, zero FE | A | KNOWN | S | Treatment | dental-visit G3 | BR-VIS-009 | applyTemplate | P2 | cosmetic |
| GAP-A12 | FE affordance ≠ RBAC (chart/treatment affordances shown to rejected roles) | A | KNOWN | R | Visit/Treatment | dental-visit G4 | BR-006 perms | createDentalTreatment | P2 | cosmetic |
| GAP-A03 | No visit-lock job (completed→locked); `locked` tier unreachable in prod | A | KNOWN-thin | S,C | Visit | dental-visit/WF-046 `[INFERRED]` | BR-002 (gap) | updateDentalVisit.ts:170 | P2 | cosmetic |
| GAP-A06 | Carry-over auto-discovery doesn't gate source visit status (can pull from discarded/locked) | A | NEW | S,C | Visit/Treatment | dental-visit/WF-033 | BR-008 (strengthen) | carryOverTreatments.ts:74 | P3 | cosmetic |
| GAP-A13 | Cross-branch carry-over source allowed (patient-scoped) — drift vs "blocked" intent | A | KNOWN | R | Visit | dental-visit §13 `[NC]` | BR-008 (decision-pending) | carryOverTreatments.ts:68 | P3 | cross-tenant |
| CAND-A16 | Plan re-sequence/phase change after acceptance not versioned | A | NEW | S,C | TreatmentPlan | dental-patient/new WF | BR-#### | getTreatmentPlan | P3 | cosmetic |
| CAND-A17 | Plan estimate staleness — no as-of stamp / frozen prices on accept | A | NEW | C,S | TreatmentPlan | dental-patient/new WF | BR-#### | getTreatmentPlan.ts:94 | P3 | money |

### B — Odontogram living document

| id | finding | chunk | class | lenses | KG | MODULE/WF | BR | spine-op | sev | blast |
|---|---|---|---|---|---|---|---|---|---|---|
| **B-G1** | `updateTooth` PATCH **skips baseline merge** → carry-over silently drops single-tooth edits (**live today**) | B | NEW | S,O,C | dental_chart | dental-visit/WF-009,032 | BR-0301 (every chart write merges baseline) | updateTooth | **P1** | data-loss |
| B-G3 | Offline localId stored but not dedup key | B | KNOWN | O,S | dental_chart | dental-visit | **→ see F-G02** | upsertDentalChart | P1 | data-loss |
| B-G4 | Per-tooth RMW no version check → concurrent lost-update | B | NEW | O,S | dental_chart | dental-visit | **→ see F-G03** | updateTooth | P1 | data-loss |
| B-G6 | `computeChartDiff` mislabels reclassification "worsened" / extraction-dropout "resolved" | B | NEW | C | dental_chart | dental-visit/P1-14 | BR-0306 | dental-chart.helpers.ts:503 | P2 | correctness |
| B-G7 | Mixed dentition = fixed age-8 snapshot, not patient-specific | B | NEW | C | dental_chart | dental-visit/P1-17 | BR-0307 | dental-chart.helpers.ts:62 | P2 | correctness |
| B-G8 | No extracted/missing-tooth charting guard on chart write path | B | NEW | C,S | dental_chart | dental-visit/WF-009 | BR-0308 (relates EC2) | updateTooth/upsertDentalChart | P2 | correctness |
| B-G2 | Read-time overlay divergence unbounded (write-time sync deferred) | B | KNOWN | S,C | dental_chart | dental-visit/ADR-008 | BR-0302 (deferred) | getTreatmentPlan | P2 | correctness |
| B-G9 | Carry-over read path (chartFromBaseline) has no contract test | B | NEW | S | chart_baseline | dental-visit/WF-032 | CHART-BR-002 (coverage) | getDentalChart | P2 | correctness |
| B-G10 | localId idempotency + baseline-merge-on-PATCH UNTESTED at contract layer | B | NEW | O | dental_chart | dental-visit | (coverage) | upsertDentalChart/updateTooth | P2 | correctness |
| B-G5 | Compare overlay no guard excluding focal visit from reference options | B | NEW | S | dental_chart | dental-visit/P1-14 | BR-0305 | chart-compare-overlay.tsx:69 | P3 | cosmetic |
| B-C1 | Candidate: durable write-time chart sync (ADR-008 endgame) | B | NEW | S,C,O | dental_chart | dental-visit/ADR-008 | BR-0302 | (new FSM trigger) | P2 | correctness |
| B-C2 | Candidate: per-tooth P2P merge + audit ordering | B | NEW | O,S | dental_chart | dental-visit | **→ see F-G03** | cadence + upsertDentalChart | P2 | data-loss |
| B-C3 | Candidate: chart "as-of-date" historical layer view | B | NEW | C | dental_chart | dental-visit/P1-14 | BR-0310 | reuse getTreatmentPlanVersion | P3 | cosmetic |
| B-C4 | Candidate: surface-level (not tooth-level) overlay | B | NEW | C | dental_chart | dental-visit/WF-009 | BR-0311 | getTreatmentPlan | P3 | cosmetic |

### C — Clinical sheets

| id | finding | chunk | class | lenses | KG | MODULE/WF | BR | spine-op | sev | blast |
|---|---|---|---|---|---|---|---|---|---|---|
| GC-05 | Perio Stage/Grade/Extent computed but not persisted → vanishes on reopen | C | KNOWN | C | dental_perio_chart | dental-perio/perio P1-1 | strengthens BR-P | completePerioChart/getPerioChart | **P1** | data-loss |
| GC-01 | EMR consultation: entire FE absent (6 ops FE=0); docs claim implemented | C | KNOWN | R,C | consultation_note | emr-consultation G1 `[NC]` | — | createConsultation… | P1 | data (dormant) |
| GC-02 | EMR admin reads ALL notes, no tenant scope | C | KNOWN | R | consultation_note | emr-consultation G3 `[NC]` | BR-#### (admin org-scoped) | getConsultation/listConsultations | P1 | cross-tenant/PHI |
| GC-03 | EMR vs dental-visit/clinical = two finalize-able note systems, no linkage | C | KNOWN | C | consultation_note | emr-consultation G2 | — | — | P1 | data-integrity |
| GC-09 | Consent revoke + history + refusals-list no FE | C | KNOWN | R,C | consent_form | dental-clinical G3 | BR-014/V-CLN-010 | revokeConsentForm/listConsentRefusals | P1 | legal-record |
| GC-10 | Rx list + dispense/cancel FSM unsurfaced | C | KNOWN | S | prescription | dental-clinical G4 | BR-017/EM-CLI-012 | listPrescriptions/updatePrescription | P1 | workflow |
| GC-06 | Perio risk-factor inputs discarded → Grade not explainable | C | KNOWN | C | dental_perio_chart | dental-perio P2-2 | grade-derivation | completePerioChart | P2 | correctness |
| GC-11 | Amendments write-only; no list/read; approve 501 stub | C | KNOWN | C | clinical_amendment | dental-clinical G5 | BR-019 | listAmendments/approveAmendment | P2 | trust |
| GC-04 | EMR adversarial RBAC (cross-provider/patient read) untested | C | KNOWN | R | consultation_note | emr-consultation G4 | V-EMR-OWN | getConsultation | P2 | PHI (test) |
| GC-13 | Case-presentation accept e-sig and per-treatment BR-014 consent can diverge | C | NEW | S,R,C | consent_form↔case_presentation↔treatment | case-presentation G3 + dental-clinical | BR-#### (accept ⇏ bypass per-treatment consent) | acceptCasePresentation/signConsentForm | P2 | legal-record |
| GC-14 | "Sign & Lock" SOAP = client-sequenced 2 writes, no idempotency key | C | NEW | S,O | dental_visit_note | dental-visit/notes | BR-#### (sign-with-snapshot, one write) | upsertVisitNotes+signVisitNotes | P2 | data-loss |
| GC-15 | Visit note signing not idempotency-keyed (offline replay double-snapshot) | C | NEW | O,S | dental_visit_note_version | dental-visit/notes | **→ see F-G02** | signVisitNotes | P2 | data-loss |
| GC-16 | Consent created+signed in two FE calls, no localId → orphan unsigned consent on replay | C | NEW | O,S | consent_form | dental-clinical/WF-018 | **→ see F-G02** | createConsentForm+signConsentForm | P2 | data-loss |
| GC-18 | Informed refusal recorded but advisory only — doesn't flag/block the procedure perform | C | NEW | S,C | consent_refusal↔treatment | dental-clinical/WF-018 | BR-#### (refusal flags perform) | recordConsentRefusal | P2 | clinical-correctness |
| GC-07 | Hygienist may finalize perio diagnosis w/o dentist sign-off (docstring drift) | C | KNOWN | R,C | dental_perio_chart | dental-perio P3-1 `[NC]` | BR-P05 (reconcile) | completePerioChart:75 | P3 | correctness |
| GC-08 | Stage silently null on depth-only charting, no UI nudge | C | KNOWN | C | dental_perio_tooth_reading | dental-perio P3-2 | — | upsertToothReading | P3 | cosmetic |
| GC-12 | Consent-template management no UI; hardcoded FE templates | C | KNOWN | C | consent_template | dental-org G6 | BR-014 (snapshot) | listConsentTemplates | P3 | cosmetic |
| GC-17 | No amend/re-stage path for a completed perio chart with mistyped risk factor | C | NEW | C | dental_perio_chart | dental-perio `[NC]` | BR-#### | completePerioChart | P3 | correctness |
| GC-19 | No cross-Rx duplicate/poly-pharmacy/controlled-substance longitudinal check | C | NEW | C | prescription | dental-clinical | BR-#### (advisory) | createPrescription | P3 | clinical-correctness |
| GC-20 | EMR `amended` enum dead; duplicate-context soft assertion | C | KNOWN | C | consultation_note | emr-consultation G6/G7 | V-EMR-001 | createConsultation | P3 | cosmetic |
| GC-21 | Candidate: consent expiry / re-consent prompt for long-deferred treatments | C | NEW | C,S | consent_form | dental-clinical/WF-018 `[NC]` | BR-#### | signConsentForm | P3 | clinical-correctness |
| GC-22 | Candidate: perio diagnosis → recall-interval recommendation (cross-chunk → E) | C | NEW | S,C | dental_perio_chart↔recall | dental-perio→dental-scheduling | BR-#### | completePerioChart | P3 | workflow |
| GC-23 | Candidate: SOAP note templating per procedure (not AI) | C | NEW | C | dental_visit_note | dental-visit/notes | — | upsertVisitNotes | P3 | cosmetic |

### D — Ancillary sheets

| id | finding | chunk | class | lenses | KG | MODULE/WF | BR | spine-op | sev | blast |
|---|---|---|---|---|---|---|---|---|---|---|
| D03 | Lab Orders sheet unreachable — no Lab button (dead `onLab`) | D | KNOWN | S | flow:lab-order | dental-clinical G1 | BR-018 | onLab dead-prop | P1 | workflow |
| D04 | PMD viewer + import unreachable (dead `onPmd`) | D | KNOWN | S | flow:pmd | dental-pmd P1-3 | BR-021/022 | getPMDForVisit/importPMD | P1 | workflow |
| D05 | PMD never signed — sign() unused; checksum mislabeled non-repudiation | D | KNOWN | R,C | flow:pmd | dental-pmd P1-2 | BR-2001 | generatePMD | P1 | trust |
| D06 | PMD omits Safety Floor + demographics → allergy invisible at external facility | D | KNOWN | C | flow:pmd | dental-pmd P1-1 `[NC]` | BR-2002 | generatePMD | P1 | PHI-safety |
| D07 | Per-visit PMD not a FHIR R4 Bundle | D | KNOWN | C | flow:pmd | dental-pmd P1-5 `[NC]` | BR-2003 | generatePMD | P1 | interop |
| D08 | Imported PMD has no clinical effect — Safety-Floor merge stubbed | D | KNOWN | S,C | flow:import-pmd | dental-pmd P1-4 | BR-2004 | importPMD | P1 | PHI-safety |
| D09 | Bulk patient import orphan (0 FE) | D | KNOWN | R,S | flow:bulk-import | external-records-import G1 `[NC]` | V-XRI-001 | importPatients | P1 | workflow |
| D10 | No row cap on bulk import (DoS-class) | D | KNOWN | R | (none) | external-records-import G2 `[NC]` | V-XRI-002 | importPatients | P1 | data-loss/avail |
| D11 | Imaging AI "Auto-detect landmarks" upsell contradicts no-AI non-goal | D | KNOWN | C | domain:imaging | dental-imaging IMG-P1-1 `[NC]` | CIMG-001 | detectCephLandmarks | P1 | clinical-trust |
| D12 | Persisted superimposition unwired — preview only | D | KNOWN | S,O | domain:imaging | dental-imaging IMG-P2-1 | BR-2005 | createCephSuperimposition | P2 | data-loss |
| D13 | CBCT finalize only on harness route | D | KNOWN | S | domain:imaging | dental-imaging IMG-P2-2 `[NC]` | CIMG-001 | finalizeCbctStudy | P2 | workflow |
| D14 | Auto-detect 403 retried 3× → long misleading spinner | D | KNOWN | S,R | domain:imaging | dental-imaging IMG-P2-3 | CIMG-002 | detectCephLandmarks | P2 | cosmetic |
| D22 | Care-record FHIR export no FE trigger (HIPAA right-of-access unreachable) | D | KNOWN | C | flow:pmd | dental-pmd P2-6 | V-PMD-008 | exportPatientCareRecord | P2 | workflow |
| D23 | Imported-PMD list/history no FE | D | KNOWN | — | flow:import-pmd | dental-pmd P2-7 | BR-022 | listImportedPMDs | P2 | cosmetic |
| D24 | "Share PMD" delivers only a checksum text string (silent no-op on desktop) | D | KNOWN | S | flow:pmd | dental-pmd P2-8 | BR-2010 | generatePMD | P2 | workflow |
| D16 | Lab order no chart entry-point & no treatment link (WF-017 steps 1&5 unimpl) | D | NEW | S,C | flow:lab-order | dental-clinical/WF-017 | BR-2006 | createLabOrder | P2 | correctness |
| D17 | No lab-order remake/defective workflow (cols modelled, no path) | D | NEW | S,C | flow:lab-order | dental-clinical/WF-037? | BR-2007 | (no endpoint) | P2 | correctness |
| D18 | Attachment uploads not idempotent (no per-file localId) | D | NEW | O,S | flow:attachment | dental-clinical/WF-039 | **→ see F-G02** (+BR-2008) | createAttachment | P2 | data-loss |
| D21 | Ad-hoc measurement calibration-drift not re-flagged/audited | D | NEW | C | domain:imaging | dental-imaging | BR-039 (extend) | updateImageCalibration | P3 | correctness |
| D19 | FE attachment cap (50 MB) < backend cap (BR-033 100 MB) — silent ceiling | D | NEW | — | flow:attachment | dental-clinical | BR-033 | (FE only) | P3 | cosmetic |
| D20 | Lab order create→complete no notification (only audit) | D | NEW | S | flow:lab-order | dental-clinical/notifs | BR-2009 | createLabOrder | P3 | cosmetic |
| D15 | No modality-reclassify / delete-image affordance | D | KNOWN | — | domain:imaging | dental-imaging IMG-P3-1 | BR-026..032 | updateImageModality/deleteImage | P3 | cosmetic |
| D25 | `/dental/emr-import` FHIR/CDA/PDF bridge unbuilt (by design) | D | KNOWN | — | (none) | external-records-import G7 | V-XRI-003 (deferred) | (no endpoint) | P3 | n/a |

### E — Commercial + recall

| id | finding | chunk | class | lenses | KG | MODULE/WF | BR | spine-op | sev | blast |
|---|---|---|---|---|---|---|---|---|---|---|
| **E-NEW-02** | `voidDentalInvoice` audit fire-and-forget — **NOT failClosed** (contra matrix P1-C; see §2 R3). Invoice void can commit with no audit row. | E | NEW | R,C | audit | dental-billing/WF-041 | strengthens P1-C | voidDentalInvoice.ts:61 | P2 | money |
| E-NEW-05 | `createDentalInvoice` persists localId, never dedupes → duplicate invoice on replay | E | NEW | O,S | invoice | dental-billing/WF-013 | **→ see F-G02** | createDentalInvoice.ts:80 | P2 | money |
| E-NEW-01 | Manual `updateRecall sent` races cron → suppresses automated recare outreach | E | NEW | S,O | recall | dental-patient (recall) | BR-#### (cron is sole sender) | updateRecall/recallDispatch.ts:104 | P2 | data-loss |
| E-KNOWN-01 | No discount-apply UI (`applyDentalDiscount` 0 FE) | E | KNOWN | R,C | invoice | dental-billing BIL-G1 | BR-015 | applyDentalDiscount | P1 | money |
| E-KNOWN-02 | Insurance/HMO claims unreachable — no create-claim affordance | E | KNOWN | S,R,C | claim | dental-billing BIL-G2 `[NC]` | EM-BIL-002 | createInsuranceClaim+4 | P1 | money |
| E-KNOWN-03 | No payment void/refund UI | E | KNOWN | R | payment | dental-billing BIL-G3 | V-BIL-013 | voidDentalPayment | P2 | money |
| E-KNOWN-04 | No payment-plan create/update UI | E | KNOWN | C | payment_plan | dental-billing BIL-G4 | BR-015 | createDentalPaymentPlan | P2 | money |
| E-KNOWN-05 | No printable receipt (V1-Required) | E | KNOWN | C | payment | dental-billing BIL-G5 | EC5 | getDentalPaymentReceipt | P2 | cosmetic |
| E-KNOWN-06 | Duplicate balance source (client sum vs getPatientBalance) | E | KNOWN | C | invoice | dental-billing BIL-G6 | BILL-BR-006 | getPatientBalance | P2 | money |
| E-NEW-06 | No partial-refund/payment-correction path (mis-keyed amount unfixable in-product) | E | NEW | C | payment | dental-billing | BR-#### | voidDentalPayment+recordDentalPayment | P3 | money |
| E-NEW-03 | Next-cycle recall seeding not idempotent under offline replay | E | NEW | O,C | recall | dental-patient (recall) | **→ see F-G02** | updateRecall.ts:74 | P3 | data-loss |
| E-NEW-04 | Recalls carry no localId/idempotency key | E | NEW | O | recall | dental-patient (recall) | **→ see F-G02** | createRecall | P3 | data-loss |
| E-NEW-07 | Manual recall sent flip has no consent re-check (only cron gates) | E | NEW | R,C | recall | dental-patient (recall) | strengthens BR-014 | updateRecall.ts:63 | P3 | PHI-leak |
| E-KNOWN-09 | Recall due-list `from` defaults today → overdue dropped (FE floors 2000-01-01) | E | KNOWN | S,C | recall | dental-scheduling SCH-G9 | — | listDueRecalls | P3 | data-loss |
| E-KNOWN-07 | AR-aging seed has no aged receivables (undemoable) | E | KNOWN | C | invoice | dental-billing BIL-G8 | — | getArAging | P3 | cosmetic |
| E-KNOWN-08 | getCollectionsSummary 0 consumers | E | KNOWN | — | invoice | dental-billing BIL-G7 | — | getCollectionsSummary | P3 | cosmetic |
| E-KNOWN-10 | EM-BIL-002 cross-tenant report scope — **FIXED + pinned** (not a gap) | E | KNOWN | R | invoice/claim | dental-billing | EM-BIL-002 | getArAging+4 | — | cross-tenant |

---

## 4. Cross-Workflow Ordering Invariants

The sequencing gaps that span families (pulled from each appendix's Step-2 output):

1. **The clinical spine: `visit → consent(signed,non-revoked) → treatment performed → visit complete →
   invoice → issue → pay`** holds end-to-end and is gate-enforced at each hop (consent double-gated at
   treatment-perform AND invoice; double-bill guarded; payment-before-issue rejected). **Two leaks in the
   spine's consent edge:**
   - **GAP-A07** — the perform consent gate is *visit*-scoped, so a **carried-over** treatment can be
     performed under consent for a *different* procedure set.
   - **GC-13 / OG-C4** — a case-presentation **accept e-sig** is a *plan-level* acceptance; it must NOT be
     read as satisfying the *per-treatment* BR-014 consent. These are two consent concepts that can diverge.

2. **Plan-accept split-brain (GAP-A05 / matrix §H)** — two unreconciled accept paths: the version-snapshot
   (`acceptTreatmentPlan` → append-only `treatment_plan_versions`) and the header FSM (`approveTreatmentPlan`
   → `dentalTreatmentPlans` derive). Accept on one does not move the other, and the snapshot path writes no
   audit row. Ordering invariant *"a plan is accepted ⟺ exactly one canonical record advances + is audited"*
   is violated. **Decision-gated** (which store is canonical).

3. **Chart-layer precedence `completed > proposed > declined > entryClassification`** is correctly applied
   at read time (ADR-008). But the **two write paths diverge**: `upsertDentalChart` merges the baseline,
   `updateTooth` does **not** (**B-G1**) — so the cumulative living-document invariant ("next visit inherits
   all prior dentition") breaks for single-tooth edits.

4. **Offline FSM regression invariant** — a sync apply must never move an entity **backward** along its FSM:
   - treatment `performed → planned/diagnosed` on a stale replay (**CAND-A18**),
   - per-tooth chart state clobbered by a stale full-array (**F-G03 / B-G4**),
   - recall `completed` re-seeding the next cycle on replay (**E-NEW-03**),
   - duplicate create on retried `localId` across visit/chart/treatment/invoice/payment (**F-G02 / F-G16**).
   All four are the *same* missing primitive: **monotonic, idempotent sync apply keyed on localId + a clock.**

5. **Audit occurrence-ordering (F-G01)** — the compliance trail must reflect **clinical occurrence order**,
   not server-insert order; today an offline action that syncs late sorts *above* a clinically-later action.
   Composes with the plan-accept audit-coverage gap (A20): audit the right transitions, in the right order.

6. **Recall outreach single-authority (E-NEW-01)** — the manual FSM flip and the cron both move
   `pending → sent` on different columns; the invariant *"a recall reaches `sent` only via the consent-gated
   dispatch path"* is unenforced, so a manual flip silently suppresses the automated notice.

7. **Lab order ↔ chart/treatment linkage (D16)** — WF-017 specifies the order floats *from* a tooth/treatment
   and links *back* on fitting; today the order has no `treatment_id` and no chart entry point, so the
   chairside sequence cannot close the loop.

8. **Governance lookback (F-G13)** — placing a legal hold *after* a retention archive run does not reverse
   the archive; the invariant *"an active hold protects all of a subject's data, including data archived in
   the hold's lookback window"* is unmet.

---

## 5. Master Slice Plan (global, value-ordered)

All proposed TDD slices across chunks, renumbered `SL-01…` with the chunk-local id kept. Change-risk:
**additive** (new column/endpoint/UI, no behavior change to existing paths) · **behavior-changing** (alters
an existing path's outcome) · **breaking** (contract/FSM change requiring regen + consumer update).
**Decision-gated** slices need a §6 product decision before execution.

### Tier 1 — Additive + high-severity (P1 data-loss / money / cross-tenant). Build first; mostly no decision.

| SL | Title | chunk-id | owning chunk | change-risk | severity addressed | depends | decision-gated? |
|---|---|---|---|---|---|---|---|
| **SL-01** | localId idempotency key for ALL offline creates (visit/chart/treatment/invoice/payment) | F-SL-F01 (+B-SL-B02, E-SL-E02, D-SL-D07) | F | additive (partial unique index) | F-G02 P1 data-loss | — | No |
| **SL-02** | Clock-aware per-tooth chart merge (mirror cadence LWW) | F-SL-F02 (+B-SL-B03) | F | breaking (chart body gains clock field → regen) | F-G03 P1 data-loss | SL-01 | No |
| **SL-03** | Baseline merge on per-tooth PATCH (close B-G1) | B-SL-B01 | B | behavior-changing | B-G1 P1 data-loss (live) | — | No |
| **SL-04** | Idempotency guard for ADR-004 Tier-2 financial endpoints (payment/discount/plan) | F-SL-F06 | F | additive | F-G16 P1 money | SL-01 | No |
| **SL-05** | Fail-closed audit on invoice void (close E-NEW-02 / matrix P1-C residual) | E-SL-E01 | E | behavior-changing (1-line) | E-NEW-02 P2 money | — | No |
| **SL-06** | Audit + canonicalize plan-accept (write audit row; designate/move FSM) | A-SL-A01 | A | behavior-changing | GAP-A05/A20 P1 data-loss | — | **Yes** (#1 canonical accept) |
| **SL-07** | Persist perio diagnosis (Stage/Grade/Extent + risk-factor snapshot) | C-SL-C01 | C | additive (migration + optional fields) | GC-05/06 P1 clinical data-loss | — | partial (#18 persistence shape) |
| **SL-08** | Sweep optional-branch-omission for portal/emr/provider/external-import | F-SL-F04 | F | additive (tests + guards) | F-G06 P1 cross-tenant | — | No |
| **SL-09** | Monotonic treatment-status merge for offline sync | A-SL-A02 | A | additive (pure merge guard) | CAND-A18 P1 data-loss | SL-01 | No |
| **SL-10** | Offline concurrent active-visit resolution | A-SL-A05 | A | additive | CAND-A19 P1 data-loss | SL-09 | partial (#2 offline policy) |

### Tier 2 — Additive P2 (correctness / coverage / workflow). Build after Tier 1.

| SL | Title | chunk-id | owning chunk | change-risk | severity | depends | decision-gated? |
|---|---|---|---|---|---|---|---|
| SL-11 | Atomic option-group accept + FSM-validated writes | A-SL-A03 | A | behavior-changing | GAP-A02/A04 P2 | — | No |
| SL-12 | Persist + surface sync conflicts (conflictPayload) | F-SL-F05 | F | breaking (sync FSM `conflict` state) | F-G04 P2 | SL-01,SL-02 | No |
| SL-13 | Audit occurrence-time ordering (occurredAt column) | F-SL-F03 | F | additive (nullable column) | F-G01 P2 | — | partial (#3 want occurredAt now?) |
| SL-14 | Clinically-honest chart diff (reclassification / extraction buckets) | B-SL-B04 | B | additive (pure-fn bucket) | B-G6 P2 | — | No |
| SL-15 | Extracted/missing-tooth charting guard | B-SL-B06 | B | behavior-changing (422) | B-G8 P2 | — | No |
| SL-16 | Treatment-scoped consent gate for carried-over performs | A-SL-A07 | A | behavior-changing | GAP-A07 P2 | SL-19 | partial (#4 consent scope) |
| SL-17 | Idempotent server-side Sign-with-snapshot (SOAP) | C-SL-C03 | C | additive (optional body) | GC-14/15 P2 | SL-01 | No |
| SL-18 | Informed-refusal flags/blocks the procedure perform | C-SL-C05 | C | behavior-changing | GC-18 P2 | SL-21 | **Yes** (#5 block vs advise) |
| SL-19 | Wire carry-over FE trigger + source-status guard | A-SL-A04 | A | additive (FE) | GAP-A08/A06 P1/P3 | SL-06 | **Yes** (#7 carry-over model) |
| SL-20 | Reconcile manual recall `sent` flip with cron | E-SL-E03 | E | behavior-changing (FSM narrow) | E-NEW-01 P2 | — | **Yes** (#6 recall authority) |
| SL-21 | Consent revoke + history + refusals view | C-SL-C02 | C | additive (FE) | GC-09 P1 | — | No |
| SL-22 | Mixed dentition patient-specific | B-SL-B05 | B | behavior-changing | B-G7 P2 | — | **Yes** (#8 eruption vs charted) |
| SL-23 | Carry-over read-path contract coverage | B-SL-B07 | B | additive (test only) | B-G9 P2 | — | No |
| SL-24 | Lab order chart linkage + remake loop | D-SL-D05 | D | breaking (treatment_id col + remake op) | D16/D17 P2 | SL-26 | partial (#20 lab scope) |
| SL-25 | Persisted ceph superimposition timeline | D-SL-D06 | D | additive (FE wiring) | D12 P2 | — | partial (#12 superimposition V1) |
| SL-26 | Wire dead Lab + PMD triggers | D-SL-D01 | D | additive (FE) | D03/D04 P1 | — | No |
| SL-27 | Accept-plan e-sig ⇏ bypass per-treatment consent (assert invariant) | C-SL-C07 | C | additive (test; behavior-changing if it currently bypasses) | GC-13 P2 | — | No |
| SL-28 | Bulk import row cap (+ owner-only UI if decided) | D-SL-D04 | D | additive (cap) / FE (gated) | D10 P1 / D09 P1 | — | **Yes** (#13 bulk import UI) |
| SL-29 | `listDueRecalls` includes overdue by default | E-SL-E05 | E | behavior-changing (default) | E-KNOWN-09 P3 | — | partial (#21 default vs floor) |
| SL-30 | Recall localId + idempotent next-cycle seeding | E-SL-E04 | E | additive (column) | E-NEW-03/04 P3 | SL-20,SL-01 | partial (folds into #6) |
| SL-31 | Prescription list + dispense/cancel FE | C-SL-C04 | C | additive (FE) | GC-10 P1 | — | No |
| SL-32 | Visit-lock scheduled job | A-SL-A06 | A | additive (cron) | GAP-A03 P2 | — | **Yes** (#9 locked tier in V1) |
| SL-33 | Locked-visit treatment/chart amendment | A-SL-A08 | A | additive | CAND-A14 P2 | SL-32 | **Yes** (#9 locked tier) |
| SL-34 | Owner reverse/re-open wrongly-completed visit | A-SL-A09 | A | breaking (FSM edge) | CAND-A15 P2 | — | **Yes** (#9 reversal policy) |
| SL-35 | Accepted-plan version viewer + header FSM wiring | A-SL-A10 | A | additive (FE) | GAP-A09/A10 P2 | SL-06 | **Yes** (#11 viewer surface) |
| SL-36 | Imaging auto-detect: resolve no-AI + stop retrying 403 | D-SL-D08 | D | additive / removal | D11 P1 / D14 P2 | — | **Yes** (#11 AI keep/remove) |
| SL-37 | CBCT finalize reachable from prod overlay | D-SL-D09 | D | additive (FE) | D13 P2 | — | **Yes** (#12 CBCT scope) |
| SL-38 | Attachment upload idempotency | D-SL-D07 | D | additive | D18 P2 | SL-01 | No (folds into SL-01) |
| SL-39 | Wire care-record FHIR export + imported-PMD history + real share artifact | D-SL-D10 | D | additive (FE) | D22/D23/D24 P2 | SL-26 | partial (#10 PMD intent) |

### Tier 3 — Decision-gated by design / deferred (do NOT execute without the decision). Clearly marked.

| SL | Title | chunk-id | owning chunk | change-risk | depends | gate |
|---|---|---|---|---|---|---|
| SL-40 | PMD → signed FHIR Bundle with Safety Floor + demographics | D-SL-D02/D03 | D | breaking | SL-26 | **#10 PMD intent** — is PMD canonical FHIR+signed, or narrowed snapshot? |
| SL-41 | EMR scope decision gate (+ cross-tenant admin regression) | C-SL-C06 | C | path-dependent | — | **#14 EMR in scope?** keep/dormant/remove + global vs clinic admin |
| SL-42 | Erasure tenancy gate (who-may-erase) | (matrix ER-P1-1/P1-3) | F | behavior-changing | SL-08 | **#15 who may erase** (per-tenant owner vs platform admin) |
| SL-43 | Governance operator UIs (legal-hold / retention / erasure) | (matrix) | F | additive (FE) | — | **#16 MVP governance UI?** |
| SL-44 | Legal-hold late-archive restore path (F-G13) | F-G13 | F | additive | — | **#17 un-archive posture** — restore vs recoverable-only |
| **— DEFERRED BY DESIGN (do not slice):** | | | | | | |
| — | Durable write-time chart sync (treatment perform → tooth auto-charts) | B-C1 | B | — | — | **ADR-008** read-time-interim deliberately deferred; revisit trigger not met |
| — | Per-tooth P2P merge program (cadence activation) | B-C2 / F-G05 | F | — | SL-01,SL-02 | cadence init is stubbed (CLAUDE.md); latent until activation |
| — | `/dental/emr-import` FHIR/CDA/PDF bridge | D25 | D | — | — | Phase-3+ by design (V-XRI-003) |
| — | Imaging AI auto-tracing / perio voice charting | (non-goal) | — | — | — | **Intentional non-goal** (local-first, no-AI) — do NOT propose |

**Counts:** Tier 1 = **10 slices** (8 ready, 2 partial-decision). Tier 2 = **29 slices** (~14 ready, ~15
decision-tinted). Tier 3 = **5 decision-gated + 4 deferred-by-design**. **Ready-to-execute now (no decision):
≈22 slices.** Decision-gated (Tier-1 partial + Tier-2 gated + Tier-3): **≈21 slices + 4 hard-deferred.**

---

## 6. Open Questions / Decisions Needed (consolidated, deduped)

Resolve before executing the gated slices. Numbered; each cites the chunks/slices it blocks. Items already
**RESOLVED** in MASTER-GAP-MATRIX §6 (#4 permission-grid REMOVE, #5 fee pricing, #6 working-hours shape,
#8 notif relabel) are excluded.

1. **Canonical plan-accept (blocks SL-06, SL-19, SL-35).** Is the version-snapshot (`treatment_plan_versions`)
   or the header FSM (`dentalTreatmentPlans`) the source of truth, and should accept drive both? (A/§H;
   a *new* decision the research surfaced — not in matrix §6.)
2. **Offline conflict policy (blocks SL-09, SL-10, SL-12, and the whole sync tier's "now vs later").**
   Confirm FSM-monotonic merge + deterministic active-visit resolution (rejecting naive LWW for treatment
   status), AND confirm whether SL-01/02/12 are **V1 hardening now** (cheap, before cadence activates) or
   deferred until cadence is wired (F-G05 — currently stubbed). *Recommendation: do now; dangerous to
   retrofit after duplicate/clobbered data exists.* (A/B/F.)
3. **Audit occurrence-time (blocks SL-13).** Add `occurredAt` ordering now (forward-compatible, additive,
   cheap) or accept server-insert order while sync is stubbed? (F.)
4. **Consent scope for carried-over performs (blocks SL-16).** Is the visit-scoped consent gate acceptable,
   or must consent be procedure/plan-scoped when performing a carried-over treatment? (A/C; GAP-A07, GC-13.)
5. **Informed-refusal enforcement (blocks SL-18).** Should a recorded refusal **block** the procedure's
   perform (override-with-reason) or remain advisory-only? (C/GC-18.)
6. **Recall outreach authority (blocks SL-20, SL-30).** Should manual `→sent` be **disallowed** (cron is the
   only consent-gated sender) or should the manual path also enqueue the gated notification? Drives the
   recall FSM + recalls-sheet affordance. (E/E-NEW-01/07.)
7. **Carry-over model & source-status guard (blocks SL-19; = matrix §6 #9).** Is `POST /carry-over` the
   intended cross-visit completion path (then wire the FE trigger), or mark-done-in-place (then remove dead
   "Carried Over" UI)? Must carry-over gate on source visit status (completed/locked only)? Keep cross-branch
   carry-over or add a source-branch guard (GAP-A13, matrix §13 / OQ#9)? (A.)
8. **Mixed-dentition source (blocks SL-22).** Eruption-age tables vs charted-presence as the authority for
   the mixed-dentition tooth set? (B/B-G7.)
9. **Locked tier in V1 (blocks SL-32, SL-33, SL-34).** No lock job exists; `locked` is unreachable in prod.
   Build the job (and post-lock amendment / reverse-reopen), or accept `completed` as the terminal durable
   state? (A; not in matrix §6.)
10. **PMD intent (blocks SL-39, SL-40; = matrix §6 #15).** True canonical PMD (FHIR + JWS-signed + Safety
    Floor + demographics) vs intentionally-narrowed internal visit-snapshot? Self-signed facility cert OK for
    the pilot? (D/D05/D06/D07.)
11. **Imaging AI auto-detect (blocks SL-36; = matrix §6 #13).** Reverse the no-AI non-goal (keep + ship a real
    detector) or remove the affordance? Is the addon detector real or still FakeDetector? (D/D11/D14.)
12. **CBCT / superimposition V1 scope (blocks SL-25, SL-37; = matrix §6 #14).** Is preview-only
    superimposition an intentional V1 cut? Does the prod upload form offer `modality='cbct'`? (D.)
13. **Bulk patient import V1 (blocks SL-28 UI half; = matrix §6 #21).** Build owner-only import UI vs dormant
    primitive; max row count + reject-vs-partial on oversized. (The row-cap half is unblocked — do it
    regardless.) (D.)
14. **EMR-consultation in scope (blocks SL-41; = matrix §6 #20).** Keep+build / dormant-relabel / remove?
    Global platform admin vs clinic-scoped admins (determines if GC-02 admin-sees-all is a live or latent
    cross-clinic PHI leak)? The cross-tenant **security regression test is independent of A/B/C — do it now.**
    (C.)
15. **Who may erase (blocks SL-42; = matrix §6 #17).** Clinic `dentist_owner` per-tenant vs platform `admin`
    only? Gates the ER-P1-1 tenancy fix. (F.)
16. **Governance operator UIs in MVP (blocks SL-43; = matrix §6 #18/#19).** Build legal-hold / retention /
    erasure admin surfaces for V1? Reaffirm the platform-superuser DPO model (must NOT be re-scoped by the
    SL-08 sweep). (F.)
17. **Late legal-hold archive restore (blocks SL-44; F).** Must placing a hold restore rows already
    soft-archived within its lookback window, or is "recoverable but not auto-restored" the accepted posture?
18. **Perio finalize authority + persistence shape (tints SL-07; = matrix §6 #12).** May a hygienist finalize
    Stage/Grade (code allows it; docstring says dentist-only)? Discrete columns vs JSONB for the diagnosis?
    Correction path for a completed chart with a mistyped risk factor (GC-17)? (C.)
19. **Consent expiry / re-consent (blocks GC-21).** Re-consent prompt for long-deferred treatments, or is a
    once-signed consent valid indefinitely? (C.)
20. **Lab order chart-linkage scope (blocks SL-24; not in matrix §6).** Is "Send to Lab from chart" +
    `treatment_id` linkage + the remake/warranty loop in V1, or deferred? (Schema models the columns; no
    workflow exists.) (D/D16/D17.)
21. **Recall due-list default (tints SL-29; = matrix §6 #24).** Change backend `listDueRecalls` `from` default
    to include overdue, or ratify the FE `2000-01-01` floor as the contract? (E.)

**Doc-only follow-ups (no decision, just fix the prose):** SEQ-E4 — MODULE_SPEC §4 WF-014 says partial
requires an active plan; code + AC-PAY-01 intentionally allow partial-without-plan → update the stale spec.
