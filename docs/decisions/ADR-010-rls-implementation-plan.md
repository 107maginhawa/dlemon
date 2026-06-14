# RLS Implementation Scoping Plan — `services/api-ts` (ADR-010 Pre-GA Gate)

> **Status: IN PROGRESS — P0 + P1a shipped.** Companion to
> [ADR-010](./ADR-010-tenant-isolation-rls-pre-ga.md). Recorded **2026-06-14** as the
> implementation scoping for the ADR-010 pre-GA Row-Level-Security gate; the build
> started the same day. Evidence paths are cited inline.
>
> **Build progress:**
> - **P0 — DONE** (migration `0104_rls_p0_foundation`, `src/core/tenant-tx.ts`): the
>   `app_rls` role, the `app_current_branches()` helper, the `withTenantTx` helper, and
>   the `dental_visit` pilot policy + Stage-0 validation.
> - **P1a — DONE** (migration `0105_rls_p1a_tier1`, `src/tests/rls/tier1.rls-isolation.test.ts`):
>   ENABLE+FORCE RLS + set-valued policies on the remaining Tier-1 direct-tenant-column
>   tables, plus the `app_current_orgs()` helper, with a per-table isolation matrix. **DB
>   posture only — zero runtime change** (the app still connects as postgres and bypasses).
> - **P1b — next**: route the Tier-1 handlers' DB access through `withTenantTx` so the
>   second wall becomes live on the request path.
>
> **⚠️ LOCKED DESIGN — supersedes the connect-as-`app_rls` sketch below (§3/§4/§7-P1, D4).**
> The app **keeps its `postgres` connection**; RLS is entered per-request via
> **`SET LOCAL ROLE app_rls` inside `withTenantTx`** (transaction-local, reverts on commit),
> *not* by switching the connection string. Consequences: no `app_rls` login credential to
> manage (the role is `NOLOGIN`); the admin / deliberately-cross-tenant paths (erasure queue,
> audit list) simply **do not call `withTenantTx`** and so keep the superuser bypass — no
> separate `BYPASSRLS` handle is required for them. Where the older prose below says "switch
> the app server connection to `app_rls`" or "`LOGIN` role", read "`SET LOCAL ROLE app_rls`
> via `withTenantTx`". The tenant keys are **set-valued** (`app.current_branches`,
> `app.current_orgs`; D1 resolved).

## 1. Objective & Non-Goals

**Objective.** Add PostgreSQL Row-Level Security as a *second wall* behind the existing application-layer tenant isolation, so that a single missing or wrong app-level `branchId` filter (the EM-BIL-002 leak class) cannot expose cross-tenant PHI. RLS policies are keyed off a per-request tenant context set via `SET LOCAL` inside a transaction, on the top-PHI tables ADR-010 names plus their dependent PHI tables.

**Explicit non-goals (this gate does NOT change them):**
- **App-level filters stay.** Every handler keeps `assertBranchRole`/`assertBranchAccess` (`services/api-ts/src/handlers/shared/assert-branch-access.ts`) and the mandatory-`branchId` query convention. RLS is additive; the existing cross-tenant negative tests must still pass *unchanged* (they assert `403`/`400` at the handler, which fires before the query).
- **No tenant-model remodeling of upstream-template modules.** The 9 base monobase modules (`invoice`, `booking`, `comms`, `notification`, `review`, `stored_file`, `consultation_note`, `audit_log_entry`) are person/owner-scoped and have no branch/org column. They are **out of scope** for this branch-keyed gate (see §2). Remodeling them is separate, later work.
- **No change to the embedded/offline path.** `services/api-ts-embedded` runs the same handlers against SQLite via `sqlite-proxy` (`database.ts:62-74`, `:107-116`), which has no RLS. The session-var plumbing must **no-op safely** on the SQLite dialect; tenant isolation there remains app-layer only and is explicitly out of scope for this gate.
- **No behavior change on happy paths.** RLS, when wired correctly, is invisible to in-tenant requests.

---

## 2. Target Table Set

