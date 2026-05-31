<!-- oli: oli-check | dimension=consistency | spec-gate stage-1 | re-validation -->
<!-- corpus: 12 MODULE_SPEC.md + API_CONTRACTS.md × 13 cross-cutting specs -->
<!-- delta-base: docs/product/CONSISTENCY_REPORT.md (2026-05-30) -->

# Consistency Gate Report — Dentalemon

_Generated: 2026-05-31 (oli-check consistency dimension) · Read-only · Re-validated against current spec artifacts_

## Gate Result

**PASS** — 0 HIGH conflicts. All 6 prior HIGH findings remain RESOLVED and re-confirmed against current artifacts. Since the prior report (2026-05-30), the specs have advanced: **8 of 14 then-open MEDIUM/LOW items are now FIXED in the artifacts**. 6 MEDIUM/LOW items remain open (all documentation/catalog lag for the two newest modules — dental-perio + emr-consultation). None block planning.

---

## Method & Scope

12 MODULE_SPEC + API_CONTRACTS (dental-org, dental-patient, dental-visit, dental-scheduling, dental-billing, dental-clinical, dental-imaging, dental-pmd, dental-perio, dental-audit, external-records-import, emr-consultation) cross-validated against MODULE_MAP, DOMAIN_MODEL, DOMAIN_GLOSSARY, WORKFLOW_MAP, EVENT_CONTRACTS, ROLE_PERMISSION_MATRIX, AUDIT_CONTRACTS, ERROR_TAXONOMY, API_CONVENTIONS, NAVIGATION_MAP, UI_CONVENTIONS, DATA_GOVERNANCE. Checks: (1) naming, (2) structural, (3) semantic, (4) cross-reference integrity.

---

## Delta vs prior report — items now FIXED (verified in artifacts)

| Prior ID | Severity | What was fixed | Evidence |
|----------|----------|----------------|----------|
| F-001/2/5/6/27 | MEDIUM/LOW | Glossary terms added | `Focal Card`, `Baseline`, `imagingTier`, `Carry-over`, `Amendment` all present in DOMAIN_GLOSSARY |
| F-003 | MEDIUM | Invoice terminal state aligned to `void` | DOMAIN_GLOSSARY Invoice entry now `draft → issued → partial → paid \| overdue \| void` |
| F-004 | MEDIUM | Scheduling FSM header uses `scheduled` | dental-scheduling/API_CONTRACTS line 10: `scheduled → checked_in \| cancelled` |
| F-008/9/10/24 | MEDIUM | Billing schema completed | MODULE_SPEC §7 `dental_invoice` now lists `notes`, `discount_cents`, `discount_reason`, `issued_at` + computed `subtotal_cents`/`paid_cents`/`outstanding_cents` |
| F-012 | MEDIUM | Audit-log route de-duplicated | dental-org screens deep-link `/audit/log`; canonical owner = dental-audit |
| F-013/14/15 | MEDIUM | §4 Workflow Details added | clinical/billing/imaging MODULE_SPEC each now have `## 4. Workflow Details` |
| F-021 | MEDIUM | Billing issue `sent` → `issued` | API_CONTRACTS V-BIL-015 retired `sent`; no `sent` token remains in dental-billing |
| F-023 | MEDIUM | Visit "Reopen" removed | screens.md: "no Reopen action — state machine is forward-only" |
| F-031 | LOW | Amendments endpoint added to §10 | dental-clinical MODULE_SPEC line 149 lists `POST /dental/visits/:id/amendments` |
| F-035 | HIGH | dental-pmd roles fixed | §6: `dentist_owner, dentist_associate` (Generate-PMD) |
| F-038 | MEDIUM | dental-perio API_CONTRACTS Auth now includes `hygienist` | All 5 Auth lines list `hygienist` (matches §6 + matrix) |

The 6 HIGH findings from the original 2026-05-24 run (F-016/17/18 auth, F-019/F-034 coupling, F-035 roles) remain RESOLVED and code-verified.

---

## Open Conflicts (current)

| ID | Type | Severity | Artifacts involved | Description |
|----|------|----------|--------------------|-------------|
| F-036 | Naming (C1) | MEDIUM | dental-perio MODULE_SPEC §2 ↔ DOMAIN_GLOSSARY | 9 perio terms (`Probing Depth`, `Perio Chart`, `BOP`, `Recession`, `Mobility`, `Furcation`, `Probing Site`, `CEJ`, `PSR`, `Perio Staging`) defined in §2 but absent from DOMAIN_GLOSSARY (no "Periodontal Terms" subsection). Verified `Probing Depth`/`Perio Chart`/`Furcation`/`PSR`/`Recession` = 0 hits in glossary. |
| F-037 | Structural (C3) | MEDIUM | dental-perio MODULE_SPEC §7/§7b ↔ DOMAIN_MODEL §3 | Aggregate root `PerioChart` and child `PerioToothReading` not classified in DOMAIN_MODEL §3 (0 hits). Entity inventory predates perio. |
| F-039 | API/Error (C5) | MEDIUM | dental-perio API_CONTRACTS/§15 ↔ ERROR_TAXONOMY §dental-perio | Error codes `CHART_EXISTS` (409), `INVALID_DEPTH` (422), `INVALID_TOOTH_NUMBER` (422) used by handlers/contract but ERROR_TAXONOMY dental-perio block lists only `CHART_COMPLETED` + `INSUFFICIENT_READINGS`. Catalog incomplete. (`VISIT_LOCKED`/`FORBIDDEN` are shared platform codes — OK.) |
| F-040 | Structural/X-ref (C3) | MEDIUM | dental-perio MODULE_SPEC §3/§4 ↔ WORKFLOW_MAP | WF-P01..WF-P05 not registered in WORKFLOW_MAP; header still says "10 dental domain modules" (perio = 11th). 0 `WF-P0*` hits in WORKFLOW_MAP. |
| F-042 | API/Error (C5) | MEDIUM | emr-consultation MODULE_SPEC §5/§8/§11 ↔ ERROR_TAXONOMY | `CONSULTATION_NOT_DRAFT` (422, used by finalizeConsultation) has no ERROR_TAXONOMY entry; no `emr-consultation`/`EMRC-` block exists (the `EMR-*`/`PER_` ranges belong to other modules). |
| F-043 | Structural/X-ref (C3) | LOW | emr-consultation ↔ WORKFLOW_MAP + ROLE_PERMISSION_MATRIX | WF-EMRC-001..006 absent from WORKFLOW_MAP; module's Better-Auth role vocab (`provider`/`patient`/`admin`/`:owner`) absent from ROLE_PERMISSION_MATRIX. By-design (platform module, §0/§14) but neither cross-cutting doc records the intentional exclusion, so it reads as a gap on audit. |

