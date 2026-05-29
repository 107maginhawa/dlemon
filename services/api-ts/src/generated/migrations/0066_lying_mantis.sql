ALTER TABLE "imaging_finding" DROP CONSTRAINT IF EXISTS "imaging_finding_visit_id_dental_visit_id_fk";
--> statement-breakpoint
ALTER TABLE "imaging_finding" DROP CONSTRAINT IF EXISTS "imaging_finding_patient_id_patient_id_fk";
--> statement-breakpoint
ALTER TABLE "imaging_finding" DROP CONSTRAINT IF EXISTS "imaging_finding_branch_id_dental_branch_id_fk";
