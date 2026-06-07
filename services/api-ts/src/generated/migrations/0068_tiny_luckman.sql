-- MIGRATION-SAFETY: PG16 — ALTER TYPE ADD VALUE is non-destructive and additive; the new enum value is not referenced within this migration.
ALTER TYPE "public"."ceph_landmark_status" ADD VALUE 'not_placed' BEFORE 'placed';--> statement-breakpoint
-- MIGRATION-SAFETY: PG16 — ALTER TYPE ADD VALUE is non-destructive and additive; the new enum value is not referenced within this migration.
ALTER TYPE "public"."imaging_finding_status" ADD VALUE 'draft' BEFORE 'suspected';--> statement-breakpoint
ALTER TABLE "consultation_note" DROP CONSTRAINT IF EXISTS "consultation_note_patient_id_patient_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_note" DROP CONSTRAINT IF EXISTS "consultation_note_provider_id_provider_id_fk";
