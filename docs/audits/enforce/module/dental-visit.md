# dental-visit — Module Enforcement
<!-- oli-enforce-module v1.0 --strict | run: run-6-strict-2026-05-29 | 2026-05-29 -->
<!-- baseline: run-5 (p0:3, p1:9, score:72) -->

## Summary

- **Run ID:** run-6-strict-2026-05-29
- **Baseline:** run-5 (p0:3, p1:9, score:72)
- **Findings:** 14 (P0: 4, P1: 6, P2: 3, P3: 1)
- **New findings:** 5 (EM-VIS-010, EM-VIS-011, EM-VIS-012, EM-VIS-013, EM-VIS-014)
- **Resolved findings:** 0
- **Compliance Score:** 62/100
- **Status:** NOT_READY

### Score Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Public API completeness | 8/10 | Sign-note path + carry-over contract divergences |
| Workflow implementation | 6/10 | WF-046 lock-job absent |
| Domain term consistency | 8/10 | `declined` extra state not in spec |
| State machine enforcement | 8/10 | Two-step treatment transition enforced; spec gap P1 |
| Event publishing | 0/10 | **P0 cap** — all 6 events never emitted |
| Auth / permissions | 6/10 | `hygienist` in write handlers, not in spec |
| BR immutability coverage | 5/10 | `upsertVisitNotes` blocks `locked` only, not `completed` |
| Spec completeness (§1–§20+§21) | 7/10 | §12 understated; §20 gaps; §21 absent |
| F2 Service-Layer / DI | 5/10 | Repos strong; 4 files bypass; visit.service.ts misplaced |

**Overall: 62/100** (P0 cap applied to event publishing dimension)

---

## Findings

