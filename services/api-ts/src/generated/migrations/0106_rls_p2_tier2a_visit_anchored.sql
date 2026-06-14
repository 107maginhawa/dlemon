-- RLS P2 — Tier-2a visit-anchored table posture (ADR-010 pre-GA gate, phase 2).
-- See docs/decisions/ADR-010-rls-implementation-plan.md.
--
-- ZERO RUNTIME CHANGE (same posture as 0104/0105). The app server still connects
-- as the postgres superuser, which BYPASSES Row-Level Security (superuser bypass
-- is NOT removed by FORCE). RLS on these tables is only ever exercised by code/
-- tests that enter the dedicated app_rls role via `SET LOCAL ROLE app_rls` inside
-- a transaction (src/core/tenant-tx.ts withTenantTx). Seed, migrations, and every
-- existing handler keep running as postgres and are unaffected. Activation (routing
-- handlers through withTenantTx) happens with the Tier-1 activation (P1b) and the
-- patient/child phases (P3/P4).
--
-- These nine clinical tables carry NO direct branch_id; their tenancy is derived
-- through the parent dental_visit row (visit_id NOT NULL FK → dental_visit). This
-- migration ENABLEs + FORCEs RLS and installs an EXISTS-subquery policy that admits
-- a row only when its parent visit's branch is in the caller's current branch set:
--
--   EXISTS (SELECT 1 FROM dental_visit v
--           WHERE v.id = <table>.visit_id
--             AND v.branch_id = ANY (app_current_branches()))
--
-- dental_visit is itself RLS-armed (0104), so under app_rls the subquery is also
-- subject to dental_visit's own policy — both filters key off the same branch set,
-- so they compose consistently (no false visibility, no recursion: dental_visit's
-- policy does not reference these tables). WITH CHECK mirrors USING so a write
-- cannot create or move a row under an out-of-scope visit. The explicit branch
-- predicate is kept (not relying solely on dental_visit's RLS) so the policy is
-- correct and self-documenting independent of the parent's posture. With an unset/
-- empty branch set, app_current_branches() is the empty array → EXISTS is false →
-- ZERO rows (fail-closed), the same contract as the Tier-1 tables.
--
-- This finishes ADR-010's named clinical table set (dental_chart, dental_treatment,
-- prescription, consent_form, amendment, lab_order, plus the sibling clinical
-- tables dental_finding, consent_refusal, dental_attachment).

ALTER TABLE "dental_chart" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_chart" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_chart_tenant_isolation" ON "dental_chart"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = dental_chart.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = dental_chart.visit_id AND v.branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_treatment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_treatment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_treatment_tenant_isolation" ON "dental_treatment"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = dental_treatment.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = dental_treatment.visit_id AND v.branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_finding" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_finding" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_finding_tenant_isolation" ON "dental_finding"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = dental_finding.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = dental_finding.visit_id AND v.branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "prescription" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prescription" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "prescription_tenant_isolation" ON "prescription"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = prescription.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = prescription.visit_id AND v.branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "consent_form" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consent_form" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "consent_form_tenant_isolation" ON "consent_form"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = consent_form.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = consent_form.visit_id AND v.branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "consent_refusal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consent_refusal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "consent_refusal_tenant_isolation" ON "consent_refusal"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = consent_refusal.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = consent_refusal.visit_id AND v.branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "amendment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "amendment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "amendment_tenant_isolation" ON "amendment"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = amendment.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = amendment.visit_id AND v.branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "lab_order" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lab_order" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "lab_order_tenant_isolation" ON "lab_order"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = lab_order.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = lab_order.visit_id AND v.branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_attachment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_attachment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_attachment_tenant_isolation" ON "dental_attachment"
  USING (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = dental_attachment.visit_id AND v.branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM dental_visit v WHERE v.id = dental_attachment.visit_id AND v.branch_id = ANY (app_current_branches())));
