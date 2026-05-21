-- MIGRATION-SAFETY: ALTER TYPE ADD VALUE cannot run inside a transaction block in PG < 12; safe on PG 12+ (project requires PG 16). Adds 'declined' status for treatment refusal workflow; purely additive, no data loss.
ALTER TYPE "public"."dental_treatment_status" ADD VALUE 'declined';--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "refusal_reason" text;