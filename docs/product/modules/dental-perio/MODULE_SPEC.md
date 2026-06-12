<!--
oli: oli-module-specs v1.0 | generated: 2026-05-24 | source: docs/prd/v3-dentalemon.md + codebase
-->

# Module Spec: dental-perio

> Periodontal Charting — full perio chart with probing depths, bleeding on probing, recession, mobility, and furcation. Phase 2 (Growth) feature per PRD. Separate clinical tool from basic charting.

---

## 1. Module Overview

| Field | Value |
|-------|-------|
| Module ID | `dental-perio` |
| Domain | Clinical |
| Priority | P1 (Phase 2 Growth) |
| PRD Coverage | FR-PERIO-001 to FR-PERIO-007 |
| Depends on | `dental-visit`, `dental-patient`, `dental-org` |
| Depended on by | `dental-clinical` (cross-reference), `dental-pmd` (export) |
| Status | IMPLEMENTED (full-stack) |

**Scope:** Per-visit periodontal examination record. One chart per visit. 6-site probing depths per tooth (FDI notation). Bleeding on probing, recession, mobility, furcation per tooth. Print-layout export. Immutable after visit locked.

> **Spec-behind-impl note (2026-06-08 audit; voice/no-AI reconcile 2026-06-12):** the shipped module is wider than this v1.0 spec. Beyond the fields above it persists/derives: **per-site gingival-margin (CEJ) position** and **read-only per-site CAL** (probing depth + gingival margin, never stored — P1-5); **2017 AAP/EFP staging/grading/extent** computed on completion **and persisted on the chart row** (frozen-at-completion, 2026-06-11; `utils/perio-staging.ts` + `utils/perio-classify-chart.ts` — P1-6); and a **multi-exam longitudinal comparison** endpoint `GET /dental/perio-charts?patientId=` (`listPerioChartsForPatient`) surfaced in the comparison overlay. Automated **staging/grading classification** is a **deterministic rule engine** (no AI/ML model) and is shipped.
>
> **Manual entry is the supported input.** The default and only supported V1 charting input is the **192-step keyboard auto-advance grid**. A **voice charting** capability exists in the codebase (`apps/dentalemon/.../components/perio/voice/`, `use-voice-perio.ts`, mounted in `perio-chart-overlay.tsx`) but is gated behind the **`perio.voice_charting` feature flag (default OFF** — `apps/dentalemon/src/lib/feature-flags.ts`) plus browser speech-capability detection, pending an off-device-audio / PHI compliance review. It uses the browser Web Speech API (generally cloud-backed → outside the offline-first guarantee), so it is an **experimental, opt-in enhancement, not a committed V1 workflow**. This reconciles the earlier "built and shipped" wording (over-claim) with `docs/clinical/STANDARDS_COMPLIANCE.md` (per product decision #2: hold no-AI, perio stays manual entry).

**Out of scope (genuine non-goals):** AI-assisted progression tracking / AI auto-classification (product is local-first, no-AI); **AI/cloud transcription** and **voice charting as a default workflow** (the `perio.voice_charting` flag stays default-OFF until a compliance review clears it — do **not** expand voice features meanwhile).

---

## 2. Domain Terms

| Term | Definition |
|------|-----------|
| **Perio Chart** | Per-visit periodontal examination record. One chart per visit, immutable after visit locked. |
| **Probing Depth** | Measurement in mm from gingival margin to base of periodontal pocket, per site. Normal: ≤3 mm. |
| **BOP** | Bleeding on Probing — boolean per site, recorded within 30s of probe withdrawal. |
| **Recession** | Gingival recession in mm — distance from CEJ (cement-enamel junction) to gingival margin. |
| **Mobility** | Tooth mobility grade: 0 (none), 1 (≤1 mm horizontal), 2 (>1 mm horizontal), 3 (vertical). |
| **Furcation** | Furcation involvement for multi-rooted teeth: 0 (none), F1 (≤3 mm), F2 (>3 mm), F3 (through-and-through). |
| **Probing Site** | One of 6 per tooth: buccal-mesial (BM), buccal-center (BC), buccal-distal (BD), lingual-mesial (LM), lingual-center (LC), lingual-distal (LD). |
| **CEJ** | Cement-Enamel Junction — anatomical landmark used to measure recession. |
| **PSR** | Periodontal Screening and Recording — sextant-based screening (not a full chart; future feature). |
| **Perio Staging** | AAP 2017 Classification: Stage I–IV (severity). Out of scope — P3. |

---

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-P01 | Dentist | Create perio chart for a visit | P1 |
| WF-P02 | Dentist | Record tooth-level readings (probing, BOP, recession, mobility, furcation) | P1 |
| WF-P03 | Dentist | Complete / lock perio chart | P1 |
| WF-P04 | Dentist, Staff Full | View perio chart (historical) | P1 |
| WF-P05 | Dentist, Staff Full | Print perio chart (PDF export) | **V2 DEFERRED** (not built) |

---

## 4. Workflow Details

### WF-P01 — Create Perio Chart
1. Dentist opens visit workspace → "Perio" tab. If no chart exists, shows "Start Perio Exam" button.
2. Click creates a `dental_perio_chart` record in `draft` state linked to visitId + patientId + branchId.
3. BR-P01 enforced: only one chart per visit — server returns 409 if chart already exists.
4. Chart grid renders all 32 (adult) or 20 (primary) teeth slots, all readings blank.
5. Audit event: `perio.chart.created`.

### WF-P02 — Record Tooth Readings
1. Dentist clicks tooth in chart grid → reads input panel for that tooth slides in.
2. Inputs: 6 probing depths (mm integers 0–20), 6 BOP booleans, recession (mm, optional), mobility (0–3), furcation (F0–F3), plaque (boolean), suppuration (boolean), notes (text, optional).
3. On save (auto-save on input blur): upsert `dental_perio_tooth_reading` record for that tooth.
4. Grid cell updates color coding: ≤3 mm = green, 4–5 mm = amber, ≥6 mm = red. BOP sites shown as red dots.
5. Progress indicator: X/32 teeth recorded.

### WF-P03 — Complete Perio Chart
1. Dentist clicks "Complete Exam" when all critical teeth recorded (soft minimum — 16/32 required).
2. Server transitions chart `draft → completed`. Summary stats computed: mean probing depth, BOP%, teeth with furcation involvement.
3. Completed chart becomes read-only. Amendment path via dental-clinical WF-038 pattern (addendum note, not record edit).
4. Chart locked automatically when parent visit is locked (visit lifecycle BR-003).
5. Audit event: `perio.chart.completed` with summary stats.

### WF-P04 — View Historical Perio Chart
1. Patient workspace → "Perio History" panel → list of charts by date.
2. Each chart shows: date, examiner, completion status, BOP%, mean depth, teeth with deep pockets (≥6 mm).
3. Click opens read-only chart view. Side-by-side comparison with previous chart available (P2 feature flag).
4. No edit capability for completed/locked charts.

### WF-P05 — Print Perio Chart  ⚠️ **V2 DEFERRED — not implemented**
> No server-side PDF render, no `@media print` route, and no Print button exist in the shipped module (verified 2026-06-12). The steps below describe the future design target; `docs/clinical/STANDARDS_COMPLIANCE.md` lists PDF export under the deferred non-AI backlog (deferred wins). Do not represent this as available until built.

1. Dentist or Staff Full clicks "Print" from any perio chart view.
2. Server renders PDF with: patient header (name, DOB, examiner, date), full 6-site grid (all 32 teeth), BOP color map, summary stats, recession/mobility/furcation columns, notes.
3. PDF generated server-side (html-to-pdf) or client-side print CSS (`@media print`).
4. Download triggered; filename: `perio-{patientId}-{date}.pdf`.

---

## 5. Business Rules

| Rule ID | Rule | Expected Behavior |
|---------|------|-------------------|
| BR-P01 | One perio chart per visit | 409 CHART_EXISTS if chart already exists for visitId |
| BR-P02 | Chart immutable after visit locked | 422 VISIT_LOCKED on any write to chart for locked visit |
| BR-P03 | Probing depths 0–20 mm per site | 422 INVALID_DEPTH if out of range |
| BR-P04 | FDI tooth numbers must fall in a valid quadrant range — adult: 11–18, 21–28, 31–38, 41–48; primary: 51–55, 61–65, 71–75, 81–85 (the cross-quadrant gaps, e.g. 19, 29, 49, 56, are invalid) | 422 INVALID_TOOTH_NUMBER |
| BR-P05 | Chart create/readings/complete require a clinical role | 403 FORBIDDEN if not dentist_owner, dentist_associate, or hygienist |
| BR-P06 | Tooth reading upsert: one record per (chartId, toothNumber) | Server upsert — no 409 on duplicate; idempotent |
| BR-P07 | Completed chart: minimum 16/32 teeth recorded (soft) | 422 INSUFFICIENT_READINGS if < 16 readings on completion attempt |

---

## 6. Permissions

| Action | dentist_owner | dentist_associate | hygienist | staff_full | staff_scheduling |
|--------|:---:|:---:|:---:|:---:|:---:|
| Create chart | ✅ | ✅ | ✅ | ❌ | ❌ |
| Record readings | ✅ | ✅ | ✅ | ❌ | ❌ |
| Complete chart | ✅ | ✅ | ✅ | ❌ | ❌ |
| View chart | ✅ | ✅ | ✅ | ✅ | ❌ |
| Print chart | ✅ | ✅ | ✅ | ✅ | ❌ |

> Hygienists perform periodontal charting clinically and are granted write+read access here (consistent with ROLE_PERMISSION_MATRIX and the handler `assertBranchRole` allowlists). `staff_scheduling` is excluded from all perio access — perio data is clinical PHI (EF-PER-002).

---

## 7. Data Requirements (key fields)

### PerioChart
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| visitId | UUID FK | → dental_visits.id (CASCADE) |
| patientId | UUID FK | → dental_patients.id |
| branchId | UUID FK | → dental_branches.id |
| examinerMemberId | UUID FK | → dental_memberships.id |
| status | enum | draft \| completed \| locked |
| completedAt | timestamp? | Set on WF-P03 |
| notes | text? | Exam-level notes |
| summaryBopPercent | decimal? | Computed on completion |
| summaryMeanDepth | decimal? | Computed on completion |
| summaryDeepPocketCount | int? | Teeth with max depth ≥6 mm |

### PerioToothReading
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| chartId | UUID FK | → dental_perio_charts.id (CASCADE) |
| toothNumber | int | FDI notation |
| depthBM, depthBC, depthBD | smallint | Buccal probing depths (mm) |
| depthLM, depthLC, depthLD | smallint | Lingual probing depths (mm) |
| bopBM, bopBC, bopBD | boolean | Buccal BOP |
| bopLM, bopLC, bopLD | boolean | Lingual BOP |
| recession | smallint? | mm, overall per tooth |
| mobility | smallint | 0–3 |
| furcation | smallint | 0–3 (F0–F3) |
| plaque | boolean | default false |
| suppuration | boolean | default false |
| notes | text? | Per-tooth note |

---

## 7b. Aggregate Boundaries

- `PerioChart` is the aggregate root. `PerioToothReading` records are children of the chart.
- Chart belongs to a Visit — no FK joins to other module tables (loose coupling via UUID refs).
- Cross-references: `examinerMemberId` refs dental-org membership (UUID only, no JOIN in handler).
- **Source of truth — recession / gingival margin (decision C-3, 2026-06-12):** the perio chart (`PerioToothReading` per-site gingival-margin / `recession`) is the **authoritative system record** for periodontal recession and gingival-margin (CEJ) measurements. Other modules (e.g. dental-clinical charting) reference these values; they do not maintain a competing recession store.

---

## 8. State Transitions

### Perio Chart States
```
draft ──► completed ──► locked
               └──── (auto-locked when parent visit locked)
```
- `draft`: readings in progress, editable
- `completed`: exam done, read-only, summary computed
- `locked`: parent visit locked — no changes possible

---

## 9. UI/UX Requirements

> **Implementation status (corrected 2026-06-08 audit): full-stack SHIPPED.** The earlier "V-PER-011 backend-only — frontend DEFERRED" note is **stale**. The perio chart-grid UI **is** implemented in `apps/dentalemon/src/features/workspace/components/perio/` (chart grid, tooth columns, per-site cells, BOP dots, CAL cells, live summary bar, classification panel, multi-exam comparison) with hooks (`use-perio-chart.ts`, `use-perio-history.ts`), voice charting (`voice/`, `use-voice-perio.ts`), and E2E journeys (`tests/e2e/journeys/03-perio-charting.journey.spec.ts`, plus `ipad-perio-charting`/`perio-voice-charting` specs). The requirements below describe the shipped UI design target.

- **Chart grid**: 2 rows (maxillary / mandibular), teeth ordered FDI left-to-right per arch. Each cell shows: tooth number, max probing depth, BOP dot count.
- **Color coding**: ≤3 mm = green background, 4–5 mm = amber, ≥6 mm = red.
- **Input panel**: slides in on tooth click. Numeric inputs for depths (mobile-friendly: numeric keyboard). Toggle buttons for BOP sites.
- **Progress ring**: shows X/32 teeth recorded.
- **Print layout**: follows standard dental perio chart format. `@media print` CSS hides nav/header.
- **Apple HIG**: SF Pro font, `#F2F2F7` surface, `#FFE97D` lemon for BOP positive indicators.

---

## 10. API Expectations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /dental/perio-charts | dentist | Create chart (WF-P01) |
| GET | /dental/perio-charts/:id | all dental | Get chart + readings |
| GET | /dental/visits/:visitId/perio-chart | all dental | Get chart for visit |
| PUT | /dental/perio-charts/:chartId/readings/:toothNumber | dentist | Upsert tooth reading (WF-P02) |
| POST | /dental/perio-charts/:id/complete | dentist | Complete chart (WF-P03) |

---

## 10b. Domain Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `perio.chart.created` | WF-P01 | chartId, visitId, patientId, examinerMemberId |
| `perio.chart.completed` | WF-P03 | chartId, summaryStats |
| `perio.chart.locked` | Visit lock cascade | chartId, visitId |

Per ADR-006 (domain-events-descope), domain events here are audit-log-only semantic markers — there is NO event bus. Producers satisfy them by writing the corresponding dental_audit_log row synchronously via logAuditEvent(); reactive consumers (e.g. notifs) are deferred to a future phase. No publisher/emit scaffolding is required.

---

## 11. Acceptance Criteria

- [ ] AC-P01: POST /dental/perio-charts creates chart linked to visit, returns 201
- [ ] AC-P02: Duplicate chart creation for same visit returns 409
- [ ] AC-P03: PUT readings upserts per-tooth data, returns 200
- [ ] AC-P04: Probing depth out of range [0, 20] returns 422
- [ ] AC-P05: Invalid FDI tooth number returns 422
- [ ] AC-P06: POST complete with < 16 readings returns 422
- [ ] AC-P07: POST complete with ≥ 16 readings returns 200, chart status = completed
- [ ] AC-P08: Any write to chart when visit is locked returns 422
- [ ] AC-P09: Staff_scheduling cannot create chart — 403
- [ ] AC-P10: GET chart returns readings array grouped by tooth

---

## 12. Test Expectations

- Unit tests: PerioChartRepo (CRUD), PerioReadingRepo (upsert), handler tests for all 5 endpoints
- BR tests: BR-P01 (409 duplicate), BR-P02 (422 locked), BR-P03 (422 depth range), BR-P05 (403 role), BR-P07 (422 insufficient readings)
- Contract tests: Hurl scenarios for all 5 endpoints (happy path + error paths)

---

## 13. Edge Cases

| Edge Case | Handling |
|-----------|---------|
| Primary dentition (tooth 51-85) | Accepted; 20 teeth, min 8/20 for completion |
| Tooth missing (extracted) | Reading with `missing: true` flag skips validation |
| Partial reading upsert | Accepts partial site data — only provided sites stored |
| Visit locked mid-exam | Next upsert returns 422; completed readings preserved |
| Duplicate chart via race condition | UNIQUE constraint on (visitId) → 409 |

---

## 14. Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| dental-visit | Runtime | visitId FK, status check for locking |
| dental-patient | Runtime | patientId for patient context |
| dental-org | Runtime | branchId + examinerMemberId via assertBranchRole |
| dental-pmd | Downstream | PMD export includes perio chart data (P2) |

---

## 15. Error Handling

| Error Code | HTTP | Trigger |
|-----------|------|---------|
| CHART_EXISTS | 409 | Second chart for same visitId |
| VISIT_LOCKED | 422 | Write attempt on locked visit |
| INVALID_DEPTH | 422 | Probing depth < 0 or > 20 |
| INVALID_TOOTH_NUMBER | 422 | FDI tooth number not in valid set |
| INSUFFICIENT_READINGS | 422 | < 16 readings on completion |
| FORBIDDEN | 403 | Non-dentist create/complete attempt |

---

## 16. Performance Expectations

- GET chart with 32 readings: < 50 ms P95
- PUT tooth reading: < 30 ms P95 (simple upsert)
- POST complete: < 100 ms P95 (includes summary computation)
- Chart grid renders 32 teeth: < 16 ms (client-side, requestAnimationFrame budget)

---

## 17. Observability Hooks

- `perio.chart.created` → structured log + audit event
- `perio.chart.completed` → structured log with summary stats
- Slow probe writes (> 100 ms) → warn log

---

## 18. Feature Flags

| Flag | Default | Controls |
|------|---------|---------|
| `perio.voice_charting` | **false** | Voice / hands-free perio charting (`apps/dentalemon/src/lib/feature-flags.ts`). Default-OFF behind an off-device-audio / PHI compliance review + browser speech-capability detection. Override at build time via `VITE_FF_PERIO_VOICE_CHARTING=true`. Experimental — not a committed V1 surface (see §1 reconcile note). |

> **§18 reconcile (2026-06-12):** the only real perio feature flag is `perio.voice_charting`. The previously-listed `perio.side_by_side_comparison` and `perio.auto_staging` flags were **never wired** — multi-exam comparison and AAP/EFP staging both **shipped unconditionally** (no flag), so those rows were removed to match `feature-flags.ts`.

---

## 19. Vertical Slice Plan

| Step | Artifact | Status |
|------|----------|--------|
| 1 | TypeSpec (`dental-perio.tsp`) | ✅ |
| 2 | Codegen (openapi + ts types) | ✅ |
| 3 | Backend tests RED | ✅ |
| 4 | Backend impl GREEN | ✅ (`handlers/dental-perio/`, 103 tests) |
| 5 | Contract tests (Hurl) | ✅ (`specs/api/tests/contract/dental-perio.hurl`) |
| 6 | UI prototype | ✅ (`apps/dentalemon/.../components/perio/`) |
| 7 | E2E verify | ✅ (`tests/e2e/journeys/03-perio-charting.journey.spec.ts`) |
