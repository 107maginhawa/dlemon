-- MIGRATION-SAFETY: PG16 — ALTER TYPE ADD VALUE is non-destructive and additive; the new enum value is not referenced within this migration.
ALTER TYPE "public"."member_role" ADD VALUE 'hygienist' BEFORE 'staff_full';--> statement-breakpoint
-- MIGRATION-SAFETY: PG16 — ALTER TYPE ADD VALUE is non-destructive and additive; the new enum value is not referenced within this migration.
ALTER TYPE "public"."member_role" ADD VALUE 'read_only';