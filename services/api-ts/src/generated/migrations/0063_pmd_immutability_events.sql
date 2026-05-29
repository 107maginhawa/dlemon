-- EF-PMD-003: Replace mutable safetyFloorMerged flag on imported_pmd with an
-- append-only events table.  The flag column is preserved (read-only, default
-- 'false') so that existing rows remain valid; going forward the column is
-- never updated — merge state is derived by joining with this events table.

CREATE TABLE "imported_pmd_safety_floor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imported_pmd_id" uuid NOT NULL,
	"merged_at" timestamp DEFAULT now() NOT NULL,
	"merged_by" uuid
);
--> statement-breakpoint
ALTER TABLE "imported_pmd_safety_floor_events"
  ADD CONSTRAINT "imported_pmd_safety_floor_events_imported_pmd_id_fk"
  FOREIGN KEY ("imported_pmd_id")
  REFERENCES "public"."imported_pmd"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "imported_pmd_safety_floor_events_pmd_uniq"
  ON "imported_pmd_safety_floor_events" USING btree ("imported_pmd_id");
