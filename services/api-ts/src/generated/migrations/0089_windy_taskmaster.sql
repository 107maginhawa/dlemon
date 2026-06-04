ALTER TYPE "public"."dental_invoice_status" ADD VALUE 'uncollectible';--> statement-breakpoint
ALTER TABLE "dental_invoice" ADD COLUMN "uncollectible_at" timestamp with time zone;