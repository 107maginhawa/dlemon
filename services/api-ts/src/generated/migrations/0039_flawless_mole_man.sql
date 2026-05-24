ALTER TABLE "dental_treatment" ADD COLUMN "performed_at" timestamp;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "billed_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "dental_visit" ADD COLUMN "appointment_id" uuid;