| ID | Sev | Status | Description | File | Line | Spec Ref |
|----|-----|--------|-------------|------|------|---------|
| EM-VIS-001 | P0 | KNOWN | BR-001 not enforced at application level in `createDentalVisit` — no concurrent-visit check before insert; DB unique index only covers `active` status, so a second `draft` visit can be created for the same patient+branch without a 409 | `visits/createDentalVisit.ts` | 29–62 | BR-001 |
| EM-VIS-010 | P0 | **NEW** | All 6 domain events (DE-001 VisitCheckedIn, DE-002 VisitCompleted, DE-003 VisitLocked, DE-004 TreatmentDiagnosed, DE-005 TreatmentPerformed, DE-006 TreatmentDismissed) declared in §10b but never emitted — grep across entire dental-visit handler tree returns zero `emit`/`publish`/`eventBus` hits; downstream billing, audit, and PMD consumers get no events | all write handlers | — | §10b |
| EM-VIS-011 | P0 | **NEW** | WF-046 (lock completed visits via pg-boss scheduled job) has no implementation — no `dental-visit/jobs/` directory; `src/handlers/audit/jobs`, `booking/jobs`, `email/jobs`, `notifs/jobs` all have job dirs but dental-visit has none; `completed→locked` can only be triggered manually via PATCH, not by automation | `services/api-ts/src/handlers/dental-visit/` | — | WF-046, §8 |
| EM-VIS-007 | P0 | **PROMOTED** (was P2) | `upsertVisitNotes` checks only `visit.status === 'locked'` (line 34) but not `completed`; BR-003 requires all write handlers immutable after `completed`; SOAP notes can be written to completed visit — clinical data integrity violation | `notes/upsertVisitNotes.ts` | 34 | BR-003 |
| EM-VIS-002 | P1 | KNOWN | Carry-over contract divergence: API_CONTRACTS requires `source_visit_id` as required body field; implementation ignores it and auto-discovers by `patientId`; callers following the contract are silently ignored | `treatments/carryOverTreatments.ts` | 24–26 | API_CONTRACTS §POST /carry-over |
| EM-VIS-003 | P1 | KNOWN | Sign-note path contract divergence: API_CONTRACTS declares `POST /visits/:id/notes/:nid/sign` (note-scoped with `:nid`); implementation routes to `POST /visits/:visitId/notes/sign` and resolves note by `visitId` only (assumes one note per visit) | `notes/signVisitNotes.ts` | 21–51 | API_CONTRACTS §POST /notes/:nid/sign |
| EM-VIS-004 | P1 | KNOWN | Direct Drizzle calls in `utils/treatmentTemplates.ts` (4 handlers): `listTreatmentTemplates`, `createTreatmentTemplate`, `updateTreatmentTemplate`, `deleteTreatmentTemplate` call `db.select/insert/update` directly on `dentalTreatmentTemplates` — no `TreatmentTemplateRepository` exists | `utils/treatmentTemplates.ts` | 52–121 | F2 DI |
| EM-VIS-005 | P1 | KNOWN | Direct Drizzle calls in `getTreatmentPlan.ts` and `acceptTreatmentPlan.ts`: both bypass repo layer calling `db.select().from(dentalVisits/dentalTreatments/treatmentPlanVersions)` directly; `carryOverTreatments.ts` partially bypasses too (lines 53–63, 104–113) | `treatment-plans/getTreatmentPlan.ts`, `treatments/acceptTreatmentPlan.ts`, `treatments/carryOverTreatments.ts` | multiple | F2 DI |
| EM-VIS-012 | P1 | **NEW** | `declined` terminal treatment state implemented in `TREATMENT_TRANSITIONS` (diagnosed→declined, planned→declined) but absent from spec §2 Domain Terms, §5 BR-006, §7 data requirements enum, and §8 State Transitions; spec consumers unaware this state exists | `repos/treatment.schema.ts` | — | §2, §5 BR-006, §7, §8 |
| EM-VIS-013 | P1 | **NEW** | §12 Test Expectations understates actual coverage: spec lists 3 test types; handler directory has 19 test files including `visit.fsm.property.test.ts`, `treatment.fsm.property.test.ts`, `treatment-fsm-http.test.ts`, `surface-condition-map.test.ts`, `dental-visit.visit-note-persistence.test.ts`, `dental-visit.treatment-templates.test.ts`, plus 5 repo-level test files — misleading to future contributors | `docs/product/modules/dental-visit/MODULE_SPEC.md` | 157–162 | §12 |
| EM-VIS-006 | P2 | KNOWN | `hygienist` role admitted to `createDentalVisit` (line 27) and `createVisitNoteAddendum` (line 33) but MODULE_SPEC §6 permits only `dentist_owner`, `dentist_associate` for create/write operations | `visits/createDentalVisit.ts:27`, `notes/createVisitNoteAddendum.ts:33` | 27, 33 | §6 |
| EM-VIS-014 | P2 | **NEW** | §21 Service-Layer/DI section absent from MODULE_SPEC (required by F2 standard); `utils/visit.service.ts` is misplaced thin wrapper (4 functions, each `new VisitRepository(db)` inline) with no class structure, no DI, not used by most handlers | `docs/product/modules/dental-visit/MODULE_SPEC.md`, `utils/visit.service.ts` | — | F2 |
| EM-VIS-008 | P2 | KNOWN | `utils/visit.service.ts` exports bare async functions — each instantiates `new VisitRepository(db)` inline; adds no abstraction layer over direct repo usage; unused by most handlers | `utils/visit.service.ts` | 1–26 | F2 DI |
| EM-VIS-009 | P3 | KNOWN | `carryOverTreatments.ts` uses `any[]` for `restoredDismissed` (line 102) and untyped `t` in dismissed-restore loop; `DentalTreatment` type is in scope | `treatments/carryOverTreatments.ts` | 102 | style |

---

## F2: Service-Layer/DI Assessment

### What Exists

A file named `utils/visit.service.ts` exists but it is **not a class-based service** and does not establish a DI pattern:

```typescript
// utils/visit.service.ts — thin wrapper, not a service layer
export async function getVisitOrThrow(db: DatabaseInstance, visitId: string): Promise<DentalVisit>
export async function findVisits(db: DatabaseInstance, filters: VisitFilters): Promise<DentalVisit[]>
export async function findInProgressVisitByPatient(db, patientId): Promise<DentalVisit | null>
export async function createVisit(db: DatabaseInstance, data: ...): Promise<DentalVisit>
```

Each function receives `db` as a parameter and instantiates `new VisitRepository(db)` inline. This is a thin wrapper with no business rule ownership, no testable singleton, and no DI structure. Most handlers do not use it — they import `VisitRepository` directly.

### Repo Layer Pattern (Actual Reference)

The repo layer is the real structural pattern in dental-visit:

- `VisitRepository extends DatabaseRepository<...>` — class, constructor receives `db: DatabaseInstance`
- `TreatmentRepository` — same class+constructor pattern
- `VisitNotesRepository` — same class+constructor pattern
- `DentalChartRepository`, `DentalChartBaselineRepository` — same

All repos use per-request DI via `ctx.get('database')` — correct for Hono's request-scoped model. No module-level singletons needed.

