CREATE TYPE "public"."imaging_captured_at_source" AS ENUM('dicom_tag', 'exif', 'visit', 'manual', 'defaulted_upload');--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "captured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "captured_at_source" "imaging_captured_at_source";--> statement-breakpoint
-- §capture-date backfill: existing rows had no acquisition date, so their only
-- known timestamp is the upload time. Seed captured_at = created_at and flag the
-- provenance as 'defaulted_upload' so a real capture date stays distinguishable
-- from an upload default (medico-legal). New rows are always written by the handler.
UPDATE "imaging_study_image" SET "captured_at" = "created_at", "captured_at_source" = 'defaulted_upload' WHERE "captured_at" IS NULL;