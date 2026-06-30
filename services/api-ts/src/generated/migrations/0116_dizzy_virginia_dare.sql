CREATE TYPE "public"."dental_invoice_kind" AS ENUM('standard', 'deposit');--> statement-breakpoint
ALTER TABLE "dental_invoice" ADD COLUMN "kind" "dental_invoice_kind" DEFAULT 'standard' NOT NULL;