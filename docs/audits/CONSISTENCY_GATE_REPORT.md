<!-- oli: oli-check | dimension=consistency | spec-gate stage-1 | re-validation -->
<!-- corpus: 12 MODULE_SPEC.md + API_CONTRACTS.md × 13 cross-cutting specs -->
<!-- delta-base: docs/audits/CONSISTENCY_GATE_REPORT.md (2026-05-31) + docs/product/CONSISTENCY_REPORT.md (2026-05-30) -->
<!-- engine map: docs/audits/codebase-map/ (FRESH, producer=engine, THESIS IN FORCE, confidence_threshold=MEDIUM) -->

# Consistency Gate Report — Dentalemon

_Generated: 2026-06-02 (oli-check consistency dimension, Stage 1 via oli-spec-gate workflow) · Read-only · Re-validated against current spec artifacts_

## Gate Result

**PASS** — 0 HIGH conflicts. All 6 prior HIGH findings remain RESOLVED and re-confirmed against current artifacts and code. Since the 2026-05-31 gate report, **5 of 6 then-open MEDIUM/LOW items are now FIXED in the artifacts** (perio + emr-consultation doc-lag reconciled). **1 new MEDIUM finding** surfaced: invoice FSM token drift (`sent` → `issued`) in two upstream catalog docs (DOMAIN_MODEL §6 + WORKFLOW_MAP §6) that lag the now-authoritative `issued` token used by code, billing MODULE_SPEC, billing API_CONTRACTS, and DOMAIN_GLOSSARY. None block planning.

This is a **regulated project** (PRD_AUDIT_REPORT: `regulated-compliance | YES`). Stage 2 (human review / role-based sign-offs) is **NOT auto-approvable under `--auto`** and is correctly DEFERRED to an interactive `/oli-spec-gate` run. This report covers Stage 1 (consistency cross-validation) only.

---

## Method & Scope

12 MODULE_SPEC (+ API_CONTRACTS where present: 11 of 12 — emr-consultation is facade-only, no API_CONTRACTS.md) cross-validated against MODULE_MAP, DOMAIN_MODEL, DOMAIN_GLOSSARY, WORKFLOW_MAP, EVENT_CONTRACTS, ROLE_PERMISSION_MATRIX, AUDIT_CONTRACTS, ERROR_TAXONOMY, API_CONVENTIONS, NAVIGATION_MAP, UI_CONVENTIONS, DATA_GOVERNANCE, UI_CONSISTENCY_SPEC.

Checks run (per oli-spec-gate Stage 1, C2–C10b):
- C2 naming (glossary ↔ specs), C3 structural (domain-model ↔ specs), C4 API contracts, C5 UI blueprint, C6 workflow-map ↔ specs, C7 role-matrix ↔ all specs, C8 cross-module workflow trace, C9 permission closure, C10 semantic alignment, C10b NFR conflicts. Engine codebase map at `docs/audits/codebase-map/` used to confirm spec-vs-code state-machine alignment (e.g. invoice status enum).

---

## Delta vs prior report (2026-05-31) — items now FIXED (verified in current artifacts + code)

| Prior ID | Severity | What was fixed | Evidence |
|----------|----------|----------------|----------|
| F-036 | MEDIUM | "Periodontal Terms" subsection added to DOMAIN_GLOSSARY | DOMAIN_GLOSSARY lines 72–85: Perio Chart, Probing Depth, BOP, Recession, Mobility, Furcation, Probing Site, CEJ, PSR, Perio Staging all defined |
| F-037 | MEDIUM | `PerioChart` (root) + `PerioToothReading` (entity) classified in DOMAIN_MODEL §3 | DOMAIN_MODEL line 63 (aggregate root), line 86 (entity) |
| F-039 | MEDIUM | Perio error codes added to ERROR_TAXONOMY | dental-perio block now lists `CHART_EXISTS`(409), `INVALID_DEPTH`(422), `INVALID_TOOTH_NUMBER`(422) + `CHART_COMPLETED`, `INSUFFICIENT_READINGS` (lines 179–183) |
| F-040 | MEDIUM | WF-P01..WF-P05 registered in WORKFLOW_MAP §2b | 5 `WF-P0*` hits; perio scoped as "one of the 10 dental domain modules — count unchanged" |
| F-042 | MEDIUM | emr-consultation error block + `CONSULTATION_NOT_DRAFT` added to ERROR_TAXONOMY | ERROR_TAXONOMY lines 228–234 |
| F-043 | LOW | WF-EMRC-001..006 in WORKFLOW_MAP §2b; emr-consultation platform-role note in ROLE_PERMISSION_MATRIX | 6 `WF-EMRC` hits; ROLE_MATRIX line 39 records intentional exclusion |

