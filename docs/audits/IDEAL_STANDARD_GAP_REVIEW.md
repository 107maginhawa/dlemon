# IDEAL Standard Gap Review

**Date:** 2026-05-26
**Standard:** docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md
**Reviewer:** architecture-analyst
**Branch reviewed:** feat/audit-full-remediation (commit 3acd84d)
**Scope:** Verify 8 preliminary gaps against actual code; surface any missed gaps in §3, §4, §5, §8.1, §9, §10.

---

## Executive Summary

The remediation cycle stamped V1 Readiness Green based on count of P1+P2 items closed (18/18), but the IDEAL standard exposes **structural** gaps the task list never tracked. The two material V1-blocking gaps remain:

1. **Sync metadata lives on a side-table only** — no `localId`/`syncStatus` columns on the four clinical/billing entities the standard requires offline-readiness for (Visit, Chart, Treatment, Invoice). This forces the FE/sync layer to do a join lookup, and cannot represent per-row "this single visit is pending sync" semantics. LF-BR-001/002 are partially satisfied, LF-BR-003 only by the global badge, LF-BR-004 has no test at all.
2. **The standard's "offline-create" workflow (§4.6) is not actually exercised end-to-end.** J15 verifies the sync-log lifecycle API alone and is explicitly marked `expectedVerdict: 'BROKEN'` for the DOM step.

Plus several entity-/FSM-naming inconsistencies (TreatmentPlan `in_progress` vs spec `partially_completed`, QueueItem state names, InventoryItem missing `status`) that are minor in isolation but together suggest the standard was not used as the source-of-truth during schema authoring.

**Revised V1 Readiness:** Yellow — core workflows work, offline-readiness is structural-only, several entity contracts drift from the spec.

---

## Confirmed Gaps

