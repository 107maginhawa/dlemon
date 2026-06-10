CREATE TYPE "public"."imaging_quality_status" AS ENUM('ok', 'retake');--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "is_diagnostic" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "quality_status" "imaging_quality_status" DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "retake_reason" text;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;