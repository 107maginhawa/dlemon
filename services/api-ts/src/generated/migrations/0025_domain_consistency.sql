-- Domain consistency fixes: column rename + enum value renames
-- Phase 2: procedureType → serviceType (column rename)
ALTER TABLE "dental_appointment" RENAME COLUMN "procedure_type" TO "service_type";--> statement-breakpoint

-- Phase 3: Standardize camelCase enum values to snake_case
ALTER TYPE "appointment_status" RENAME VALUE 'checkedIn' TO 'checked_in';--> statement-breakpoint
ALTER TYPE "appointment_status" RENAME VALUE 'noShow' TO 'no_show';--> statement-breakpoint
ALTER TYPE "lab_order_status" RENAME VALUE 'inFabrication' TO 'in_fabrication';--> statement-breakpoint
ALTER TYPE "medical_history_entry_type" RENAME VALUE 'familyHistory' TO 'family_history';--> statement-breakpoint
ALTER TYPE "dental_payment_method" RENAME VALUE 'bankTransfer' TO 'bank_transfer';--> statement-breakpoint
ALTER TYPE "dental_plan_status" RENAME VALUE 'onTrack' TO 'on_track';
