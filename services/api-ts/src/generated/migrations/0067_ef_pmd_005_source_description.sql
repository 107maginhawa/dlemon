-- EF-PMD-005: Add source_description to imported_pmd for audit trail data provenance.
-- MODULE_SPEC §7.2 item 5 requires the originating software system to be identified
-- (e.g. "Open Dental v21.1", "Dentrix G7") on every imported PMD row.
ALTER TABLE "imported_pmd" ADD COLUMN "source_description" text;
--> statement-breakpoint
-- Back-fill existing rows with a sentinel so the NOT NULL constraint below is satisfied.
UPDATE "imported_pmd" SET "source_description" = 'unknown (pre-EF-PMD-005)' WHERE "source_description" IS NULL;
--> statement-breakpoint
ALTER TABLE "imported_pmd" ALTER COLUMN "source_description" SET NOT NULL;