The 6 HIGH findings from the original 2026-05-24 run (F-016/17/18 auth, F-019/F-034 coupling, F-035 roles) remain RESOLVED and code-verified.

---

## Open Conflicts (current)

| ID | Type | Severity | Artifacts involved | Description | Suggested resolution | Confidence |
|----|------|----------|--------------------|-------------|----------------------|------------|
| F-044 | Semantic / state-machine naming (C3/C10) | **MEDIUM** | DOMAIN_MODEL §6 SM-INVOICE + WORKFLOW_MAP §3/§5/§6 ↔ DOMAIN_GLOSSARY + billing MODULE_SPEC §8 + billing API_CONTRACTS + code (`dental-invoice.schema.ts`) | Two upstream catalog docs still carry the **retired** invoice token `sent` and omit `issued`. DOMAIN_MODEL §6 SM-INVOICE = `draft → sent → paid` (lines 185–199); WORKFLOW_MAP §6 Invoice SM = `draft → sent → paid` (lines 386–390), §3 line 161 "Send (draft→sent)", §5 BR-012 text. The authoritative chain (DOMAIN_GLOSSARY line 65, billing MODULE_SPEC §8 line 133, billing API_CONTRACTS lines 9–10 V-BIL-015, and the `DentalInvoiceStatus` enum `['draft','issued','partial','paid','overdue','voided']`) uses **`issued`**; `sent` was explicitly retired (F-021). Drift is documentation-lag in the two catalogs only — no code/owner-spec divergence. | Update DOMAIN_MODEL §6 SM-INVOICE and WORKFLOW_MAP §3/§5/§6 to replace `sent` → `issued` (and `void` → `voided` for terminal-state consistency with the enum). Owner-of-truth for the token = DOMAIN_GLOSSARY + code (both `issued`). | **HIGH** (drift is unambiguous; code + 3 docs agree on `issued`) |
| F-022 | API semantics (C5) | LOW (carried) | dental-scheduling MODULE_SPEC §10 + API_CONTRACTS ↔ API_CONVENTIONS | `DELETE /dental/appointments/:id` used for soft-cancel (reason required, record preserved). Internally consistent; deviates from REST-soft-transition convention. | Note only — internally consistent. | HIGH |
| F-025/026 | Events (C9) | LOW (carried) | dental-scheduling ↔ EVENT_CONTRACTS | No dedicated `AppointmentRescheduled` event; DE-010 `AppointmentBooked@1` covers book+reschedule. | Documented-consistent; note only. | HIGH |
| F-029/030 | API/UI coverage (C4/C5) | LOW (carried) | dental-scheduling API_CONTRACTS; dental-org WF-028 | `GET /dental/appointments/:id` response shape not explicitly defined; org subscription-tier-change (WF-028) has no dedicated screen. | Minor coverage gaps, not contradictions. | MEDIUM |
| F-045 | Structural / coverage (C4) | LOW (new note) | emr-consultation module dir | emr-consultation has MODULE_SPEC.md only — no `API_CONTRACTS.md` (endpoints documented inline in §10). By design (platform facade module), but no dedicated contract artifact for the consistency C4 pair. | Optional: extract emr-consultation §10 endpoints to an API_CONTRACTS.md for symmetry, or record the intentional omission. Non-blocking. | HIGH |

