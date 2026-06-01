# TR-DG-002 — Phase 0 Root-Cause Findings (manual dental routes → TypeSpec codegen)

_Diagnosed 2026-06-01 on `feat/ceph-demoable-and-manual-ux`. This is the crux; the fix follows from it._

## Root cause (the exact mechanism)

TypeSpec emits an operation as an **OpenAPI path** only when that operation is reachable
from the `@service` namespace. Models/schemas emit globally regardless. The service
namespace here is `MonobaseAPI` in `specs/api/src/main.tsp`.

Working modules are wired by **re-declaring an interface inside `MonobaseAPI`** that
`extends` the module's interface, e.g.:

```tsp
@tag("Dental:Perio")
@route("/dental/perio-charts")
interface PerioChartMgmt extends DentalPerioModule.PerioChartManagement {}
```

The base `@route` and `@tag` live **only on the `MonobaseAPI` interface** — the module
namespace itself carries no `@route`/`@tag`; its operations use *relative* sub-routes
(`@route("/{chartId}")`). That is why **103 dental paths already emit** today
(org, patient, visit, clinical, pmd, scheduling, imaging, perio, billing).

The gap: some dental modules are **imported** in `main.tsp` but **never extended into
`MonobaseAPI`**, so only their models emit, not their paths. And many manual routes
have **no TypeSpec at all**.

## The three categories of manual route (`services/api-ts/src/app.ts` ~L185–570)

| Cat | Description | Routes |
|-----|-------------|--------|
| **1 — keep manual (with comment)** | Genuine shadows of generated routes: int-param coercion, append-only/immutable 405 method-guards, auth-shadow | `/dental/visits/history/:patientId/teeth/:toothNumber` (int toothNumber), `/dental/audit-events/:id` & `/dental/pmd/imported/:id` 405 guards, `/dental/org/members/:memberId/recover-pin` auth-shadow, `/dental/branches` flat-list |
| **2 — TypeSpec exists, not wired into `MonobaseAPI`** | `.tsp` present; just needs the interface re-declared + handlers placed at codegen path + manual route removed | **dental-audit** `/dental/audit-events` (GET), **dental-erasure** `/dental/erasure-requests` (×5) |
| **3 — no TypeSpec at all** | Contract must be authored from scratch | **legal-holds** (×3), **fee-schedule** (×2), patient **contacts** (×4), **recalls** (×3), **dental-alerts** (×3), **occlusion-screenings** (×2), **tasks** (×3), **postop-templates** (×3), **inventory** (×5), **treatment-plans** plural (×7), **sync-logs** (×3), **queue** (×3), **insurance-profiles** (×3), **claims** (×4) |

## Key mechanics that constrain the fix

1. **Auth role.** Dental RBAC is membership-based and enforced **in-handler**; the
   Better-Auth role is always `user`. Working dental ops therefore declare
   `@extension("x-security-required-roles", #["user"])` → codegen emits
   `authMiddleware({ roles: ["user"] })`. dental-audit's tsp currently says
   `#["dentist_owner"]` and dental-erasure's says `#["admin"]` — both must become
   `#["user"]` or codegen will reject every real request. (Anomalous namespace-level
   `@route`/`@tag` on those two tsp files must move to the `MonobaseAPI` interface.)

2. **Handler placement = codegen convention.** `generate.ts` derives the handler module
   from `tags[0].toLowerCase().replace(/:/g,'-')` and looks for
   `handlers/<module>/<operationId>.ts` exporting `<operationId>`. The stub generator
   **creates a throwing stub** for any operationId without a matching file — so real
   handlers must be placed/renamed to the exact `<operationId>.ts` path **before**
   running `generate`, or they'll be shadowed. (Erasure handlers today are
   `handlers/erasure/*Handler.ts` — must move to `handlers/dental-erasure/<operationId>.ts`.)

3. **`bun run generate` side-effects.** It also runs `npx @better-auth/cli generate`
   and `bun run db:generate`. With no DB schema changes these are no-ops, but watch for
   spurious migration files and revert them.

4. **Int-param coercion is already handled** by `generate.ts` (path + query integers →
   `z.coerce.number().int()`). The "z.number().int() rejects strings" comment in app.ts
   is largely stale; verify per-route before assuming a Category-1 keep is still needed.

## Scope reality

Full TR-DG-002 clearance = migrate **~50 manual routes across ~16 sub-modules**, ~14 of
which need TypeSpec authored from scratch (Category 3). This is large but mechanical.
Plan: **spike erasure** (Cat 2, isolated, already has tests) to prove the end-to-end
pattern, then **audit-events + legal-holds** (completes the data-governance trio that
TR-DG-002 is literally rooted in), then roll out Category 3 in small batches — each its
own commit, full verify gate, codegen run serialized (codegen regenerates global files,
so authoring can parallelize but integration cannot).

## Verify gate (per module + final)
`bun run test` (2905/0) · `bun run typecheck` · `bun run check:boundaries` (0) ·
boot-smoke migrated routes 401-not-404 · path present in `dist/openapi/openapi.json`.
Final: refresh oli map + `/oli-check --traceability` → confirm TR-DG-002 cleared.

---

## OUTCOME — ✅ CLEARED 2026-06-01

Executed the full migration on `feat/ceph-demoable-and-manual-ux` (5 commits
`fa703bc8`…`c90d007c`):

| Phase | Module(s) | Ops | Commit |
|-------|-----------|-----|--------|
| 1 spike | erasure | 5 | `fa703bc8` |
| 2a | audit-events | 1 | `b5039daf` |
| 2b | legal-hold (new tsp) | 3 | `2adb1af2` |
| 2c | contacts/recalls/alerts/tasks/treatment-plans/sync-logs/insurance/claims/occlusion/postop/inventory/fee-schedule/queue | 38 | `5befec93` |
| 2d | GET /dental/branches | 1 | `c90d007c` |

**Dental paths in `openapi.json`: 103 → 140.** 191 generated dental routes, all
in spec. 0 codegen stubs (291 handlers resolved via recursive glob — handlers were
already in the right module dirs). No migration/better-auth drift on any regen.

### The 4 new spec modules (Cat-3)
`dental-patient-engagement.tsp`, `dental-patient-finance.tsp`,
`dental-clinical-ops.tsp`, `dental-ops-extras.tsp` (+ `dental-legal-hold.tsp` for 2b).
Authored by 4 parallel subagents; integrated + codegen'd serially (codegen rewrites
global files, so authoring parallelizes but integration cannot).

### Remaining hand-mounted dental routes (8) — all unmodelable Cat-1 exceptions
- `DELETE/PUT/PATCH /dental/audit-events/:id` and `PATCH/PUT/DELETE /dental/pmd/imported/:id`
  — **405 immutability method-guards**. The resource GETs ARE codegen-routed + in spec;
  these method-shadows deliberately return 405 and have no meaningful TypeSpec form.
- `GET /dental/patients/:patientId/treatment-plans/:planId` and `.../accept` —
  **operationId-collision keeps**: their handlers re-export dental-visit's
  `getTreatmentPlan`/`acceptTreatmentPlan`, whose operationIds already emit via the
  singular `/treatment-plan` route. OpenAPI forbids duplicate operationIds, so these
  plural paths cannot be re-emitted without renaming the singular ops (out of scope).

(The tooth-history int-param shadow and recover-pin auth-shadow remain hand-mounted too,
but their paths ARE in spec via the generated routes they shadow — not divergences.)

### Final verify gate
`bun run test` 239 files **2957 pass / 0 fail** · `typecheck` clean ·
`check:boundaries` 0 · all migrated paths present in `dist/openapi/openapi.json`.
