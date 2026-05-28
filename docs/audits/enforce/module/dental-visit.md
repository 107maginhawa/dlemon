# dental-visit — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary
- Findings: 9 (P0: 1, P1: 4, P2: 3, P3: 1)
- Service-Layer Pattern: PARTIAL (utility functions in `utils/visit.service.ts`; not a class-based DI service; NOT the F2 reference implementation)
- Compliance Score: 72/100

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|---------|
| EM-VIS-001 | P0 | BR-001 not enforced at application level in `createDentalVisit` — no concurrent-visit check before insert; DB unique index only covers `active` status, so a second `draft` visit can be created for the same patient+branch without a 409 | `visits/createDentalVisit.ts` | 29–62 | BR-001 |
| EM-VIS-002 | P1 | Carry-over contract divergence: API_CONTRACTS requires `source_visit_id` as a required body field; implementation ignores it entirely and auto-discovers previous visits by `patientId`; callers following the contract will be silently ignored | `treatments/carryOverTreatments.ts` | 24–26 | API_CONTRACTS §POST /carry-over |
| EM-VIS-003 | P1 | Sign-note path contract divergence: API_CONTRACTS declares `POST /visits/:id/notes/:nid/sign` (note-scoped with `:nid`); implementation routes to `POST /visits/:visitId/notes/sign` and resolves note by `visitId` only (assumes one note per visit) | `notes/signVisitNotes.ts` | 21–51 | API_CONTRACTS §POST /notes/:nid/sign |
| EM-VIS-004 | P1 | Direct Drizzle calls in `utils/treatmentTemplates.ts` (4 handlers): `listTreatmentTemplates`, `createTreatmentTemplate`, `updateTreatmentTemplate`, `deleteTreatmentTemplate` call `db.select/insert/update` directly on `dentalTreatmentTemplates` — no `TreatmentTemplateRepository` exists | `utils/treatmentTemplates.ts` | 52–121 | F2 DI |
| EM-VIS-005 | P1 | Direct Drizzle calls in `getTreatmentPlan.ts` and `acceptTreatmentPlan.ts`: both bypass repo layer, calling `db.select().from(dentalVisits/dentalTreatments/treatmentPlanVersions)` directly in handler body; `carryOverTreatments.ts` partially bypasses too (lines 53–63, 104–113) | `treatment-plans/getTreatmentPlan.ts`, `treatments/acceptTreatmentPlan.ts`, `treatments/carryOverTreatments.ts` | multiple | F2 DI |
| EM-VIS-006 | P2 | `hygienist` role admitted to `createDentalVisit` (line 27) and `createVisitNoteAddendum` (line 33) but MODULE_SPEC §6 permits only `dentist_owner`, `dentist_associate` for create/write operations; `hygienist` not in spec permission matrix | `visits/createDentalVisit.ts:27`, `notes/createVisitNoteAddendum.ts:33` | 27, 33 | MODULE_SPEC §6 |
| EM-VIS-007 | P2 | `upsertVisitNotes` only blocks `locked` status (line 34), not `completed`; BR-003 requires all write handlers to be immutable after `completed` — SOAP notes can currently be written to a completed visit | `notes/upsertVisitNotes.ts` | 34 | BR-003 |
| EM-VIS-008 | P2 | `utils/visit.service.ts` exports bare async functions that each `new VisitRepository(db)` inline — pattern is inconsistent with the class-based repo pattern and adds no abstraction layer; unused by most handlers which import `VisitRepository` directly | `utils/visit.service.ts` | 1–26 | F2 DI |
| EM-VIS-009 | P3 | `carryOverTreatments.ts` uses `any[]` for `restoredDismissed` (line 102) and untyped `t` in the dismissed-restore loop; `DentalTreatment` type is available in scope | `treatments/carryOverTreatments.ts` | 102 | style |

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

## Spec Coverage Matrix

| Endpoint | Implemented | Auth Guard | Immutability | Validation | Notes |
|----------|-------------|------------|--------------|------------|-------|
| POST /dental/visits | ✅ | assertBranchRole ✅ | n/a | Generated validators ✅ | BR-001 NOT enforced (EM-VIS-001) |
| GET /dental/visits/:id | ✅ | assertBranchAccess ✅ | n/a | param ✅ | — |
| PATCH /dental/visits/:id | ✅ | assertBranchRole ✅ | ✅ locked+completed | Generated validators ✅ | — |
| POST /dental/visits/:id/treatments | ✅ | assertBranchRole ✅ | ✅ completed/locked blocked | Generated validators ✅ | — |
| PATCH /dental/visits/:id/treatments/:tid | ✅ | assertBranchRole ✅ | ✅ BR-006/BR-007 enforced | Generated validators ✅ | — |
| POST /dental/visits/:id/chart | ✅ | assertBranchRole ✅ | n/a | Generated validators ✅ | — |
| GET /dental/visits/:id/chart | ✅ | assertBranchAccess ✅ | n/a | — | — |
| POST /dental/patients/:patientId/dentition | ✅ | assertBranchRole ✅ | n/a | Zod inline ✅ | — |
| GET /dental/visits/:id/notes | ✅ | assertBranchAccess ✅ | n/a | — | Returns history array too |
| POST /dental/visits/:id/notes | ✅ | assertBranchRole ✅ | ⚠️ locked only (EM-VIS-007) | Generated validators ✅ | — |
| POST /dental/visits/:id/notes/:nid/sign | ⚠️ Partial | assertBranchRole ✅ | ✅ | — | Path mismatch: no `:nid` param (EM-VIS-003) |
| GET /dental/patients/:id/treatment-plan | ✅ | assertBranchAccess ✅ | n/a | Inline ✅ | Direct Drizzle (EM-VIS-005) |
| POST /dental/visits/:id/carry-over | ✅ | assertBranchRole ✅ | ✅ completed/locked blocked | Zod inline ✅ | Contract divergence (EM-VIS-002) |

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

`declined` is an extra terminal state (informed patient refusal) not in the spec FSM — clinically valid, low risk. Transitions enforced in `updateDentalTreatment` via `TREATMENT_TRANSITIONS[currentStatus].includes(newStatus)` before any DB write. **Correct.**