---

## Confirmed-Consistent Anchors (re-verified 2026-06-02)

- **Invoice FSM** `draft → issued → partial → paid | overdue | voided` — consistent across billing API_CONTRACTS, billing MODULE_SPEC §8, DOMAIN_GLOSSARY, code enum, UI prototype. **(`sent` fully retired in owner-spec + code; F-044 tracks the two lagging catalog docs only.)**
- **Appointment FSM** `scheduled → checked_in | cancelled` — consistent across API_CONTRACTS header, MODULE_SPEC §8, DOMAIN_MODEL.
- **Visit FSM** `draft → active → completed → locked` (forward-only, no reopen) — consistent across MODULE_SPEC §8, screens.md, DOMAIN_MODEL SM-VISIT, WORKFLOW_MAP §6.
- **Treatment FSM** `diagnosed → planned → performed → verified` + `any → dismissed` — consistent across DOMAIN_MODEL §6, WORKFLOW_MAP §3/§6, code (TR-WF-PLAN cleared 2026-06-01).
- **Perio FSM** `draft → completed → locked` + hygienist write permission — consistent across MODULE_SPEC §6/§7/§8, DOMAIN_GLOSSARY, DOMAIN_MODEL, ROLE_PERMISSION_MATRIX (hygienist), code.
- **EMR-consultation FSM** `draft → finalized` (terminal, no amend; WF-EMRC-004 struck V-EMR-001) — consistent across MODULE_SPEC §5/§8/§11, ERROR_TAXONOMY (`CONSULTATION_NOT_DRAFT`), WORKFLOW_MAP §2b.
- **Permission closure (tightened ops):** `staff_full` create/issue invoice + payment plan = **DENIED** consistently across ROLE_PERMISSION_MATRIX (Billing Write Ops), billing MODULE_SPEC §6 (V-BIL-003) + §1 Users; `hygienist` create-visit / create-consent = **DENIED** (not granted in any module spec; perio §6 grants only perio-chart write — matrix-aligned). No role contradictions across modules.
- **Role tokens** (`dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`, `hygienist` + 4 extended G8-S3 roles) — consistent across ROLE_PERMISSION_MATRIX and all dental MODULE_SPEC §6 tables.
- **Scheduling state-change scoping (N-SCH-03):** `staff_scheduling` excluded from cancel + check-in — consistent across ROLE_MATRIX, dental-scheduling MODULE_SPEC §6, and code (`cancelAppointment.ts`, `checkInAppointment.ts`).
- **Cross-module coupling:** dental-clinical → dental-visit via VisitService interface (G-003/F-034 closed); dental-org → dental-audit proxy; emr-consultation facade-only.

---

## NFR Conflict Detection (C10b)

| Check | Result |
|-------|--------|
| Performance vs Audit (logging latency) | No conflict — audit writes are async via pg-boss (WF-096, < 5s background SLA); user-facing SLAs (< 1–2s) not on the audit write path. |
| Security vs Usability (MFA flow) | No spec-level conflict surfaced; Better-Auth 2FA available, no MODULE_SPEC requires an MFA UI step absent from interaction states. |
| Scalability vs Consistency (sync) | No SYNC_ARCHITECTURE.md present in `docs/product/`; Cadence CRDT noted in glossary but no sync-matrix artifact to cross-validate — check SKIPPED (no artifact pair). |
| Performance vs Data Governance (field encryption) | DATA_GOVERNANCE.md present; no field-level-encryption-vs-fast-query contradiction declared in MODULE_SPEC §16 NFRs. |

No NFR conflicts at MEDIUM or above.

---

## Artifact Dependency DAG

