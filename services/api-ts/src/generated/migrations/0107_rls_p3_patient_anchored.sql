-- RLS P3a — patient + patient-anchored table posture (ADR-010 pre-GA gate, phase 3a).
-- See docs/decisions/ADR-010-rls-implementation-plan.md.
--
-- ZERO RUNTIME CHANGE (same posture as 0104/0105/0106). The app server still
-- connects as the postgres superuser, which BYPASSES Row-Level Security (superuser
-- bypass is NOT removed by FORCE). RLS on these tables is only ever exercised by
-- code/tests that enter the dedicated app_rls role via `SET LOCAL ROLE app_rls`
-- inside a transaction (src/core/tenant-tx.ts withTenantTx). Seed, migrations, and
-- every existing handler keep running as postgres and are unaffected. Activation
-- (routing the patient/clinical handlers through withTenantTx) is a later phase
-- (P3b); arming the posture now means the wall is already in place when it lands.
--
-- D2 RESOLVED (D2-B-on-existing-column): the `patient` table is scoped on its
-- EXISTING `preferred_branch_id` column — the de-facto tenant key the app already
-- filters on everywhere (patient-person.facade.ts, assertPatientBranchAccess).
-- No new branch_id column, no backfill, no NOT NULL change. Patients are cleanly
-- single-branch-scoped today (branchless => 403 on every path); a NULL
-- preferred_branch_id resolves to "in no scope" under app_rls => the row is
-- invisible, which MATCHES the existing 403 behaviour (fail-closed). Admin /
-- erasure paths stay on the bypassing postgres connection and still see them.
--
-- Three policy shapes:
--   (1) patient (direct column):  preferred_branch_id = ANY (app_current_branches())
--   (2) the 13 patient-anchored child tables (no tenant column; patient_id NOT NULL
--       FK -> patient) derive tenancy via an EXISTS-subquery through the parent
--       patient row:
--         EXISTS (SELECT 1 FROM patient p
--                 WHERE p.id = <table>.patient_id
--                   AND p.preferred_branch_id = ANY (app_current_branches()))
--       patient is itself RLS-armed below, so under app_rls the subquery is also
--       subject to patient's own policy — both key off the same branch set, so they
--       compose consistently (no recursion: patient's policy does not reference
--       these tables). The explicit predicate is kept so each policy is correct and
--       self-documenting independent of the parent's posture.
--   (Note: dental_household + dental_coverage_authorization carry a direct branch_id
--    but are ALREADY armed in 0105 (P1a Tier-1) — not repeated here.)
--
-- WITH CHECK mirrors USING so a write cannot create or move a row into / under an
-- out-of-scope branch. With an unset/empty branch set, app_current_branches() is the
-- empty array => zero rows (fail-closed), identical to the Tier-1/Tier-2a tables.
--
-- A supporting index on patient(preferred_branch_id) backs both the patient policy
-- and the branch-scoped patient list the app already runs.

CREATE INDEX IF NOT EXISTS "patients_preferred_branch_id_idx" ON "patient" ("preferred_branch_id");--> statement-breakpoint

ALTER TABLE "patient" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "patient" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "patient_tenant_isolation" ON "patient"
  USING (preferred_branch_id = ANY (app_current_branches()))
  WITH CHECK (preferred_branch_id = ANY (app_current_branches()));--> statement-breakpoint

ALTER TABLE "medical_history_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medical_history_entry" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "medical_history_entry_tenant_isolation" ON "medical_history_entry"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = medical_history_entry.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = medical_history_entry.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "medical_history_review" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "medical_history_review" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "medical_history_review_tenant_isolation" ON "medical_history_review"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = medical_history_review.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = medical_history_review.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_alert" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_alert" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_alert_tenant_isolation" ON "dental_alert"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_alert.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_alert.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_recall" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_recall" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_recall_tenant_isolation" ON "dental_recall"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_recall.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_recall.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_task" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_task" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_task_tenant_isolation" ON "dental_task"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_task.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_task.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_patient_contact" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_patient_contact" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_patient_contact_tenant_isolation" ON "dental_patient_contact"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_patient_contact.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_patient_contact.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_insurance_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_insurance_profile" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_insurance_profile_tenant_isolation" ON "dental_insurance_profile"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_insurance_profile.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_insurance_profile.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_claim_draft" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_claim_draft" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_claim_draft_tenant_isolation" ON "dental_claim_draft"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_claim_draft.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_claim_draft.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_case_presentation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_case_presentation" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_case_presentation_tenant_isolation" ON "dental_case_presentation"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_case_presentation.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_case_presentation.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_treatment_plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_treatment_plan" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_treatment_plan_tenant_isolation" ON "dental_treatment_plan"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_treatment_plan.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_treatment_plan.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "treatment_plan_version" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "treatment_plan_version" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "treatment_plan_version_tenant_isolation" ON "treatment_plan_version"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = treatment_plan_version.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = treatment_plan_version.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_patient_chart_baseline" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_patient_chart_baseline" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_patient_chart_baseline_tenant_isolation" ON "dental_patient_chart_baseline"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_patient_chart_baseline.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_patient_chart_baseline.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));--> statement-breakpoint

ALTER TABLE "dental_occlusion_screening" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dental_occlusion_screening" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dental_occlusion_screening_tenant_isolation" ON "dental_occlusion_screening"
  USING (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_occlusion_screening.patient_id AND p.preferred_branch_id = ANY (app_current_branches())))
  WITH CHECK (EXISTS (SELECT 1 FROM patient p WHERE p.id = dental_occlusion_screening.patient_id AND p.preferred_branch_id = ANY (app_current_branches())));
