-- MIGRATION-SAFETY: PG16 — ALTER TYPE ADD VALUE is non-destructive and additive; the new enum value is not referenced within this migration.
ALTER TYPE "public"."dental_invoice_status" ADD VALUE 'uncollectible';--> statement-breakpoint
ALTER TABLE "dental_invoice" ADD COLUMN "uncollectible_at" timestamp with time zone;