### Pre-existing LOW/ambiguity notes carried forward (non-blocking, unchanged)

- **F-022** (LOW, C5/API semantics): dental-scheduling uses `DELETE /dental/appointments/:id` for soft-cancel (record preserved, reason required). Consistent across MODULE_SPEC §10 + API_CONTRACTS, but deviates from REST-soft-transition convention in API_CONVENTIONS. Internally consistent → note only.
- **F-025/F-026** (LOW, C9 events): no dedicated `AppointmentRescheduled` event; DE-010 `AppointmentBooked@1` covers book+reschedule (EVENT_CONTRACTS trigger text confirms). DE-001 emitter clarified to dental-visit. Documented-consistent.
- **F-029/F-030** (LOW): `GET /dental/appointments/:id` response shape (incl. `visit_id`) not explicitly defined in dental-scheduling API_CONTRACTS; dental-org WF-028 (subscription tier change) has no dedicated screen. Minor coverage gaps, not contradictions.

---

## Confirmed-Consistent Anchors (re-verified)

- Invoice FSM `draft → issued → partial → paid | overdue | voided` — consistent across API_CONTRACTS, MODULE_SPEC §7/§8, DOMAIN_GLOSSARY, UI prototype (`sent` fully retired).
- Appointment FSM `scheduled → checked_in | cancelled` — consistent across API_CONTRACTS header, MODULE_SPEC §8, DOMAIN_MODEL.
- Visit FSM `draft → active → completed → locked` (forward-only, no reopen) — consistent across MODULE_SPEC §8, screens.md, DOMAIN_MODEL SM-VISIT.
- Treatment FSM `diagnosed → planned → performed → verified → dismissed` — consistent.
- Perio FSM `draft → completed → locked` + hygienist write permission — now consistent across MODULE_SPEC §6/§8, API_CONTRACTS Auth lines + PerioStatus enum, ROLE_PERMISSION_MATRIX (hygienist row 78).
- Role tokens (`dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`, `hygienist`) — consistent across ROLE_PERMISSION_MATRIX and all dental MODULE_SPEC §6 tables (F-035 closed).
- Cross-module coupling: dental-clinical → dental-visit via `VisitService` interface (G-003/F-034 closed); dental-org → dental-audit proxy note (F-019 closed); emr-consultation facade-only.

---

## Counts by Severity

| Severity | Open | Resolved-since-prior |
|----------|------|----------------------|
| HIGH | **0** | 6 (all prior HIGH confirmed still resolved) |
| MEDIUM | **5** (F-036, F-037, F-039, F-040, F-042) | 11 |
| LOW | **1** (F-043) + 5 carried-forward notes | 2 |

---

## Overall Verdict

**PASS.** No HIGH conflicts; stage-1 consistency gate is clear. The 6 open items are pure documentation/catalog lag from onboarding dental-perio + emr-consultation after the cross-cutting specs were last regenerated — no enforcement gaps, no state-machine contradictions, no permission disagreements with ROLE_PERMISSION_MATRIX. They are wave-addressable and do not gate `/oli-plan-slices`.

**Recommended batch fix (single doc-reconciliation wave):**
1. F-036 — add "Periodontal Terms" subsection to DOMAIN_GLOSSARY (defs already in perio §2).
2. F-037 — register `PerioChart` (root) + `PerioToothReading` (entity) in DOMAIN_MODEL §3.
3. F-039 — add `CHART_EXISTS`/`INVALID_DEPTH`/`INVALID_TOOTH_NUMBER` to ERROR_TAXONOMY dental-perio block.
4. F-040 — register WF-P01..P05 in WORKFLOW_MAP; bump module count 10 → 11.
5. F-042 — add `emr-consultation` (EMRC-) block with `CONSULTATION_NOT_DRAFT` to ERROR_TAXONOMY.
6. F-043 — one-line note in WORKFLOW_MAP + ROLE_PERMISSION_MATRIX that emr-consultation is a platform module on Better-Auth roles, outside the dental membership matrix.

_Stage 2 (human review / regulated sign-offs) remains DEFERRED to an interactive `/oli-spec-gate` run — unchanged from prior report._