### Handler Pattern (Correct)

All well-structured handlers follow this consistent pattern:

```typescript
const db = ctx.get('database') as DatabaseInstance;
const repo = new VisitRepository(db);      // per-request, repo wraps Drizzle
const result = await repo.someMethod(...);
```

Handlers with this pattern: `createDentalVisit`, `updateDentalVisit`, `createDentalTreatment`, `updateDentalTreatment`, `upsertVisitNotes`, `signVisitNotes`, `createVisitNoteAddendum`, `upsertDentalChart`, `initializeDentition`, `updateTooth`, `getDentalVisit`, `listDentalVisits`, `listDentalTreatments`, `getDentalChart`, `getVisitNotes`.

### F2 Violations (Direct Drizzle Bypassing Repos)

Three files call Drizzle directly instead of going through a repo:

| File | Direct Drizzle Calls | Missing Repo |
|------|---------------------|-------------|
| `utils/treatmentTemplates.ts` | `db.select/insert/update` on `dentalTreatmentTemplates` | `TreatmentTemplateRepository` |
| `treatment-plans/getTreatmentPlan.ts` | `db.select` on `dentalVisits`, `dentalTreatments`, `treatmentPlanVersions` | `TreatmentPlanRepository` |
| `treatments/acceptTreatmentPlan.ts` | `db.select` on `dentalVisits`, `dentalTreatments`; inline `buildLivePlan` fn | `TreatmentPlanRepository` |
| `treatments/carryOverTreatments.ts` | Partial: 2x `db.select().from(dentalVisits)` + `TreatmentRepository` | Move queries into `TreatmentRepository` |

### Is dental-visit the F2 Reference Implementation?

**No.** The module is the most complex in the codebase but `utils/visit.service.ts` is a thin wrapper without DI class structure. The `VisitRepository` / `TreatmentRepository` / `VisitNotesRepository` pattern is the strongest foundation for F2 rollout across other modules, but the template and treatment-plan handlers are **counter-examples** to avoid.

### F2 Remediation Steps

To make dental-visit the clean F2 reference:

1. Extract `TreatmentTemplateRepository` from `utils/treatmentTemplates.ts`
2. Extract `TreatmentPlanRepository` covering `getTreatmentPlan` + `acceptTreatmentPlan` queries
3. Move the two `db.select().from(dentalVisits)` queries in `carryOverTreatments.ts` into `VisitRepository.findPreviousByPatient(patientId, excludeId, limit)`
4. Delete `utils/visit.service.ts` or fold into `VisitRepository` — adds no abstraction value

---

## Strict Checks (Run-6 additions)

### visit.service.ts — Only Service-Layer File?
**Yes, but inadequate.** `utils/visit.service.ts` (at `utils/`, not module root) is the only `.service.ts`. It is a thin wrapper of 4 bare async functions, each instantiating `new VisitRepository(db)` inline. Not a class-based DI service. Not used by most handlers which import `VisitRepository` directly. See EM-VIS-008, EM-VIS-014.

### Signed Notes — Cryptographic or Simple Flag?
**Simple flag.** `signVisitNotes.ts` calls `repo.sign(note.id, user.id)` which sets `signed_at` timestamp and `signed_by` user ID. No HMAC, no hash of note content. Spec §7 specifies only `signed_at`, `signed_by` fields — implementation is conformant. **PASS.**

### Treatment Versioning Test — What It Covers
`dental-visit.treatment-plan-versioning.test.ts` (formerly `dental-visit-module6.test.ts`) covers FR J09: treatment plan accepted → immutable snapshot version created. Tests: `acceptTreatmentPlan` creates frozen version, version content immutable after creation, `getTreatmentPlanVersion` returns correct snapshot. Integration-style using real DB with `b600` namespace IDs.

### Revenue Path Regression Test — What Scenarios
`dental-visit.revenue-path-regression.test.ts` (audit artifact P0-001, fixed 2026-05-19) covers: (1) treatment always created at `diagnosed` regardless of client `status` field; (2) two-step enforcement — `diagnosed→performed` single-jump returns 422; (3) `TREATMENT_CONSENT_REQUIRED` enforced before `performed`; (4) `buildTestApp()` anti-pattern confirmed absent (real server calls used). Regression guard for revenue chain.

### WF-046 Lock Visit (pg-boss job) — Implemented?
**No.** No `dental-visit/jobs/` directory exists. `src/core/jobs.ts` is present but no dental-visit job handler registered. The `completed→locked` transition has no automated trigger — only a manual PATCH. See EM-VIS-011 (P0).

