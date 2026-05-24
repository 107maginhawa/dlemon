<!-- oli-version: 1.0 | generated: 2026-05-24 | skill: oli-ui-blueprint --blueprint --all -->

# Interaction States — dental-org

| State | Dashboard | Staff List | Invite Dialog | Fee Schedule | Branch Settings | Audit Log |
|-------|-----------|------------|---------------|--------------|-----------------|-----------|
| Loading | Skeleton ×4 cards | Skeleton rows | — | Skeleton rows | Skeleton form | Skeleton rows |
| Empty | — | "No staff yet" | — | "No CDT codes" | — | "No events" |
| Loaded | Stats visible | Table visible | Form ready | Table visible | Form visible | Table visible |
| Error | Alert + retry | Alert + retry | Field errors | Alert + retry | Validation errors | Alert + retry |
| Saving | — | Row spinner | Button spinner | Cell spinner | Button spinner | — |
| Success | — | Toast | Toast + close | Toast | Toast | — |
| Permission denied | Associate = limited stats | N/A (owner only) | N/A | N/A | N/A | N/A |
| Not found | — | — | — | — | — | — |
| Offline | Banner | Banner | Disabled submit | Disabled edit | Disabled submit | Banner |

**Completeness score: 9/9 states covered**
