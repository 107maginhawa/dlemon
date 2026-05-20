---
id: "06-02"
status: complete
completed_at: "2026-05-11"
---

# 06-02 Summary: Add imagingTier to dental organization schema

## Files Modified

- `services/api-ts/src/handlers/dental-org/repos/organization.schema.ts`
  - Added `imagingTierEnum` pgEnum ('free' | 'basic' | 'addon') after `orgTierEnum`
  - Added nullable `imagingTier` column to `dentalOrganizations` table after `active`
  - Added `VALID_IMAGING_TIERS`, `ImagingTier` type, and `resolveImagingTier()` helper

## Migration File

`services/api-ts/src/generated/migrations/0018_cloudy_sway.sql`

Migration contains:
```sql
CREATE TYPE "public"."imaging_tier" AS ENUM('free', 'basic', 'addon');
ALTER TABLE "dental_organization" ADD COLUMN "imaging_tier" "imaging_tier";
```

## Verification Results

| Check | Result |
|-------|--------|
| `imagingTierEnum` present in schema | PASS |
| `ImagingTier` type exported | PASS |
| `resolveImagingTier()` helper exported | PASS |
| Migration SQL contains `imaging_tier` enum create | PASS |
| Migration SQL contains `ALTER TABLE` column add | PASS |
| `bun run typecheck` | PASS (0 errors) |

## Notes

- Column is nullable (no `.notNull()`) — NULL is treated as 'free' via `resolveImagingTier()`
- Migration will run automatically on next server start (no manual `db:migrate` needed)
- Column is not API-exposed at this phase — internal use by imaging handlers only
