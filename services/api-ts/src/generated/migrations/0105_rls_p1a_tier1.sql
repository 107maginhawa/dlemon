-- RLS P1a — Tier-1 table posture (ADR-010 pre-GA gate, phase 1a).
-- See docs/decisions/ADR-010-rls-implementation-plan.md.
--
-- ZERO RUNTIME CHANGE (same posture as 0104). The app server still connects as
-- the postgres superuser, which BYPASSES Row-Level Security (superuser bypass is
-- NOT removed by FORCE). RLS on these tables is only ever exercised by code/tests
-- that enter the dedicated app_rls role via `SET LOCAL ROLE app_rls` inside a
-- transaction (src/core/tenant-tx.ts withTenantTx). Seed, migrations, and every
-- existing handler keep running as postgres and are unaffected. P1b routes the
-- Tier-1 handlers' DB access through withTenantTx to make the second wall live.
--
-- This migration ENABLEs + FORCEs RLS and installs a set-valued tenant policy on
-- the direct-tenant-column Tier-1 tables (dental_visit was the 0104 pilot).
--   * branch-scoped tables → branch_id = ANY(app_current_branches())
--   * dental_feature_permission (org-scoped) → organization_id = ANY(app_current_orgs())
--   * dental_audit_log → tenant_id = ANY(app_current_branches())  (tenant_id holds
--     the branch uuid; the admin audit-list reads run as postgres and bypass — the
--     deliberate cross-tenant admin read (D3) and the org-level-tenant_id edge
--     case are addressed at activation, not here).

-- 1. Org-scoped tenant helper — mirror of app_current_branches() for the few
--    org-keyed RLS tables. Reads the per-request set of in-scope org UUIDs from
--    the `app.current_orgs` GUC (csv, set via set_config(..., is_local => true) in
--    withTenantTx). UNSET/EMPTY → empty array → every `= ANY(...)` is false → ZERO
--    rows (fail-closed), same contract as the branch helper.
CREATE OR REPLACE FUNCTION app_current_orgs() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    string_to_array(NULLIF(current_setting('app.current_orgs', true), ''), ',')::uuid[],
    ARRAY[]::uuid[]
  );
$$;--> statement-breakpoint

-- 2. Branch-scoped Tier-1 tables. Each: ENABLE (policy applies to non-owner,
--    non-superuser roles) + FORCE (also subjects the table owner) + a set-valued
--    USING/WITH CHECK policy. A row is visible/writable only when its branch_id is
--    in the caller's current branch set; WITH CHECK mirrors USING so a write
--    cannot create or move a row into an out-of-scope branch.

ALTER TABLE "dental_invoice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_invoice" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_invoice_tenant_isolation" ON "dental_invoice"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_payment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_payment_tenant_isolation" ON "dental_payment"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_payer_payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_payer_payment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_payer_payment_tenant_isolation" ON "dental_payer_payment"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_insurance_claim" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_insurance_claim" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_insurance_claim_tenant_isolation" ON "dental_insurance_claim"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_perio_chart" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_perio_chart" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_perio_chart_tenant_isolation" ON "dental_perio_chart"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_appointment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_appointment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_appointment_tenant_isolation" ON "dental_appointment"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_appointment_hold" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_appointment_hold" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_appointment_hold_tenant_isolation" ON "dental_appointment_hold"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_queue_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_queue_item" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_queue_item_tenant_isolation" ON "dental_queue_item"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_waitlist_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_waitlist_entry" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_waitlist_entry_tenant_isolation" ON "dental_waitlist_entry"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_operatory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_operatory" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_operatory_tenant_isolation" ON "dental_operatory"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_household" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_household" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_household_tenant_isolation" ON "dental_household"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_coverage_authorization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_coverage_authorization" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_coverage_authorization_tenant_isolation" ON "dental_coverage_authorization"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "imaging_study" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "imaging_study" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "imaging_study_tenant_isolation" ON "imaging_study"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "imaging_finding" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "imaging_finding" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "imaging_finding_tenant_isolation" ON "imaging_finding"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_inventory_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_inventory_item" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_inventory_item_tenant_isolation" ON "dental_inventory_item"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_consent_template" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_consent_template" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_consent_template_tenant_isolation" ON "dental_consent_template"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_treatment_template" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_treatment_template" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_treatment_template_tenant_isolation" ON "dental_treatment_template"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "dental_postop_template" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_postop_template" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_postop_template_tenant_isolation" ON "dental_postop_template"
  USING (branch_id = ANY (app_current_branches()))
  WITH CHECK (branch_id = ANY (app_current_branches()));--> statement-breakpoint

-- 3. Org-scoped Tier-1 table.
ALTER TABLE "dental_feature_permission" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_feature_permission" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_feature_permission_tenant_isolation" ON "dental_feature_permission"
  USING (organization_id = ANY (app_current_orgs()))
  WITH CHECK (organization_id = ANY (app_current_orgs()));--> statement-breakpoint

-- 4. Audit log. Its NOT NULL tenant key is tenant_id (holds the branch uuid that
--    handlers pass as the event tenant); branch_id is a nullable convenience copy.
--    Policy keys off tenant_id. The admin audit-list endpoint reads across all
--    tenants by design and runs as postgres (bypasses) — P4/D3 finalizes a
--    dedicated bypass handle and the org-level-tenant_id edge case at activation.
ALTER TABLE "dental_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_audit_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_audit_log_tenant_isolation" ON "dental_audit_log"
  USING (tenant_id = ANY (app_current_branches()))
  WITH CHECK (tenant_id = ANY (app_current_branches()));
