-- Self-service clinic onboarding (splendid-roaming-kitten).
--
-- 1) status hook column (PHI go-live gating). Self-service onboarding writes
--    'provisional'; admin/seed provisioning and all existing rows default to 'live'.
--    Stored as plain text (not a pg enum) so the value is safe to reference in the
--    partial-index predicate below within drizzle-orm's single-transaction migrator
--    (a freshly-added enum value cannot be referenced in the same tx — 55P04).
--    NOTE: nothing enforces on this column yet — enforcement is a designed fast-follow.
ALTER TABLE "dental_organization" ADD COLUMN "status" text DEFAULT 'live' NOT NULL;--> statement-breakpoint

-- 2) One ACTIVE self-service org per owner — the race-safe abuse control behind the
--    /dental/onboarding endpoint (the app-level pre-check is the friendly path; this
--    partial UNIQUE index is the load-bearing backstop against concurrent creates).
--    Scoped to the self-service tiers only: group/enterprise practices legitimately
--    own multiple orgs and are provisioned via admin/sales, so they are excluded.
--    `active` is the existing soft-delete boolean (distinct from the new `status`):
--    a soft-deleted org frees the owner to onboard again. The 'solo'/'clinic' enum
--    values predate this migration, so referencing them in the predicate is immutable
--    and 55P04-safe. drizzle cannot generate a partial index with an IN predicate, so
--    this is hand-authored (follows the 0084 gist precedent). Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS "dental_org_one_active_per_owner"
  ON "dental_organization" ("owner_person_id")
  WHERE "active" = true AND "tier" IN ('solo', 'clinic');