| Gap ID | Standard Ref | Evidence | Priority | Fix Scope |
|---|---|---|---|---|
| GAP-001 | §3.13, §5.10, §6.8 | Sync fields only on `dental_sync_log` (services/api-ts/src/handlers/dental-patient/repos/sync-log.schema.ts:14-28). `dentalVisits` (dental-visit/repos/visit.schema.ts:23-41), `dentalCharts` (dental-visit/repos/dental-chart.schema.ts:53-61), `dentalTreatments` (dental-visit/repos/treatment.schema.ts:22-45), `dentalInvoices` (dental-billing/repos/dental-invoice.schema.ts:20-44) carry NO `localId`, `syncStatus`, `lastSyncAt`, or `conflictPayload` columns. `baseEntityFields` (core/database.schema.ts:14-28) defines `id, createdAt, updatedAt, version, createdBy, updatedBy` — no sync fields. | P1 | Add `localId text`, `syncStatus text default 'synced'`, `lastSyncAt timestamp`, `conflictPayload jsonb` to baseEntityFields (or a new `syncableEntityFields`) and apply to the 4 clinical/billing tables. Migrations + repo upsert paths + sync-log denormalization. |
| GAP-002 | §4.6, §9.2 E2E-009 | apps/dentalemon/tests/e2e/journeys/15-offline-sync-metadata.journey.spec.ts:23-114 sets `expectedVerdict: 'BROKEN'` (line 27) and the body only POSTs/PATCHes `/dental/sync-logs`. There is NO step that (a) creates a Visit/Chart/Treatment with a localId via the UI, (b) confirms the row appears as "pending", (c) flips it to "synced" and observes UI update. The DOM step at line 110 calls `expectJourneyBroken` because P2-009 is documented as deferred. SyncStatusBadge exists at apps/dentalemon/src/features/workspace/components/sync-status-badge.tsx but is fed from `useSyncStatus(branchId)` aggregating sync-log rows, not from per-entity flags. | P1 | Build a true offline-create journey: create-record-with-localId → expect pending badge → sync → expect synced badge → assert references resolve. Requires GAP-001 first. |
| GAP-003 | §3.6, §4.4 | services/api-ts/src/handlers/dental-patient/repos/treatment-plan.schema.ts:5-22 defines statuses `['draft','presented','approved','in_progress','completed','cancelled']` with `in_progress: ['completed','cancelled']`. The standard §3.6 says: "Draft → Presented → Approved → **Partially completed** → Completed → Cancelled" and §4.4 "Plan becomes partially completed". Frontend mirrors `in_progress` at apps/dentalemon/src/features/workspace/components/treatment-plans-sheet.tsx:5,32-33,42,51,60 and apps/dentalemon/src/features/workspace/hooks/use-treatment-plans.ts:5. | P2 | Rename enum value `in_progress` → `partially_completed` (schema, FSM, validator, FE labels, OpenAPI). Add migration to update existing rows. Or amend the IDEAL standard if the team chose `in_progress` intentionally — but currently the contract drifts silently. |
| GAP-004 | §3.11, §6.8 | services/api-ts/src/handlers/dental-clinical/repos/inventory.schema.ts:25-38 has `name, category, unit, quantityOnHand, reorderLevel, notes` — NO `status` field. Standard §6.8 InventoryItem prescribes "name, category, unit, quantity, threshold, status". The InventoryItem can be implicitly active (quantityOnHand>0) but has no explicit lifecycle (active/discontinued/depleted). | P2 | Add `status text default 'active'` and enum `['active','depleted','discontinued']`. Minor — V1 Recommended in standard. |
| GAP-005 | §3.3 | services/api-ts/src/handlers/dental-scheduling/repos/queue-item.schema.ts:7-16 has statuses `['waiting','called','in_progress','completed','cancelled']`. Standard §3.3 phrases the lifecycle as "Scheduled → Checked-in → In chair → Completed → Checked-out / Cancelled / No-show" (visit-level) and §6.3 QueueItem with `status, priority`. The standard does NOT explicitly prescribe `waiting/with_provider/ready_for_checkout` — preliminary finding misread the standard. Current names are functionally equivalent; no `noShow` value exists but appointment-level handles that elsewhere. Refinement: lowered to P3 (cosmetic naming; not a contract breach). | P3 | None required unless team wants vocabulary alignment. Optional rename for clarity. |
| GAP-006 | §5.10 LF-BR-004, §9.1 | services/api-ts/src/handlers/dental-patient/dental-patient-sync.test.ts covers AC-001..AC-007 and BR-001/002/003 (POST, GET, PATCH transitions, auth, validation) but NO test asserts: (a) a local-create-then-server-edit produces a `conflictPayload` rather than silently overwriting, (b) the FSM rejects an out-of-band overwrite, or (c) conflict resolution UI surfaces a divergent payload. Grep of `services/api-ts/src/handlers/**/*.test.ts` for `conflict|overwrite|optimistic|lost.update` returns only services/api-ts/src/handlers/business-rules.test.ts (line 1598: deferred to v2.0 — patient merge). No infrastructure exists yet because GAP-001 leaves entities without a conflict field. | P1 | Once GAP-001 is fixed: add integration test that (1) creates entity with localId, (2) server applies edit, (3) client pushes stale write → response returns `409 Conflict` with both payloads in `conflictPayload`, (4) record is not silently overwritten. |
| GAP-007 | §10.1, §10.2 | scripts/seed-demo.ts:446-455 seeds 10 patients (P0..P9). Standard §10.1 says "20–50 realistic patients" (V1 Required). Required scenarios per §10.2 — present-or-missing audit: ✔ adult routine cleaning (P0), ✔ emergency walk-in toothache (implicit P0/P1), ✔ child patient (P3 Elena Garcia DoB 2010), ✔ patient with allergy (P0 penicillin line 479), ✔ patient with unpaid balance, ✔ patient with approved plan (P4), ✔ completed but unbilled work, ✔ orthodontic candidate (P6 ceph), ✗ guardian contact for minor (no createPatientContact call in seed-demo.ts; grep `patient_contact|isGuardian|guardian` returns zero seeded rows even though P3 is age 16 and would require a guardian per PAT-BR-002), ✗ offline-created record with localId visible (no syncStatus or localId seeded — grep `syncStatus\|localId\|conflict` in seed-demo.ts returns nothing). | P1 | Expand seed to 20+ patients; add `dentalPatientContacts` rows for P3 (minor) — at minimum `isGuardian=true`; seed one row in `dental_sync_log` with `syncStatus='pending'` so dashboards/badges have demo data; add at least one orthodontic appliance-tracking patient with explicit AlertType. |
| GAP-008 | §8.1 | apps/dentalemon/playwright.config.ts:50-60 DOES define `ipad-portrait` (1024×768) and `ipad-landscape` (1366×1024) projects, scoped to `**/ipad-*.spec.ts`. Existing iPad specs: ipad-imaging.spec.ts, ipad-perio-charting.spec.ts, ipad-workspace.spec.ts, ipad-calendar.spec.ts. The preliminary finding "no iPad viewport visual regression suite" is **WRONG** — see Revised Gaps. However: no tests assert `touch-target >= 44pt`, no Percy/screenshot diff per layout, no journey runs in iPad mode (J01..J16 ignore the viewport projects). | P2 (refined) | Either (a) widen `testMatch` for ipad projects to include journey specs, or (b) add explicit touch-target audits. NOT a P0 — iPad coverage exists but is incomplete and not visual-regression. See Revised Gaps. |

