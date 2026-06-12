-- MIGRATION-SAFETY: populated-DB-safe add of a NOT NULL column.
-- The original form `ADD COLUMN "source_description" text NOT NULL` (no DEFAULT) failed
-- to boot any environment that had recorded an imported_pmd row before this migration
-- (Postgres 23502 on ATRewriteTable). imported_pmd was created 63 migrations earlier (0006),
-- and the import write-path was live before this column existed, so a populated table is
-- possible. The migrator runs the whole pending chain in one transaction, so that failure
-- halts every later migration too — a forward-only fix cannot rescue it. Rewritten to the
-- safe 3-step: add nullable -> backfill existing rows -> SET NOT NULL. End state is identical
-- (source_description NOT NULL) and the snapshot is unchanged. Guarded by
-- imported-pmd-0069-migration-safety.test.ts. See docs/aha/outputs/EXECUTION-TODO.md (Track 1).
ALTER TABLE "imported_pmd" ADD COLUMN IF NOT EXISTS "source_description" text;
--> statement-breakpoint
UPDATE "imported_pmd" SET "source_description" = 'Imported before provenance tracking' WHERE "source_description" IS NULL;
--> statement-breakpoint
-- MIGRATION-SAFETY: the UPDATE above backfilled every existing row, so SET NOT NULL holds on a populated table (no 23502); safe on both fresh (0 rows) and populated installs.
ALTER TABLE "imported_pmd" ALTER COLUMN "source_description" SET NOT NULL;
