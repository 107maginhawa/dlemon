ALTER TYPE "public"."imaging_modality" ADD VALUE 'cbct' BEFORE 'intraoral_photo';--> statement-breakpoint
ALTER TABLE "imported_pmd" DROP CONSTRAINT "imported_pmd_patient_id_patient_id_fk";
--> statement-breakpoint
ALTER TABLE "pmd_document" DROP CONSTRAINT "pmd_document_visit_id_dental_visit_id_fk";
--> statement-breakpoint
ALTER TABLE "pmd_document" DROP CONSTRAINT "pmd_document_patient_id_patient_id_fk";
--> statement-breakpoint
ALTER TABLE "pmd_document" DROP CONSTRAINT "pmd_document_author_member_id_dental_membership_id_fk";
--> statement-breakpoint
ALTER TABLE "pmd_document" DROP CONSTRAINT "pmd_document_branch_id_dental_branch_id_fk";
--> statement-breakpoint
ALTER TABLE "imaging_finding" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "consent" jsonb;