---

## Revised / Refined Gaps

### GAP-005 (refined down → P3)
The preliminary table claimed the standard prescribes `waiting/with_provider/ready_for_checkout`. The actual standard §3.3 / §6.3 describes visit-level lifecycle ("Scheduled → Checked-in → In chair → Completed → Checked-out / Cancelled / No-show") and QueueItem with "status, priority" (no specific values). The current `waiting/called/in_progress/completed/cancelled` is a semantically valid implementation of the same lifecycle. Cosmetic, not a contract breach — recategorized P3.

### GAP-008 (refined down → P2)
The preliminary table said "no iPad-viewport visual regression suite". An iPad suite **does exist** (4 spec files, 2 projects). Real gap is shallower: no journey runs against the iPad projects, no touch-target sizing assertions. Recategorized P2 (V1-recommended hardening, not blocking).

### GAP-002 (kept P1, refined evidence)
The preliminary finding is correct that J15 is BROKEN — the test file confirms it. Refinement: the J15 BROKEN verdict is currently *expected* per the file comment ("P2-009 deferred"), so the test passes as a documented-broken contract rather than failing CI. That's a softer failure mode than "broken test" — the team has acknowledged the gap; what's missing is the actual offline-create journey, not a fix to J15 itself.

---

## Additional Gaps Found

