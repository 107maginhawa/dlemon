-- MIGRATION-SAFETY: brand-new enum type (CREATE TYPE) is additive and transaction-safe (not ALTER TYPE ADD VALUE). Adds 'visit_type' for E3 hygienist-led hygiene visits; ADD COLUMN with a NOT NULL DEFAULT 'general' backfills all existing rows to the dentist-led default — no data loss.
CREATE TYPE "public"."dental_visit_type" AS ENUM('general', 'hygiene');--> statement-breakpoint
ALTER TABLE "dental_visit" ADD COLUMN "visit_type" "dental_visit_type" DEFAULT 'general' NOT NULL;
