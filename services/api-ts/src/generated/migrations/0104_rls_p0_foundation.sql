-- RLS P0 — plumbing foundation (ADR-010 pre-GA gate, phase 0).
-- See docs/decisions/ADR-010-rls-implementation-plan.md.
--
-- ZERO RUNTIME CHANGE. The app server still connects as the postgres superuser,
-- which BYPASSES Row-Level Security (superuser bypass is NOT removed by FORCE).
-- RLS here is only ever exercised by code/tests that enter the dedicated app_rls
-- role via `SET LOCAL ROLE app_rls` inside a transaction (see
-- src/core/tenant-tx.ts withTenantTx). Seed, migrations, and every existing
-- handler/test keep running as postgres and are unaffected. Later phases switch
-- the request path onto app_rls and extend RLS to the full PHI table set.

-- 1. Dedicated non-owner application role. NOLOGIN: it is entered via
--    `SET LOCAL ROLE app_rls`, never a direct login, so there is no credential to
--    manage in this phase. Roles are CLUSTER-GLOBAL and migrations re-run per
--    database on boot, so guard the create to stay idempotent across databases.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls') THEN
    CREATE ROLE app_rls NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint

-- 2. Privileges so app_rls can operate on tenant tables. It OWNS nothing (the
--    migrating superuser owns the tables), so RLS applies to it. Granted broadly
--    now so later phases that route handlers through withTenantTx do not each need
--    a grant migration — RLS, not the grant, is what scopes row visibility.
GRANT USAGE ON SCHEMA public TO app_rls;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rls;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_rls;--> statement-breakpoint

-- 3. Tenant-context helper. Reads the per-request set of in-scope branch UUIDs
--    from the `app.current_branches` GUC (a comma-separated list set via
--    set_config(..., is_local => true) inside withTenantTx). An UNSET or EMPTY
--    value resolves to an EMPTY array → every `= ANY(...)` predicate is false →
--    ZERO rows. That fail-closed default is the point: a tenant-scoped query that
--    forgets to set the context sees nothing rather than everything.
CREATE OR REPLACE FUNCTION app_current_branches() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    string_to_array(NULLIF(current_setting('app.current_branches', true), ''), ',')::uuid[],
    ARRAY[]::uuid[]
  );
$$;--> statement-breakpoint

-- 4. Stage-0 pilot: enable RLS on dental_visit (a Tier-1 direct-branch_id PHI
--    table). ENABLE turns policies on for non-owner, non-superuser roles; FORCE
--    additionally subjects the table OWNER (belt-and-suspenders for any future
--    owner-connection path). The postgres superuser the app currently uses still
--    bypasses both — hence zero runtime change until a later phase switches the
--    connection role. A row is visible/writable only when its branch_id is in the
--    caller's current branch set; WITH CHECK mirrors USING so a write cannot
--    create or move a row into a branch outside that set.
ALTER TABLE "dental_visit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_visit" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_visit_tenant_isolation" ON "dental_visit"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));