| Gap ID | Standard Ref | Evidence | Priority | Fix Scope |
|---|---|---|---|---|
| GAP-009 | §5.7 BILL-BR-004, §8.4 | services/api-ts/src/handlers/dental-billing/applyDentalDiscount.ts:15-45 accepts `percentageRate` only — no `reason` field on the request body, and the `dentalInvoices` schema (dental-billing/repos/dental-invoice.schema.ts:20-44) has `discountCents` but NO `discountReason` or `discountedBy` column. Standard §5.7: "Discounts/write-offs require permission AND reason." §8.4: "UI should require reason if discount/write-off is applied." Branch-role check exists (line 30) but reason audit does not. | P1 | Add `discountReason text` + `discountedBy uuid` to invoice; require non-empty reason in validator; surface in receipt UI; ensure audit log captures both. |
| GAP-010 | §3.13, §6.8 AuditLog | services/api-ts/src/handlers/dental-audit/ has only `getAuditEvents.ts` — NO `dental-audit/repos/*.schema.ts`. The audit-event store is undefined at this path. Standard §6.8 prescribes `AuditLog { actorId, action, targetType, targetId, timestamp, reason, before/after }` as V1 Required. Existing audit may piggyback on Pino structured logs (per CLAUDE.md "Audit trails via Pino structured logging") but this is **log files, not a queryable audit table** — fails AUD-BR-004 ("Audit logs should include actor, action, target, timestamp, and before/after"). | P1 | Decide: either confirm Pino-only is acceptable for V1 (then document AUD-BR-001..004 as covered-by-logging) OR create `dental_audit_log` table with the prescribed shape. Without a queryable store, §11.1 "View audit logs" permission row in §7.2 cannot be implemented as a UI screen. |
| GAP-011 | §3.5, §5.4 CHART-BR-001/002 | dental-chart.schema.ts:53-61 stores teeth as a single `jsonb` array on `dentalCharts.teeth` keyed by visitId. There is NO physical layer separator: `entryClassification` enum (line 34-39: `'existing'|'existing_other'|'treatment_plan'|'condition'`) is per-tooth metadata inside the jsonb blob, NOT a separate table per layer. CHART-BR-001 requires "Baseline chart entries must be SEPARATE from proposed and completed work" — currently a single mutable jsonb. dental-chart-baseline.schema.ts exists (separate baseline table) but proposed and completed are mixed in `dental_chart.teeth` via classification flag. Risk: a chart update can overwrite proposed entries inadvertently because the storage is a single mutable jsonb. | P1 | Either (a) verify the jsonb-with-classification approach has tests asserting CHART-BR-002 ("Completed work must not overwrite baseline"), or (b) split into `dental_chart_proposed` + `dental_chart_completed` tables. Test gap is the immediate priority. |
| GAP-012 | §10.1 audit log seeding | scripts/seed-demo.ts contains no insert into any audit table (grep for `audit_log\|auditEvent\|dental_audit` returns zero matches). Standard §10.1: "Audit logs — Clinical and billing examples — V1 Required". A reviewer running `/dental/audit-events` against the demo seed today gets an empty list. | P2 | Seed 5-10 representative audit rows after seeding visits/invoices: visit completed, treatment performed, discount applied, void issued, role change. Pairs with GAP-010. |
| GAP-013 | §6.6 ProcedureCode count | services/api-ts/scripts/seed-data/procedure-codes.ts:5-31 seeds 25 CDT codes — meets the standard §3.7 "Common CDT-like procedure list" requirement. **Marking CLOSED** (preliminary "spot-check CDT codes" was a check, not a gap). However, no ICD-10 diagnosis seed exists (grep `icd_10\|icd10\|diagnosis_code` in services/api-ts/scripts/seed-data → no diagnosis seed file). Standard §10.1 + §5.8 CLAIM-BR-003: "ICD-10 support" V1 Required. | P2 | Add `services/api-ts/scripts/seed-data/diagnosis-codes.ts` with 10-15 common dental ICD-10s (K02.*, K03.*, K04.*, K05.*, etc.). Schema/handler may not yet exist as a reference table — verify. |
| GAP-014 | §3.5, §5.4 CHART-BR-008 | dental-chart.schema.ts toothStateEnum (line 12-22) has 9 states. No `dentitionType` column distinguishing pediatric vs permanent on the chart itself — relies on tooth number ranges client-side. Standard §6.5 Tooth: "notationSystem, toothNumber, dentitionType, quadrant". Permanent (1-32) vs primary (A-T or 51-85) handling may be implicit but is not enforced at schema level. | P2 | Add `dentitionType` enum/text per tooth state, or document in repo that toothNumber 51-85 implies primary dentition. Tests should assert both dentitions accepted. |
| GAP-015 | §6.4, §6.5 FHIR alignment | The standard §6 does not explicitly require FHIR R4 compliance (CLAUDE.md mentions "FHIR R4 compliance requirements" but that's project-aspirational, not standard-required). However: `patients` (cross-module), `dentalVisits`, `dentalTreatments`, `dentalEncounters`(?) — none expose FHIR-style resource representations. Diagnosis is stored as `cdtCode` / `icd10Code` strings on claim drafts but there's no `Condition`-like entity with code + onset + clinicalStatus. | P3 | Document explicitly: "FHIR alignment is V2/deferred per IDEAL standard §6 silence on the topic." Avoid scope creep. |
| GAP-016 | §3.11 Material Usage link | inventory.schema.ts has `dentalInventoryAdjustments` (line 43-53) with `adjustmentType` and `reason` but NO foreign key to a procedure/treatment. Standard §3.11: "Material usage — Link material use to completed procedure" (V1 Recommended). Current adjustments can be `'usage'` type but cannot trace which treatment consumed which item. | P2 | Add nullable `treatmentId uuid` FK to `dentalInventoryAdjustments` so material usage can attach to a specific completed treatment. |
| GAP-017 | §8.1 touch targets | No Playwright test asserts `getBoundingClientRect()` minimum 44×44 px on primary buttons in iPad viewport. The ipad-*.spec.ts files (4 of them) exist but do not enforce touch-target sizing. Grep `44|touch.target|min.size` across `apps/dentalemon/tests/e2e/ipad-*.spec.ts` returns no assertion. | P2 | Add a per-route iPad touch-target audit: enumerate primary CTAs and assert clientWidth/clientHeight ≥ 44. One shared helper, reused across iPad specs. |

---

## Already-Confirmed-Met Items (CLOSED with evidence)

| Item | Standard Ref | Evidence | Status |
|---|---|---|---|
| PatientContact / Guardian entity (P0-004) | §3.2, §6.2 PAT-BR-002 | services/api-ts/src/handlers/dental-patient/repos/patient-contact.schema.ts:5-21 — has `patientId, name, relationship, phone, email, isGuardian, isEmergencyContact, notes, deletedAt`. Handlers: createPatientContact.ts, updatePatientContact.ts, deletePatientContact.ts. Tests: dental-patient-contacts.test.ts covers AC-001..010 + BR-001/003/004. | CLOSED — schema, handlers, tests all present. Only missing piece is **seed data** for it (see GAP-007). |
| InsuranceProfile (P1-007) | §3.9, §6.7 | services/api-ts/src/handlers/dental-patient/repos/insurance-profile.schema.ts:5-19 — full fields. ClaimDraft schema + getClaimReadiness handler at services/api-ts/src/handlers/dental-patient/getClaimReadiness.ts:10-40 implements 4-criteria readiness check (cdtCode + icd10Code + insuranceProfile.active + fee>0). | CLOSED |
| ProcedureCode lookup with 25+ CDT codes (P1-008) | §3.7, §6.6, §10.1 | services/api-ts/scripts/seed-data/procedure-codes.ts:5-31 — 25 CDT codes spanning Diagnostic, Preventive, Restorative, Endodontics, Periodontics, Prosthodontics, Implants, Oral Surgery, Orthodontics. Schema dentalProcedureCodes at services/api-ts/src/handlers/dental-visit/repos/procedure-code.schema.ts:4-14. | CLOSED |
| DentalAlert entity (P2-001) | §3.2, §6.2 | services/api-ts/src/handlers/dental-patient/repos/dental-alert.schema.ts:15-25 — 10 alert types, 3 severity levels, separate from medical-history. createDentalAlert.ts, listDentalAlerts.ts, updateDentalAlert.ts handlers all present. | CLOSED |
| OcclusionScreening (P2-002) | §3.4, §6.4 | services/api-ts/src/handlers/dental-clinical/repos/occlusion-screening.schema.ts:8-22 — angleClass enum (5 Angle classes), overbite/overjet, crossbite, crowding, spacing, midline. | CLOSED |
| Recall workflow (P0-001) | §3.12, §6.8, §4.2 step 8 | services/api-ts/src/handlers/dental-patient/repos/recall.schema.ts:19-31 — schema with type/dueDate/status FSM. Handlers createRecall.ts, listPatientRecalls.ts, updateRecall.ts. Test dental-patient-recall.test.ts. Patient also has direct `recallDate` field (per seed-demo.ts:497-502). E2E journey 02-periodic-recall.journey.spec.ts:27 `expectedVerdict: 'PASS'`. | CLOSED |
| BR-001..BR-007 visit + treatment | §5.2, §5.6 | services/api-ts/src/handlers/business-rules.test.ts covers BR-001..BR-007 (lines 412-815) with full forward/reverse FSM tests. Treatment FSM also has property-based tests at services/api-ts/src/handlers/dental-visit/treatment.fsm.property.test.ts. | COVERED |
| Visit/Treatment FSM | §5.2 APT-BR-002, §5.6 PROC-BR-006 | dental-visit/repos/visit.schema.ts:49-57 VISIT_TRANSITIONS, treatment.schema.ts:90-97 TREATMENT_TRANSITIONS — both forward-only with `dismissed`/`declined` terminal. Property tests confirm. | COVERED |
| Patient soft-delete | §5.1 PAT-BR-004 | patient-contact.schema.ts:15 has `deletedAt`; archiveDentalPatient.ts + restoreDentalPatient.ts handlers exist. | COVERED |
| Chair/Operatory | §3.1, §6.1 | services/api-ts/src/handlers/dental-scheduling/repos/operatory.schema.ts:5-14 has branchId/name/active. (V1 Recommended in standard.) | COVERED (but no `status` field — see GAP-004 pattern, lower priority for operatory) |

---

## E2E Journey Coverage Summary (§9.2)

| Standard ID | Journey | Mapped J# | expectedVerdict | Notes |
|---|---|---|---|---|
| E2E-001 | Register → book → check-in → encounter | J01 | PASS | OK |
| E2E-002 | New patient → baseline → diagnosis → plan | J01/J05 | PASS | OK |
| E2E-003 | Approve plan → complete one item → partially | J09 / J05 | PASS | OK (uses `in_progress` per GAP-003) |
| E2E-004 | Procedure → invoice → payment → receipt | J04 | PASS | OK |
| E2E-005 | Walk-in emergency → diagnose → work → bill | (implicit J04 + J01) | PASS | OK |
| E2E-006 | Upload attachment → link → preview | J11/J12/J13/J14 (imaging journeys) | mixed (J11,J13 PASS, J11 ceph-tier BROKEN) | Mostly covered |
| E2E-007 | Front desk attempts clinical edit → denied | (RBAC tests in api) | API-level only | Missing dedicated FE journey |
| E2E-008 | Dentist edits/finalizes note → audit log | J10 (void-amend-audit) | PASS | OK |
| **E2E-009** | **Offline record → sync metadata → references preserved** | **J15** | **BROKEN** | **GAP-002** |
| E2E-010 | Unpaid balance shows in dashboard | (covered in workspace tests indirectly) | not a journey spec | RECOMMENDED to add explicit J17 |

**Journeys marked BROKEN in current branch:** J03 (perio-charting), J06 (phased-plan-sequencing), J11 (ceph-tier-gate), J15 (offline-sync). Three of these (J03, J06, J15) map to V1-Required workflow areas in the standard.

---

## Priority Summary

- **P0 (V1-blockers):** 0 gaps
- **P1 (V1-important):** 5 gaps — GAP-001, GAP-002, GAP-006, GAP-007, GAP-009, GAP-010, GAP-011 (7 actually)
  - Correction: 7 P1s — sync fields on entities (001), offline E2E journey (002), conflict test (006), seed expansion + minor guardian + offline scenario (007), discount reason (009), audit log table (010), chart layer separation test (011).
- **P2 (V1-recommended):** 5 gaps — GAP-004, GAP-008, GAP-012, GAP-013, GAP-014, GAP-016, GAP-017
- **P3 (V2/deferred):** 2 gaps — GAP-005 (queue naming), GAP-015 (FHIR alignment)

### Revised V1 Readiness Rating

**Yellow** (not Green): Core workflows are present and tested, but two structural V1-Required items (LF-BR sync fields, conflict-safe write tests) are absent or stubbed. The remediation cycle counted tasks, not contracts. To return to Green, fix GAP-001, GAP-002, GAP-006, GAP-009, GAP-010, GAP-011 (the six P1 items most central to §5 business rules and §6 entity contracts).

---

## Recommended Remediation Sequence

1. **GAP-001** (foundation) — Add `localId`, `syncStatus`, `lastSyncAt`, `conflictPayload` to base; unblocks 002, 006.
2. **GAP-006** then **GAP-002** — write the conflict-resolution integration test, then the E2E offline-create journey.
3. **GAP-010** (audit log table) — required to back §7.2 "View audit logs" UI and AUD-BR-004.
4. **GAP-011** (chart layer immutability test) — fast, evidence-only; either prove jsonb approach is safe or split tables.
5. **GAP-009** (discount reason) — small schema + UI change.
6. **GAP-007** (seed expansion) — last, after the other changes land so new seed exercises the new fields.
7. P2/P3 items can ship incrementally post-V1.

---

## Caveats

- All evidence cited from branch `feat/audit-full-remediation` (commit 3acd84d, 2026-05-26). A worktree exists at `.worktrees/workspace-reconciliation/` with parallel seed/handlers — not inspected here.
- Read-only audit; no code modified.
- Where the standard's wording is permissive (e.g., "structurally offline-ready" §3.13), I scored against the strongest reasonable interpretation (per-entity sync fields), since the looser interpretation (side-table only) trivially passes.