Tenancy is rooted `dental_organization → dental_branch → dental_membership`, and the dominant tenant column is **`branch_id`** (FK to `dental_branch`), not `organization_id`. The session var design (§4) follows from that: **`app.current_branches`** (the set of the caller's in-scope branch UUIDs) is the primary key; `app.current_org` is secondary for the few org-level tables.

### Tier 1 — Direct tenant-column tables (simple `USING` policy)

These carry `branch_id` (or `organization_id`) directly; policy is a scalar membership test. **Lowest effort, do first.**

| Table | Tenant column | Evidence |
|---|---|---|
| `dental_visit` | `branch_id` | `visit.schema.ts:35` |
| `dental_invoice` | `branch_id` | `dental-invoice.schema.ts:26` |
| `dental_payment` | `branch_id` | `dental-payment.schema.ts:23` |
| `dental_payer_payment` | `branch_id` | `dental-payer-payment.schema.ts:24` |
| `dental_insurance_claim` | `branch_id` | `dental-insurance-claim.schema.ts:67` |
| `dental_perio_chart` | `branch_id` | `perio-chart.schema.ts:23` |
| `dental_appointment` | `branch_id` | `dental-appointment.schema.ts:31` |
| `dental_appointment_hold` | `branch_id` | (findings) |
| `dental_queue_item` | `branch_id` | (findings) |
| `dental_waitlist_entry` | `branch_id` | (findings) |
| `dental_operatory` | `branch_id` | (findings) |
| `dental_household` | `branch_id` | (findings) |
| `dental_coverage_authorization` | `branch_id` | (findings) |
| `imaging_study` | `branch_id` | `imaging.schema.ts:81` |
| `imaging_finding` | `branch_id` (FK-less UUID) | `imaging_finding.schema.ts:80` |
| `dental_inventory_item` | `branch_id` | (findings) |
| `dental_consent_template` | `branch_id` | (findings) |
| `dental_treatment_template` | `branch_id` | (findings) |
| `dental_postop_template` | `branch_id` | (findings) |
| `dental_audit_log` | `branch_id` | (findings) |
| `dental_feature_permission` | `organization_id` | `feature-permission.schema.ts:16` |

**ADR-010 named subset present here:** `dental_visit`. ✅

### Tier 2 — Indirect-tenancy PHI tables (EXISTS-subquery policy)

These have **no `branch_id`**; tenancy is derived via a join. Two sub-shapes, two policy approaches:

**Tier 2a — visit-anchored (preferred: derive via `dental_visit.branch_id`).** A single, reliable FK join. ADR-010 names `dental_chart` and `dental_treatment` here.

| Table | Anchor column | Evidence |
|---|---|---|
| `dental_chart` | `visit_id → dental_visit.branch_id` | `dental-chart.schema.ts:72-73` |
| `dental_treatment` | `visit_id` | `treatment.schema.ts:64-65` |
| `dental_finding` | `visit_id` | `dental-finding.schema.ts:39-40` |
| `prescription` | `visit_id` | `prescription.schema.ts:36-37` |
| `consent_form` | `visit_id` | `consent-form.schema.ts:13-14` |
| `consent_refusal` | `visit_id` | `consent-refusal` (findings) |
| `amendment` | `visit_id` | `amendment.schema.ts:13-14` |
| `lab_order` | `visit_id` | `lab-order.schema.ts:22-23` |
| `dental_attachment` | `visit_id` | `attachment.schema.ts:20-21` |

Policy: `USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = visit_id AND v.branch_id = ANY (current_branches())))`.

**ADR-010 named subset here:** `dental_chart`, `dental_treatment`, and the prescription/clinical tables (`prescription`, `consent_form`, `amendment`, `lab_order`). ✅

**Tier 2b — patient-anchored (derive via `patient.preferred_branch_id`).** *Blocked on Decision D2 (§8)* — `patient` itself has no hard tenant column, only nullable, FK-less `preferred_branch_id` (`patient.schema.ts:29`).

| Table | Anchor | Evidence |
|---|---|---|
| `patient` (the ADR-010 headline table) | `preferred_branch_id` (nullable) | `patient.schema.ts:29` |
| `medical_history_entry`, `medical_history_review` | `patient_id` | `medical-history.schema.ts:22` |
| `dental_alert` | `patient_id` | `dental-alert.schema.ts:17` |
| `dental_recall` | `patient_id` | `recall.schema.ts:21` |
| `dental_task` | `patient_id` | `task.schema.ts:21` |
| `dental_patient_contact` | `patient_id` | (findings) |
| `dental_insurance_profile` | `patient_id` | `insurance-profile.schema.ts:17` |
| `dental_claim_draft` | `patient_id` | (findings) |
| `dental_case_presentation` | `patient_id` | (findings) |
| `dental_treatment_plan`, `treatment_plan_version` | `patient_id` | `treatment-plan.schema.ts:81` |
| `dental_patient_chart_baseline` | `patient_id` | `dental-chart-baseline.schema.ts:17` |
| `dental_occlusion_screening` | `patient_id` | `occlusion-screening.schema.ts:10` |

The patient policy depends on D2. Two options, both feasible:
- **D2-A (recommended): backfill a NOT NULL `branch_id` (or `organization_id`) onto `patient`.** Then `patient` becomes Tier 1, and every `patient_id`-only table policies cleanly via `EXISTS (SELECT 1 FROM patient p WHERE p.id = patient_id AND p.branch_id = ANY (current_branches()))`. This is a *prerequisite migration with a backfill*, not a quick add — but it makes ~13 tables tractable at once and removes the nullable-tenant ambiguity.
- **D2-B: policy `patient` directly on `preferred_branch_id`** with explicit NULL handling. Branchless patient rows become invisible to every tenant — which **matches current app behavior** (`assertPatientBranchAccess` throws `403` on branchless patients, `assert-branch-access.ts:53`). Lower migration cost, but leaves the nullable column as the tenant key and the branchless-row-hidden semantics baked into the DB.

### Tier 3 — Child/line tables (parent EXISTS-join policy)

No tenant *and* no patient column; reach tenancy only through a parent row. ~25 tables: `dental_invoice_line_item` (→`invoice_id`), `dental_insurance_claim_line` (→`claim_id`), `dental_payment_plan` / `_installment`, `dental_perio_tooth_reading` (→`chart_id`), `dental_chart_version`, `visit_note_version`, `visit_notes`, `dental_inventory_adjustment`, `dental_household_member`, `dental_treatment_plan_approval` / `_status_history`, `imaging_study_image` / `_tooth`, `imaging_annotation`, `imaging_calibration`, `imaging_link`, `imaging_ceph_landmark` / `_analysis` / `_report` / `_superimposition`, `imported_pmd_safety_floor_events`. Policy: `EXISTS` through the parent. **Highest effort; deferred to a later phase (see §7).** For perf, prefer denormalizing `branch_id` onto the hottest of these (`dental_chart_version`, `dental_perio_tooth_reading`, `dental_invoice_line_item`) rather than per-row correlated subqueries.

### Explicitly OUT of scope (no RLS)

- **Reference / global catalogues:** `dental_procedure_code` (CDT catalogue, `procedure-code.schema.ts:4-12`), `email_template`, `email_queue` (recipient-email scoped, no tenant).
- **Better-auth tables** (`user`, `session`, `account`, `verification`, `passkey`, `twoFactor`, `apikey`) — `src/generated/better-auth/schema.ts`; the auth library owns them; no tenant column.
- **Upstream person-scoped modules** (`invoice`, `invoice_line_item`, `merchant_account`, `booking`, `booking_event`, `time_slot`, `schedule_exception`, `chat_room`, `chat_message`, `notification`, `review`, `stored_file`, `consultation_note`/`emr`, `audit_log_entry`) — no branch/org column; out of this gate (separate remodel).
- **`pmd_document` / `imported_pmd`** — FK-less plain-UUID tenant refs by design (`pmd-document.schema.ts:22-32`). `pmd_document` *has* a `branch_id` column (nullable), so it *could* get a Tier-1-style policy, but its loose-coupling and nullable tenant mean it is a **Decision D5 item**, parked out of the first cut.

---

## 3. Policy Shape

**Connection role — recommendation: BOTH a dedicated non-owner app role AND `FORCE ROW LEVEL SECURITY`.** The findings confirm the app and tests connect as `postgres` (superuser + table owner), and Postgres bypasses RLS for *both* superusers and table owners (`config.ts:128`, `test-with-db.ts:41-160`). Either fix alone is insufficient:
- A non-superuser role alone still bypasses RLS if it *owns* the tables (migrations run as `postgres`, so `postgres` stays owner).
- `FORCE ROW LEVEL SECURITY` alone still bypasses for a *superuser* connection.

So: **(a)** create a dedicated `LOGIN NOSUPERUSER` role `app_rls` with table `GRANT`s (not ownership), have the runtime app server connect as `app_rls`; **(b)** `ALTER TABLE … FORCE ROW LEVEL SECURITY` on every targeted table so the policy also applies to the owner during any owner-connection path; **(c)** keep migrations, seed, and explicitly-cross-tenant admin paths on a `BYPASSRLS`/owner connection (§4, §8-D3).

Per-table DDL pattern (Tier 1 example):

```sql
-- One-time role (own migration, see §5)
CREATE ROLE app_rls LOGIN NOSUPERUSER NOINHERIT PASSWORD :'app_rls_pw';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;

-- Helper: parse the SET LOCAL var into a uuid[] (empty/unset => empty array => fail-closed)
CREATE OR REPLACE FUNCTION app_current_branches() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    string_to_array(nullif(current_setting('app.current_branches', true), ''), ',')::uuid[],
    ARRAY[]::uuid[]
  );
$$;

-- Tier 1 table
ALTER TABLE dental_visit ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_visit FORCE ROW LEVEL SECURITY;
CREATE POLICY dental_visit_tenant ON dental_visit
  USING       (branch_id = ANY (app_current_branches()))
  WITH CHECK  (branch_id = ANY (app_current_branches()));
```

Key shape decisions:
- **Set-valued tenant key (`= ANY(uuid[])`), not a scalar `= current_setting()::uuid`.** This is *required*, not optional: multi-branch users and the EM-BIL-002 cross-branch billing reports legitimately read across the caller's branch set in a single request (`getCollectionsSummary.ts:44-99`, `org-billing.facade.ts:30-39`). A scalar `current_org` var would break those (§4, §8-D1). The `app_current_branches()` helper with `current_setting('app.current_branches', true)` (the `true` = "missing_ok") makes an **unset var resolve to an empty array → zero rows → fail-closed**.
- **`WITH CHECK` mirrors `USING`** so writes (INSERT/UPDATE) cannot create or move a row into a foreign branch.
- **Tier 2 EXISTS variant** swaps the predicate for the join described in §2; the helper function is reused.
- **Org-level table** (`dental_feature_permission`) uses a separate `app.current_org` var: `organization_id = ANY(app_current_orgs())`.

---

## 4. Session-Var Plumbing

**The core constraint (from findings, confirmed):** there is no central tenant choke point. The auth middleware resolves only the user, no DB work (`auth.ts:94-150`); tenancy (`branchId`) is resolved *per-handler from the query/path/body, after `zValidator` runs* (`listDentalPatients.ts:24-55`), and is sometimes derived mid-handler (e.g. `visitId → patient → branch`) or omitted entirely (multi-branch reports). And `SET LOCAL` only lives for the duration of a transaction; setting it on the shared pooled connection outside a tx would **leak tenant context across requests** (the opposite of the fix). The app is one shared `pg.Pool(max 20)` with no per-request tx (`database.ts:137-148`, `dependency.ts`).

**Therefore the var cannot be set by generic middleware.** Two viable plumbing models — recommend **B**:

- **Model A (rejected as the primary): global middleware.** Can't read `branchId` reliably before validation, and `branchId` lives in heterogeneous places. Would force a uniform inbound tenant field that doesn't exist.
- **Model B (recommended): a `withTenantTx` helper at the existing authz choke point.** Each handler already calls `assertBranchRole`/`assertBranchAccess` once it has resolved the target branch — that *is* the natural per-handler tenant-resolution point. Introduce:

```ts
// services/api-ts/src/core/tenant-tx.ts (new)
export async function withTenantTx<T>(
  db: DatabaseInstance,
  scope: { branchIds: string[]; orgId?: string },
  fn: (tx: DatabaseInstance) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_branches', ${scope.branchIds.join(',')}, true)`);
    if (scope.orgId) await tx.execute(sql`SELECT set_config('app.current_org', ${scope.orgId}, true)`);
    return fn(tx);
  });
}
```

- `set_config(…, true)` = transaction-local (= `SET LOCAL`), correct for pooled connections.
- This dovetails with the 13 handlers/repos that *already* use `db.transaction` and pass `tx` into repos (`resolveChartConflict.ts:83`). RLS requires routing **all** handler DB access for targeted tables through such a tx — a broad but mechanical refactor (see §7 risk).
- **SQLite/embedded guard:** `withTenantTx` must detect the dialect and skip `set_config` on SQLite (no-op tx) so the Tauri offline build doesn't break.

**Requests that legitimately span tenants** (the make-or-break design point):
1. **EM-BIL-002 multi-branch billing reports** — pass the caller's full active-branch set into `scope.branchIds` (via `getActiveBranchIdsForPerson`, `org-billing.facade.ts:30-39`). The set-valued policy already covers this; no carve-out needed. ✅ This is the main reason for the set-valued design.
2. **Platform-admin cross-org reads** — the erasure queue (`listErasureRequestsHandler.ts:18-28`) and audit-log list (`listAuditLogs.ts:29-32`) deliberately read across **all** tenants when their optional `tenantId` is omitted. These must run as a **`BYPASSRLS` (owner) connection**, not `app_rls`, OR enumerate per tenant. **Decision D3 (§8).** Recommendation: a separate, narrowly-scoped admin DB handle used only by these explicitly-gated endpoints — simpler than per-tenant loops, and these are already role-gated (`admin`/`compliance`).
3. **Seed (`seed-demo.ts`) and migrations** — always run as owner/superuser, never `app_rls`.

**Membership-set source:** populating `branchIds` for the cross-branch case needs the caller's active-membership set, which is a DB hit the auth middleware deliberately avoids. Recommendation: resolve lazily inside the handlers that need the multi-branch set (they already call `getActiveBranchIdsForPerson`), not in middleware — keeps the auth fast-path unchanged. **Decision D6 (§8): whether to cache the membership set on the session/JWT.**

---

## 5. Migration Strategy

- **RLS DDL ships as ordinary Drizzle SQL migrations.** Migrations are Drizzle-applied from `_journal.json` and run on server boot (`database.ts:218-226`, `app.ts:272`), and the test template `monobase_test` is built by the same `drizzle-kit migrate` (`db:setup:test`, `test-with-db.ts:193-198`). Putting RLS DDL in a versioned migration means it lands in **runtime, the test template, and every per-file test clone** identically — an out-of-band SQL script would let tests diverge from runtime. Use Drizzle "custom" SQL migrations (`bun run db:generate --custom`-style empty migration, then hand-author the SQL) since this is DDL Drizzle won't infer.
- **Ordering:**
  1. `00XX_create_app_rls_role.sql` — `CREATE ROLE app_rls` + `GRANT`s + default privileges. (Idempotent guards: `DO $$ … IF NOT EXISTS`.)
  2. `00XX_rls_helpers.sql` — `app_current_branches()` / `app_current_orgs()` functions.
  3. (If D2-A) `00XX_patient_branch_backfill.sql` — add `branch_id`, backfill from `preferred_branch_id`/membership/visit, set `NOT NULL`. **This is the heaviest migration; needs a backfill query + a verified zero-NULL postcondition.**
  4. `00XX_rls_tier1.sql`, then `…_tier2a.sql`, then `…_tier2b.sql`, then `…_tier3.sql` — one migration per tier so each phase is a separable PR (§7).
- **Reversibility:** RLS is reversible with `DROP POLICY` / `ALTER TABLE … DISABLE ROW LEVEL SECURITY` / `DROP ROLE`. Drizzle migrations are forward-only, so the rollback story is **the enforcement flag (§7) + a documented manual down-SQL** per migration, kept in the PR. Tier-1 policies are independently droppable; the role and backfill are the only non-trivial reversals.
- **Schema-drift CI check:** the repo has a migration-safety/schema-drift gate (per MEMORY: migration-safety comments, contract CI). Add an assertion that **(a)** every targeted table has `relrowsecurity = true AND relforcerowsecurity = true` (query `pg_class`), and **(b)** no targeted table is missing a policy — a small post-migrate SQL check run in CI against the booted test DB. This is the regression guard against "someone adds a new PHI table and forgets RLS."

---

## 6. Test Strategy

**The #1 gotcha (confirmed):** the test harness connects as `postgres` superuser/owner (`test-with-db.ts:41-160`), which bypasses RLS, so naive policy tests would **false-green**. The harness must be extended before any policy test means anything.

**Staged plan:**

- **Stage 0 — Harness validation (one table).** Add a `getRlsDb(branchIds)` test helper that connects as `app_rls` and opens a `withTenantTx`. On `dental_visit` alone, prove: `postgres` connection sees all rows; `app_rls` with branch A sees only A's rows; `app_rls` with **no** var set sees **zero** rows (fail-closed). This validates `FORCE RLS` + the role + the helper *before* writing ~40 policies.
- **Stage 1 — Per-table CRUD denial matrix (the core deliverable).** For each targeted PHI table, seed rows in branch A and branch B, then as `app_rls`+branch A assert: `SELECT` returns only A rows; `UPDATE`/`DELETE` of a B row affects **0 rows**; `INSERT` with a B `branch_id` (or B-anchored parent) is **blocked by `WITH CHECK`** (`42501`). Run via the real-DB harness so policies execute against real schema. These are **new DB-layer tests** (raw repo/SQL with a foreign session var), independent of handlers.
- **Stage 2 — Fail-closed negative test.** `app_rls` with no session var → 0 rows / error on every targeted table.
- **Stage 3 — Wire the var into `buildTestApp` + the request pipeline, then re-run the ENTIRE existing suite.** `buildTestApp` (`test-app.ts:139-208`) currently injects a plain Drizzle instance and sets no var. The existing cross-tenant negative tests (`cross-org-isolation.test.ts:176-243`, `dental-visit.cross-tenant-rbac.test.ts:93-144`, `dental-patient-sync-isolation.test.ts:115-184`, `dental-patient-list-branch-isolation.test.ts:70-96`, `getAuditEvents.test.ts`, `erasure-tenancy.test.ts`) **must still pass unchanged** — they assert `403`/`400` at the handler (fires before the query), so RLS shouldn't change them. **What will break and how to adapt:**
  - Any existing test that mounts a handler but relied on the *pooled* (non-tx) db and now hits RLS-enabled tables as `app_rls` without a var set → must run inside `withTenantTx` or as the owner handle. Audit these before flipping enforcement.
  - The platform-admin erasure/audit tests (cross-tenant by design) must run on the BYPASSRLS handle once D3 lands.
  - `seed-demo` and any fixture that writes across orgs must connect as owner, not `app_rls`.
- **Stage 4 — Contract/Hurl smoke** that a real cross-tenant request is double-walled (handler 403 *and*, if the filter were removed, 0 rows).

**Gate:** all existing isolation tests green + new per-table matrix green under `app_rls` + CI schema-drift check green.

---

## 7. Rollout & Phasing

Each phase is an independently shippable, independently testable PR (compatible with the branch-protection gate per MEMORY — 14 required checks, PR-based).

| Phase | Scope | Shippable artifact | Enforcement state |
|---|---|---|---|
| **P0 — Plumbing + pilot ✅ DONE** | `app_rls` `NOLOGIN` role + GRANTs migration, `app_current_branches()` helper, `withTenantTx` helper (SQLite-guarded). `ENABLE`+`FORCE` RLS + policy on the `dental_visit` pilot. | Helpers + Stage-0 validation on `dental_visit` (`0104`, `tenant-tx.ts`). | RLS armed on `dental_visit` only; app connects as `postgres` → bypasses. Zero runtime change. |
| **P1a — Tier 1 posture ✅ DONE** | `ENABLE`+`FORCE` RLS + set-valued policies on the remaining ~20 direct-tenant-column Tier-1 tables (18 branch-scoped + `dental_feature_permission` org-scoped + `dental_audit_log`). `app_current_orgs()` helper. Per-table isolation matrix. **No handler routing.** | Tier-1 migration `0105` + `tier1.rls-isolation.test.ts` (140 assertions) + full-suite regression. | RLS armed on all Tier-1; app still `postgres` → bypasses. Zero runtime change. |
| **P1b — Tier 1 activation** | Route the Tier-1 handlers' DB access through `withTenantTx` (`SET LOCAL ROLE app_rls`; connection stays `postgres`) with the correct branch scope ([resolved branch] single-branch; full active-branch set for the EM-BIL-002 multi-branch reports). | Module-by-module handler routing + full-suite regression. | RLS **enforced** on Tier 1 (second wall live on the request path). |
| **P2 — Tier 2a (visit-anchored)** | EXISTS-via-`dental_visit` policies on `dental_chart`, `dental_treatment`, `prescription`, `consent_form`, `amendment`, `lab_order`, etc. (the ADR-010 clinical set). | Tier-2a migration + matrix. | Enforced on Tier 2a. **ADR-010's named table set is now fully covered.** |
| **P3 — `patient` + Tier 2b** | Execute **Decision D2** (backfill `branch_id` on `patient`, or direct-`preferred_branch_id` policy), then policy `patient` + the ~13 `patient_id`-only tables. | Patient backfill migration (if D2-A) + Tier-2b migration + matrix. | Enforced on the patient subtree. |
| **P4 — Tier 3 child/line + admin carve-outs** | Parent-join (or denormalized-`branch_id`) policies on child/line tables; finalize the BYPASSRLS admin handle for erasure/audit (D3). | Tier-3 migration + matrix + admin-path tests. | Full enforcement. |
| **P5 — Drift gate** | CI assertion that every PHI table has `FORCE RLS` + a policy. | CI check. | Locks the posture. |

This ordering front-loads the ADR-010 named tables (done by end of P2) and isolates the two hard/risky pieces (`patient` backfill in P3, child-table breadth in P4) into their own PRs.

---

## 8. Risks, Unknowns & Open Decisions

**Genuine risks:**
1. **Owner/superuser bypass (the #1 way RLS ships broken).** Without `app_rls` + `FORCE RLS`, every policy test false-greens and the control is non-functional in dev/test/runtime. Mitigation: Stage-0 harness validation *before* writing policies.
2. **Cross-tenant report/admin endpoints.** A scalar var would break EM-BIL-002 multi-branch reports and admin erasure/audit. Mitigation: set-valued `app.current_branches` for reports; BYPASSRLS handle for admin (D3).
3. **Transaction-wrapping breadth & perf.** Routing all targeted-table handler DB access through `withTenantTx` is a broad mechanical refactor across ~9 dental modules; most handlers use the pooled db directly today. EXISTS-subquery policies on hot child tables add a correlated lookup per row — needs indexes on `visit_id`/`patient_id`/parent FKs (mostly present) and a denormalized `branch_id` on the hottest Tier-3 tables.
4. **Nullable / FK-less tenant refs.** `patient.preferred_branch_id` is nullable (branchless rows become invisible — matches app behavior, but must be intentional); `imaging_finding`/`pmd_document` use FK-less UUIDs, so EXISTS joins have no FK guarantee — add explicit indexes and accept app-enforced referential integrity.
5. **SQLite/embedded path.** `withTenantTx` and all RLS plumbing must no-op on the `sqlite-proxy` backend or the Tauri offline build breaks.
6. **Test-template staleness.** RLS DDL must be a Drizzle migration in `_journal.json` so `monobase_test` and every clone pick it up.

**Decisions the user must make before build starts:**
- **D1 — Session-var shape. ✅ RESOLVED (set-valued).** `app.current_branches` (uuid[]) is the primary key; org-level tables use the set-valued `app.current_orgs` (uuid[]) via `app_current_orgs()`. Both fail closed (unset/empty → empty array → zero rows). Proven by the `[A,B]`-sees-both isolation tests.
- **D2 — `patient` tenancy.** **D2-A (recommended): backfill NOT NULL `branch_id` on `patient`** (makes ~13 tables tractable, removes nullable ambiguity) vs **D2-B: policy directly on nullable `preferred_branch_id`** (lower migration cost, bakes branchless-hidden semantics into the DB). This cascades to all of Tier 2b.
- **D3 — Cross-tenant admin/report model.** BYPASSRLS owner handle for erasure-queue/audit-list (recommended), or per-tenant enumeration loops?
- **D4 — Production connection role. ✅ RESOLVED (stays `postgres` + `SET LOCAL ROLE`).** The runtime app server keeps its `postgres` connection; RLS is entered per-request via `SET LOCAL ROLE app_rls` inside `withTenantTx` (transaction-local). `app_rls` is therefore `NOLOGIN` (no credential to manage), and admin/cross-tenant paths bypass simply by not calling `withTenantTx` — no separate `BYPASSRLS` login handle needed (revisit only if the connection model ever changes).
- **D5 — `pmd_document` (nullable `branch_id`, FK-less) and other nullable-tenant ops tables** (`legal_hold`, `erasure_request`, `retention_policy`, `dental_sync_log`, `dental_audit`): per-tenant RLS with NULL carve-outs, or excluded as admin/system tables? (Recommendation: exclude the nullable ops tables from the first cut; revisit in P4.)
- **D6 — Membership-set caching.** Resolve the caller's branch set per-request via DB (keeps auth fast-path unchanged, recommended) vs cache on session/JWT (avoids the per-request DB hit but adds staleness on membership change)?
- **D7 — Upstream person-scoped modules** (billing `invoice`, `booking`, `notification`, `stored_file`, `consultation_note`): confirmed **out of scope** for this branch-keyed gate, handled separately? (ADR-010's named set is dental-only, so this is consistent — just needs explicit sign-off.)

**Open questions where findings are incomplete (not guessed):**
- Exact schema line refs for several Tier-1 tables (`dental_appointment_hold`, `dental_queue_item`, `dental_waitlist_entry`, `dental_operatory`, `dental_coverage_authorization`, `dental_inventory_item`, the three template tables) come from the aggregate findings, not a per-file read in this pass — verify each carries a non-null `branch_id` before authoring its policy.
- Whether the existing migration-safety CI gate can host the `pg_class` RLS assertion directly, or needs a new dedicated check, is unconfirmed.

---

## 9. Effort Estimate

Rough, assuming one engineer familiar with the codebase; "d" = ideal engineer-days.

| Phase | Work | Estimate |
|---|---|---|
| **P0** | Role+GRANT migration, helper fn, `withTenantTx` (incl. SQLite guard), `getRlsDb`, Stage-0 validation. | **2–3 d** |
| **P1** | ~21 Tier-1 policies + migration, route ~21 handler groups through `withTenantTx`, switch app to `app_rls`, Stage-1 matrix (~21 tables), full-suite regression + fixups. | **5–8 d** (the handler-routing refactor dominates) |
| **P2** | ~9 Tier-2a EXISTS policies + matrix; less handler churn (visit-anchored handlers already cluster). | **3–4 d** |
| **P3** | **D2 backfill migration + verification** (the risky one) + ~13 Tier-2b policies + matrix. | **4–6 d** (mostly the patient backfill + its data verification) |
| **P4** | ~25 Tier-3 parent-join/denormalized policies + matrix + admin BYPASSRLS handle + admin-path tests. | **5–7 d** (breadth + perf indexes) |
| **P5** | CI drift gate. | **0.5–1 d** |
| **Total** | | **~20–29 d** (≈4–6 engineer-weeks), shippable as 6 independent PRs. |

The dominant costs are the **P1 handler→`withTenantTx` refactor** (broad, mechanical, regression-prone) and the **P3 `patient` backfill** (data-correctness-critical). Everything ADR-010 explicitly names is enforced by end of **P2** (~10–15 d in); P3–P4 extend coverage to the full PHI surface and close the partial-RLS-false-security risk ADR-010 warns about (`ADR-010:22`).

**Key evidence paths:** `services/api-ts/src/core/database.ts:137-166` (shared pool, no tenant scoping), `services/api-ts/src/middleware/dependency.ts` (DI sets shared db, no var), `services/api-ts/src/handlers/shared/assert-branch-access.ts:15-57` (current load-bearing control + natural choke point), `services/api-ts/src/handlers/patient/repos/patient.schema.ts:29` (the hard-case nullable `preferred_branch_id`), `services/api-ts/scripts/test-with-db.ts:41-160` (superuser test connection — the bypass risk), `services/api-ts/src/tests/helpers/test-app.ts:139-208` (`buildTestApp` harness to extend), `docs/decisions/ADR-010-tenant-isolation-rls-pre-ga.md:14` (the accepted gate).
