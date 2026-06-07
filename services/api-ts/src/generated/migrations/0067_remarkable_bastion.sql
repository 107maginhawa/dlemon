-- MIGRATION-SAFETY: PG16 — ALTER TYPE ADD VALUE is non-destructive and additive; the new enum value is not referenced within this migration.
ALTER TYPE "public"."member_status" ADD VALUE 'invited' BEFORE 'active';--> statement-breakpoint
-- MIGRATION-SAFETY: PG16 — ALTER TYPE ADD VALUE is non-destructive and additive; the new enum value is not referenced within this migration.
ALTER TYPE "public"."member_status" ADD VALUE 'revoked';--> statement-breakpoint
ALTER TABLE "imaging_finding" DROP CONSTRAINT IF EXISTS "imaging_finding_visit_id_dental_visit_id_fk";
--> statement-breakpoint
ALTER TABLE "imaging_finding" DROP CONSTRAINT IF EXISTS "imaging_finding_patient_id_patient_id_fk";
--> statement-breakpoint
ALTER TABLE "imaging_finding" DROP CONSTRAINT IF EXISTS "imaging_finding_branch_id_dental_branch_id_fk";