### Domain Events — All Zero Emitted
All 6 events (DE-001–DE-006) declared in §10b. Grep across entire dental-visit handler tree returns zero `emit`/`publish`/`eventBus` hits. Billing, audit, PMD consumers receive no events. See EM-VIS-010 (P0).

---

## Spec Coverage Matrix (§1–§22)

| Section | Status | Notes |
|---------|--------|-------|
| §1 Overview | PASS | In-scope/out-of-scope correct |
| §2 Domain Terms | PARTIAL | `declined` terminal treatment state in code; not defined |
| §3 Workflows | PASS | WF-007–WF-012 + WF-032–WF-047 all listed |
| §4 Workflow Details (WF-012) | PASS | Steps correct; DE-002 listed but not emitted in code |
| §5 Business Rules | PARTIAL | BR-006 missing `declined` state; BR-001 app-level gap (EM-VIS-001) |
| §6 Permissions | PARTIAL | `hygienist` in write handlers; not in spec permission matrix |
| §7 Data Requirements | PASS | All four tables with correct fields |
| §7b Aggregate Boundaries | PASS | Visit root; Treatment, SignedNote nested |
| §8 State Transitions | PARTIAL | `declined` extra treatment terminal state absent; `discarded` noted "deferred" but is implemented |
| §9 UI/UX | PASS | Workspace, chart, treatments, notes panel described |
| §10 API | PASS | CRUD endpoints listed; sign path divergence noted (EM-VIS-003) |
| §10b Domain Events | FAIL | DE-001–DE-006 declared but zero emitted in handler code |
| §11 Acceptance Criteria | PASS | AC-VIS-001–AC-VIS-005 cover core BRs |
| §12 Test Expectations | PARTIAL | Lists 3 test types; actual suite has 19 test files |
| §13 Edge Cases | PASS | Concurrent treatment update, lock-while-in-progress documented |
| §14 Dependencies | PASS | All 5 dependencies listed |
| §15 Error Handling | PARTIAL | `TREATMENT_CONSENT_REQUIRED` (added 2026-05-19) absent from table |
| §16 Performance | PASS | |
| §17 Observability | PASS | |
| §18 Feature Flags | PASS | `dental_visit_auto_discard` and `dental_visit_universal_notation` |
| §19 Vertical Slice Plan | PASS | |
| §20 AI Instructions | PARTIAL | Missing: `visit.service.ts` usage guidance; `declined` state; sign-note path divergence |
| §21 Service-Layer/DI | ABSENT | Required by F2 standard; not present |

---

## API Endpoint Coverage

| Endpoint | Implemented | Auth Guard | Immutability | Validation | Notes |
|----------|-------------|------------|--------------|------------|-------|
| POST /dental/visits | ✅ | assertBranchRole ✅ | n/a | Generated ✅ | BR-001 NOT enforced app-level (EM-VIS-001) |
| GET /dental/visits/:id | ✅ | assertBranchAccess ✅ | n/a | param ✅ | — |
| PATCH /dental/visits/:id | ✅ | assertBranchRole ✅ | ✅ locked+completed | Generated ✅ | WF-012 via status=completed |
| POST /dental/visits/:id/treatments | ✅ | assertBranchRole ✅ | ✅ completed/locked | Generated ✅ | — |
| PATCH /dental/visits/:id/treatments/:tid | ✅ | assertBranchRole ✅ | ✅ BR-006/BR-007 | Generated ✅ | — |
| POST /dental/visits/:id/chart | ✅ | assertBranchRole ✅ | n/a | Generated ✅ | — |
| GET /dental/visits/:id/chart | ✅ | assertBranchAccess ✅ | n/a | — | — |
| POST /dental/patients/:id/dentition | ✅ | assertBranchRole ✅ | n/a | Zod inline ✅ | — |
| GET /dental/visits/:id/notes | ✅ | assertBranchAccess ✅ | n/a | — | — |
| POST /dental/visits/:id/notes | ✅ | assertBranchRole ✅ | ⚠️ locked only | Generated ✅ | EM-VIS-007 |
| POST /dental/visits/:id/notes/:nid/sign | ⚠️ | assertBranchRole ✅ | ✅ | — | Path mismatch — no `:nid` (EM-VIS-003) |
| GET /dental/patients/:id/treatment-plan | ✅ | assertBranchAccess ✅ | n/a | Inline ✅ | Direct Drizzle (EM-VIS-005) |
| POST /dental/visits/:id/carry-over | ✅ | assertBranchRole ✅ | ✅ | Zod inline ✅ | Contract divergence (EM-VIS-002) |

