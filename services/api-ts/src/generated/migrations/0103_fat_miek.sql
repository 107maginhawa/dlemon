-- MIGRATION-SAFETY: reconcile-only, no data change. The table, FK, and unique index below
-- already exist on every environment from migration 0063 (imported_pmd_safety_floor_events
-- was created there as a raw-SQL orphan with no Drizzle model, so it was absent from the
-- Drizzle snapshot). This migration only brings the snapshot in line — now that a Drizzle
-- model exists, db:generate emitted a fresh CREATE; without this reconcile that CREATE would
-- fail on the pre-existing table. Every statement is guarded to be a no-op on a DB that
-- already ran 0063 (and applies cleanly on a hypothetical DB that somehow lacks it). The
-- append-only merge MECHANISM + FIX-003 consumer remain deferred (decision #20).
CREATE TABLE IF NOT EXISTS "imported_pmd_safety_floor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imported_pmd_id" uuid NOT NULL,
	"merged_at" timestamp DEFAULT now() NOT NULL,
	"merged_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'imported_pmd_safety_floor_events_imported_pmd_id_fk'
  ) THEN
    ALTER TABLE "imported_pmd_safety_floor_events"
      ADD CONSTRAINT "imported_pmd_safety_floor_events_imported_pmd_id_fk"
      FOREIGN KEY ("imported_pmd_id") REFERENCES "public"."imported_pmd"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "imported_pmd_safety_floor_events_pmd_uniq" ON "imported_pmd_safety_floor_events" USING btree ("imported_pmd_id");