```
DOMAIN_GLOSSARY ──► MODULE_SPEC (naming)                ── authoritative for entity/status tokens
DOMAIN_MODEL ──► MODULE_SPEC §7/§7b/§8/§10b             ── §6 SM-INVOICE STALE (F-044)
WORKFLOW_MAP ──► MODULE_SPEC §3/§4                      ── §3/§5/§6 invoice token STALE (F-044)
ROLE_PERMISSION_MATRIX ──► MODULE_SPEC §6 ──► API_CONTRACTS  ── consistent
MODULE_SPEC ──► API_CONTRACTS (endpoints)              ── consistent (emr-consultation inline only, F-045)
MODULE_SPEC ──► UI_BLUEPRINT (data binding)
ERROR_TAXONOMY ◄── MODULE_SPEC/API_CONTRACTS error codes  ── consistent (perio + emr blocks complete)
code (services/api-ts) ◄── enum/FSM ground truth        ── invoice enum = issued (authoritative)
```

Targeted re-validation on spec change: if DOMAIN_GLOSSARY invoice entry or billing MODULE_SPEC §8 changes, re-check DOMAIN_MODEL §6 + WORKFLOW_MAP §6 (F-044 anchor).

---

## Checks Run / Skipped

| Check | Status |
|-------|--------|
| C2 naming (glossary ↔12 specs) | RUN — pass (perio terms now present) |
| C3 structural (domain-model ↔ specs) | RUN — 1 finding (F-044 SM-INVOICE) |
| C4 API contracts (specs ↔ API_CONTRACTS) | RUN — pass; F-045 note (emr-consultation no API_CONTRACTS.md) |
| C5 UI blueprint (specs ↔ ui-prototype) | RUN — pass (carried LOW notes only) |
| C6 workflow-map ↔ specs | RUN — 1 finding (F-044 invoice §3/§6) |
| C7 role-matrix ↔ all specs | RUN — pass (permission closure clean) |
| C8 cross-module workflow trace | RUN — pass (check-in→visit, visit→invoice, PMD chain) |
| C9 permission closure | RUN — pass (no role contradictions) |
| C10 semantic alignment (shared entities) | RUN — 1 finding (F-044 invoice token) |
| C10b NFR conflicts | RUN — pass |
| Sync consistency | SKIPPED — no SYNC_ARCHITECTURE.md in docs/product/ |

---

## Counts by Severity

| Severity | Open | Resolved-since-prior (2026-05-31) |
|----------|------|------------------------------------|
| HIGH (P0) | **0** | 6 (all prior HIGH confirmed still resolved) |
| MEDIUM (P1) | **1** (F-044) | 5 (F-036, F-037, F-039, F-040, F-042) |
| LOW (P2/P3) | **4 notes** (F-022, F-025/026, F-029/030, F-045) | 1 (F-043) |

---

## Overall Verdict

**PASS** — No HIGH conflicts; Stage 1 consistency gate is clear. The single open MEDIUM (F-044) is pure documentation-lag in two upstream catalog docs whose owner-of-truth (DOMAIN_GLOSSARY + code + billing owner-spec) is already correct and self-consistent on `issued`. No enforcement gaps, no state-machine contradictions in code, no permission disagreements with ROLE_PERMISSION_MATRIX. It is wave-addressable and does **not** gate `/oli-plan-slices`.

**Recommended doc-reconciliation (single small wave):**
1. **F-044** — In DOMAIN_MODEL §6 SM-INVOICE and WORKFLOW_MAP §3/§5/§6, replace `sent` → `issued` and `void` → `voided` to match the glossary + code enum. (Suggest-only patch; specs are human-owned — emit to SPEC_REVIEW_PATCHES.md before applying.)
2. **F-045** (optional) — extract emr-consultation §10 endpoints into an `API_CONTRACTS.md` for C4 symmetry, or record the intentional facade-only omission in the module dir.

_Stage 2 (human review / regulated sign-offs) remains DEFERRED to an interactive `/oli-spec-gate` run — `--auto` cannot auto-approve sign-offs on a regulated project (PRD_AUDIT_REPORT regulated=YES). Use `--force-auto` only with an explicit audit-trail decision._
