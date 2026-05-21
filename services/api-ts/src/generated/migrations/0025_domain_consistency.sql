-- Domain consistency fixes: column rename + enum value renames
-- Phase 2: procedureType → serviceType (column rename)
ALTER TABLE "dental_appointment" RENAME COLUMN "procedure_type" TO "service_type";--> statement-breakpoint

-- Phase 3: Standardize camelCase enum values to snake_case
-- MIGRATION-SAFETY: ALTER TYPE RENAME VALUE is non-transactional in PG < 12; safe on PG 12+ (project requires PG 16). Renamed camelCase → snake_case for domain consistency; no data loss.
ALTER TYPE "appointment_status" RENAME VALUE 'checkedIn' TO 'checked_in';--> statement-breakpoint
-- MIGRATION-SAFETY: ALTER TYPE RENAME VALUE is non-transactional in PG < 12; safe on PG 12+ (project requires PG 16). Renamed camelCase → snake_case for domain consistency; no data loss.
ALTER TYPE "appointment_status" RENAME VALUE 'noShow' TO 'no_show';--> statement-breakpoint
-- MIGRATION-SAFETY: ALTER TYPE RENAME VALUE is non-transactional in PG < 12; safe on PG 12+ (project requires PG 16). Renamed camelCase → snake_case for domain consistency; no data loss.
ALTER TYPE "lab_order_status" RENAME VALUE 'inFabrication' TO 'in_fabrication';--> statement-breakpoint
-- MIGRATION-SAFETY: ALTER TYPE RENAME VALUE is non-transactional in PG < 12; safe on PG 12+ (project requires PG 16). Renamed camelCase → snake_case for domain consistency; no data loss.
ALTER TYPE "medical_history_entry_type" RENAME VALUE 'familyHistory' TO 'family_history';--> statement-breakpoint
-- MIGRATION-SAFETY: ALTER TYPE RENAME VALUE is non-transactional in PG < 12; safe on PG 12+ (project requires PG 16). Renamed camelCase → snake_case for domain consistency; no data loss.
ALTER TYPE "dental_payment_method" RENAME VALUE 'bankTransfer' TO 'bank_transfer';--> statement-breakpoint
-- MIGRATION-SAFETY: ALTER TYPE RENAME VALUE is non-transactional in PG < 12; safe on PG 12+ (project requires PG 16). Renamed camelCase → snake_case for domain consistency; no data loss.
ALTER TYPE "dental_plan_status" RENAME VALUE 'onTrack' TO 'on_track';