---

## State Machine Verification

### Visit FSM

**Spec:** `draft → active → completed → locked` (+ `discarded` terminal)

**Implemented** in `repos/visit.schema.ts` (`VISIT_TRANSITIONS`):
```
draft: ['active']
active: ['completed', 'discarded']
completed: ['locked']
locked: []
discarded: []
```

`discarded` is a server-redirect: client sends `completed`, server auto-redirects to `discarded` for empty visits (BR-005 implemented despite spec labeling it "NOT IMPLEMENTED"). Transitions enforced in `updateDentalVisit` before any DB write. **Correct.**

### Treatment FSM

**Spec:** `diagnosed → planned → performed → verified; any → dismissed`

**Implemented** in `repos/treatment.schema.ts` (`TREATMENT_TRANSITIONS`):
```
diagnosed: ['planned', 'dismissed', 'declined']
planned:   ['performed', 'dismissed', 'declined']
performed: ['verified', 'dismissed']
verified:  ['dismissed']
dismissed: []   (terminal)
declined:  []   (terminal)
```

`declined` is an extra terminal state (informed patient refusal) not in the spec FSM — clinically valid, low risk. Transitions enforced in `updateDentalTreatment` via `TREATMENT_TRANSITIONS[currentStatus].includes(newStatus)` before any DB write. **Correct.** Spec gap — see EM-VIS-012.

---

## Remediation Priority

### P0 — Fix First (blocks downstream modules)
1. **EM-VIS-010**: Implement event publishing — at minimum DE-002 (VisitCompleted) and DE-003 (VisitLocked); add event bus calls in `updateDentalVisit` (completed branch) and the lock job
2. **EM-VIS-011**: Create `dental-visit/jobs/lockCompletedVisits.ts` — pg-boss scheduled job; query `status='completed' AND completed_at < now()-interval '24h'`; transition to `locked`; emit DE-003
3. **EM-VIS-007**: `upsertVisitNotes.ts` line 34 — add `|| visit.status === 'completed'` to the immutability guard
4. **EM-VIS-001**: Add `findInProgressVisitByPatient` check in `createDentalVisit` before insert; throw 409 `ACTIVE_VISIT_EXISTS`

### P1 — Fix Before v1.x Ship
5. **EM-VIS-012**: Add `declined` to spec §2, §5 BR-006, §7 enum, §8 state table
6. **EM-VIS-013**: Rewrite spec §12 to enumerate all 19 test files and their coverage
7. **EM-VIS-002**: Align carry-over contract — accept `source_visit_id` or remove from API_CONTRACTS
8. **EM-VIS-003**: Align sign-note route path — add `:nid` param to handler or update API_CONTRACTS
9. **EM-VIS-004**: Extract `TreatmentTemplateRepository` from `utils/treatmentTemplates.ts`
10. **EM-VIS-005**: Extract `TreatmentPlanRepository` (getTreatmentPlan + acceptTreatmentPlan)

### P2 — Tech Debt
11. **EM-VIS-006**: Audit `hygienist` role — align with spec §6 or update spec
12. **EM-VIS-014**: Add §21 Service-Layer/DI to MODULE_SPEC; document repo class pattern as the DI approach
13. **EM-VIS-008**: Delete or fold `utils/visit.service.ts` into `VisitRepository`

### P3 — Cosmetic
14. **EM-VIS-009**: Type `restoredDismissed` as `DentalTreatment[]` in `carryOverTreatments.ts`

---

## Notes

- `completeVisit` is not a standalone handler — WF-012 implemented via `PATCH /visits/:id` with `status=completed` in `updateDentalVisit.ts`. Correct pattern.
- `lockVisit` is not a standalone handler — spec §6 correctly assigns lock to "System (Automated)" but no pg-boss job exists (EM-VIS-011).
- F1 test-rename complete for this module: `dental-visit-module6.test.ts` → `dental-visit.treatment-plan-versioning.test.ts`. `AUDIT-P0-001-ui-revenue-path.test.ts` → `dental-visit.revenue-path-regression.test.ts` per current file tree.
- `TREATMENT_CONSENT_REQUIRED` error code (added 2026-05-19) is absent from §15 Error Handling table — minor P3 spec gap.
