ALTER TYPE "public"."dental_treatment_status" ADD VALUE 'declined';--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "refusal_reason" text;