# PRD Index Draft

> AHA prompt **01** output. Companion to `./DOCS_INVENTORY.md` and
> `../migration-plans/DOCS_MIGRATION_PLAN.md`.
>
> **Re-derived against the prompt's classification schema.** Not a replacement
> for `docs/product/prd/PRD_INDEX.md` (which is the canonical living index).
> Use this draft to validate that the canonical index agrees with this prompt's
> §5 classification rules.

## Active PRD Candidates

> All Memberry product modules use a two-layer pattern (product-module spec
> at `docs/product/modules/m{NN}-*/MODULE_SPEC.md` + handler-tier spec at
> `docs/product/MODULE_SPEC.*.md`). Both layers are canonical for their own
> audience. See `docs/README.md` "Per-module specs" section.

### Master PRD

| Module / Feature | Current File | Suggested Canonical Path | Confidence | Notes |
|---|---|---|---:|---|
| Memberry (root) | `docs/product/MASTER_PRD.md` | `docs/product/MASTER_PRD.md` (stay) | 1.0 | Cross-module foundation; referenced by every nested module spec |

### Product-module tier (×22, nested)

| Module | Current File | Suggested Canonical Path | Confidence | Notes |
|---|---|---|---:|---|
| m01 Auth & Onboarding | `docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md` | stay | 1.0 | Co-located with API_CONTRACTS, NAVIGATION_MAP, ui-prototype/* |
| m02 Member Profile | `docs/product/modules/m02-member-profile/MODULE_SPEC.md` | stay | 1.0 | |
| m03 Platform Admin | `docs/product/modules/m03-platform-admin/MODULE_SPEC.md` | stay | 1.0 | |
| m04 Org Admin | `docs/product/modules/m04-org-admin/MODULE_SPEC.md` | stay | 1.0 | |
| m05 Membership | `docs/product/modules/m05-membership/MODULE_SPEC.md` | stay | 1.0 | |
| m06 Dues & Payments | `docs/product/modules/m06-dues-payments/MODULE_SPEC.md` | stay | 1.0 | |
| m07 Communications | `docs/product/modules/m07-communications/MODULE_SPEC.md` | stay | 1.0 | |
| m08 Events | `docs/product/modules/m08-events/MODULE_SPEC.md` | stay | 1.0 | |
| m09 Training | `docs/product/modules/m09-training/MODULE_SPEC.md` | stay | 1.0 | |
| m10 Credit Tracking | `docs/product/modules/m10-credit-tracking/MODULE_SPEC.md` | stay | 1.0 | |
| m11 Documents & Credentials | `docs/product/modules/m11-documents-credentials/MODULE_SPEC.md` | stay | 1.0 | |
| m12 Elections & Governance | `docs/product/modules/m12-elections-governance/MODULE_SPEC.md` | stay | 1.0 | |
| m13 Professional Feed | `docs/product/modules/m13-professional-feed/MODULE_SPEC.md` | stay | 1.0 | |
| m14 National Dashboard | `docs/product/modules/m14-national-dashboard/MODULE_SPEC.md` | stay | 1.0 | |
| m15 Job Board | `docs/product/modules/m15-job-board/MODULE_SPEC.md` | stay | 1.0 | |
| m16 Advertising | `docs/product/modules/m16-advertising/MODULE_SPEC.md` | stay | 1.0 | |
| m17 Marketplace | `docs/product/modules/m17-marketplace/MODULE_SPEC.md` | stay | 1.0 | |
| m18 Surveys & Polls | `docs/product/modules/m18-surveys-polls/MODULE_SPEC.md` | stay | 1.0 | |
| m19 Committee Management | `docs/product/modules/m19-committee-management/MODULE_SPEC.md` | stay | 1.0 | |
| m20 Booking | `docs/product/modules/m20-booking/MODULE_SPEC.md` | stay | 1.0 | No short-form `m20-booking.md` exists |
| m21 Billing | `docs/product/modules/m21-billing/MODULE_SPEC.md` | stay | 1.0 | No short-form exists |
| m22 Email | `docs/product/modules/m22-email/MODULE_SPEC.md` | stay | 1.0 | No short-form exists |

### Handler tier (×16, flat at `docs/product/`)

> Per `docs/DOCS_CLEANUP_REPORT.md` and `docs/README.md`: these are **engineering-product hybrid** specs written from source inspection, granular per backend-handler directory. Two-layer-by-design — both tiers canonical at their own audience.

| Handler dir / domain | Current File | Suggested Canonical Path | Confidence | Notes |
|---|---|---|---:|---|
| association:operations | `docs/product/MODULE_SPEC.association_operations.md` | stay | 0.95 | Owns m05+m10+m11+m12+m19 product-module spec content per `CLAUDE.md` |
| audit | `docs/product/MODULE_SPEC.audit.md` | stay | 0.95 | |
| dues | `docs/product/MODULE_SPEC.dues.md` | stay | 0.95 | |
| invite | `docs/product/MODULE_SPEC.invite.md` | stay | 0.95 | |
| marketplace | `docs/product/MODULE_SPEC.marketplace.md` | stay | 0.95 | |
| member.certificates | `docs/product/MODULE_SPEC.member.certificates.md` | stay | 0.95 | |
| member.chapters | `docs/product/MODULE_SPEC.member.chapters.md` | stay | 0.95 | |
| member.credentials | `docs/product/MODULE_SPEC.member.credentials.md` | stay | 0.95 | |
| member.credits | `docs/product/MODULE_SPEC.member.credits.md` | stay | 0.95 | |
| member.directory | `docs/product/MODULE_SPEC.member.directory.md` | stay | 0.95 | |
| member.dues-special-assessments | `docs/product/MODULE_SPEC.member.dues-special-assessments.md` | stay | 0.95 | |
| member.governance | `docs/product/MODULE_SPEC.member.governance.md` | stay | 0.95 | |
| member.membership | `docs/product/MODULE_SPEC.member.membership.md` | stay | 0.95 | |
| notifs | `docs/product/MODULE_SPEC.notifs.md` | stay | 0.95 | |
| reviews | `docs/product/MODULE_SPEC.reviews.md` | stay | 0.95 | |
| storage | `docs/product/MODULE_SPEC.storage.md` | stay | 0.95 | |

### Cross-cutting foundation docs (Master-PRD adjacent)

| Doc | Current File | Suggested Canonical Path | Confidence | Notes |
|---|---|---|---:|---|
| Domain model | `docs/product/DOMAIN_MODEL.md` | stay | 0.95 | 1897 LOC — load-bearing |
| Workflow map | `docs/product/WORKFLOW_MAP.md` | stay | 0.95 | |
| State machines | `docs/product/STATE_MACHINES.md` | stay | 0.95 | |
| Domain glossary | `docs/product/DOMAIN_GLOSSARY.md` | stay | 0.95 | |
| Module map | `docs/product/MODULE_MAP.md` | stay | 0.95 | |
| Role/permission matrix | `docs/product/ROLE_PERMISSION_MATRIX.md` | stay | 0.95 | |
| Error taxonomy | `docs/product/ERROR_TAXONOMY.md` | stay | 0.95 | |
| Event contracts | `docs/product/EVENT_CONTRACTS.md` | stay | 0.95 | |
| Audit contracts | `docs/product/AUDIT_CONTRACTS.md` | stay | 0.95 | |
| Data governance | `docs/product/DATA_GOVERNANCE.md` | stay | 0.95 | |
| Disaster recovery | `docs/product/DISASTER_RECOVERY.md` | stay | 0.85 | Borderline runbook — consider `docs/runbooks/` someday |
| Observability | `docs/product/OBSERVABILITY.md` | stay | 0.85 | |
| Performance | `docs/product/PERFORMANCE.md` | stay | 0.85 | |
| Threat model | `docs/product/THREAT_MODEL.md` | stay | 0.85 | |
| UI blueprint | `docs/product/UI_BLUEPRINT.md` | stay | 0.9 | |
| UI consistency spec | `docs/product/UI_CONSISTENCY_SPEC.md` | stay | 0.9 | |
| Navigation map | `docs/product/NAVIGATION_MAP.md` | stay | 0.9 | |
| Seed manifest | `docs/product/SEED_MANIFEST.md` | stay | 0.9 | |
| API conventions | `docs/product/API_CONVENTIONS.md` | stay | 0.85 | Hybrid product/engineering |

## Historical PRD Candidates

| Module / Feature | Current File | Suggested Historical Path | Reason | Notes |
|---|---|---|---|---|
| _none currently_ | — | — | `docs/ver-3/` is still authoritative per `CONTRIBUTING.md:2456,2472`. Not historical yet. | Do not pre-archive `ver-3/` |

> **Future signal:** when a v4 PRD lands at `docs/product/MASTER_PRD.md`
> and `ver-3/` is explicitly decommissioned, move the entire `ver-3/` tree to
> `docs/product/prd/historical/ver-3/`. **Not now.**

## Supporting Requirement Files

| Area | Current File / Pattern | Type | Suggested Path | Notes |
|---|---|---|---|---|
| Per-module navigation | `docs/product/modules/m*/NAVIGATION_MAP.md` (×23) | IA spec | stay | Co-located with module PRD |
| Per-module UI prototype | `docs/product/modules/m*/ui-prototype/{components,screens,interaction-states,mock-data}.md` (×76) | UX spec | stay | |
| Per-screen UX spec (member) | `docs/ver-3/ux/screens/member/*.md` (~17) | UX spec | stay | |
| Per-screen UX spec (officer) | `docs/ver-3/ux/screens/officer/*.md` (~25) | UX spec | stay | |
| Per-screen UX spec (platform-admin) | `docs/ver-3/ux/screens/platform-admin/*.md` (~26) | UX spec | stay | |
| Per-screen UX spec (org-member, public, auth) | `docs/ver-3/ux/screens/{auth,public,org-member}/*.md` | UX spec | stay | |
| Business rules registry | `docs/ver-3/business/br-registry.json` | Test registry | stay | Read by `scripts/br-coverage.ts`, `testing/registry/report.ts`, `docs/project-map/generate.ts` |
| Business rules (prose) | `docs/ver-3/business/business-rules.md` | Supporting requirement | stay | |
| Personas / roles | `docs/ver-3/business/personas-and-roles.md` | Supporting requirement | stay | Read by `docs/project-map/generate.ts:30` |
| Cross-cutting business rules | `docs/ver-3/business/cross-cutting.md` | Supporting requirement | stay | |
| Metrics | `docs/ver-3/business/metrics.md` | Supporting requirement | stay | |
| Roadmap (v3) | `docs/ver-3/business/roadmap.md` | Supporting requirement | stay | |
| Business context | `docs/ver-3/business/context.md` | Supporting requirement | stay | |
| Per-module business briefs | `docs/ver-3/business/modules/README.md` | Supporting requirement | stay | |
| Wave UX plans | `docs/ver-3/plans/{finances-ux-overhaul,wave5-governance-ux-audit}.md` | Supporting requirement (UX plan) | stay | `ux-inspiration-queue.md` flagged as superseded — see "Needs Review" |
| UX interaction patterns / states / navigation / screen-inventory | `docs/ver-3/ux/{interaction-patterns,states,navigation,screen-inventory}.md` | Supporting requirement | stay | |
| Module short-form overviews | `docs/product/modules/m{01..19}-*.md` (×19) | Supporting requirement (overview) | `[NEEDS REVIEW]` — see below | Pattern is inconsistent (m20–m22 missing) |
| Wave/slice scope docs | `docs/quality/REMAINING_SCOPE.md`, `docs/quality/SCOPE.*.md`, `docs/quality/R{0..5}_*_SCOPE.md` | Audit-derived requirement | stay in `docs/quality/` | Per prompt §5.5 |
| Design (v3) | `docs/ver-3/DESIGN.md` | Supporting requirement (design) | stay | |
| Master PRD index | `docs/product/prd/PRD_INDEX.md` | Index | stay | Canonical living index |

## Engineering Specs Mistaken for PRDs

| File / Pattern | Reason Not PRD | Suggested Category |
|---|---|---|
| `docs/architecture/adr/000{0..10}-*.md` (11) | Architecture Decision Records — engineering rationale | Architecture |
| `docs/architecture/COMMS-CONSOLIDATION.md` | Engineering consolidation note | Architecture |
| `docs/product/modules/m*/API_CONTRACTS.md` (×22) | Wire-level API spec, not product requirements | Engineering / API spec (co-located by design) |
| `docs/execution/VERTICAL_SLICE_PLAN.md` + `WAVE*_VERTICAL_SLICE_PLAN.md` (×6) | Engineering execution plan | Engineering |
| `docs/execution/slices/*/SLICE_SPEC.md` (×13) | Per-slice engineering brief | Engineering |
| `docs/execution/slices/*/TDD_PROOF.md` (×17) | Engineering test-proof artifact | Engineering / quality |
| `docs/quality/MODULE_SPEC_TEMPLATE.md`, `docs/quality/MODULE_SPEC_HANDOFF.md` | Spec templates / handoff notes | Engineering / quality |
| `docs/quality/SCORECARD.md`, `CONTRACT_COVERAGE.{md,json}`, `E2E_DEPTH_AUDIT.{md,json}`, `OBSERVABILITY_AUDIT.{md,json}`, `SDK_BASELINE_OPS.json`, `RECON_BASELINE.{md,fe-matrix.json}`, `HAND_WIRED_ROUTES.yaml` | Engineering / CI ratchet artifacts | Engineering / quality |
| `docs/quality/MEGA_MODULE_DECISION.md` | Engineering decision | Engineering / quality |
| `docs/quality/WAVE_3_5_2_INVESTIGATION.md` | Engineering investigation note | Engineering / quality |
| `docs/quality/{CONTRACT_COVERAGE_HANDOFF,E2E_DEPTH_HANDOFF,OBSERVABILITY_HANDOFF}.md` | Engineering handoff notes | Engineering / quality |
| `docs/quality/deferred-tests.md` | Engineering test backlog | Engineering / quality |
| `docs/security/security-quickscan.json`, `migrations-audit.json`, security audit md | Engineering security artifacts | Engineering / security |
| `docs/audits/MULTI-TENANT-AUDIT.md`, `docs/audits/domain-graph/DOMAIN_OVERVIEW.md` | Engineering audit | Audit |
| `docs/workflow/SUPERPOWERS_FLOW.md` | Engineering workflow | Engineering |
| `docs/ver-3/{EXECUTION-CHECKLIST,GAP-BACKLOG,HANDLER-MODULE-MAP,plan,manifest}.md` | Engineering execution / mapping artifacts living inside the versioned bucket | Engineering (but stay in `ver-3/` for cohesion) |

## Audit-derived Requirements (separate tier — per §5.5)

| File | Suggested Path |
|---|---|
| `docs/quality/SCOPE.membership.md` | stay in `docs/quality/` |
| `docs/quality/SCOPE.dues-special-assessments.md` | stay |
| `docs/quality/SCOPE.certificates.md` | stay |
| `docs/quality/SCOPE.credits.md` | stay |
| `docs/quality/R0_BASELINE.md` | stay |
| `docs/quality/R1_CHAPTERS_SCOPE.md` | stay |
| `docs/quality/R2_GOVERNANCE_SCOPE.md` | stay |
| `docs/quality/R3_CREDENTIALS_SCOPE.md` | stay |
| `docs/quality/R4_DIRECTORY_SCOPE.md` | stay |
| `docs/quality/R5_ELECTIONS_SCOPE.md` | stay |
| `docs/quality/R5_OFFICERS_SCOPE.md` | stay |
| `docs/quality/REMAINING_SCOPE.md` | stay |
| `docs/audits/MULTI-TENANT-AUDIT.md` | stay |
| `docs/audits/domain-graph/DOMAIN_OVERVIEW.md` | stay |

> Per prompt §5.5: do NOT promote any of these into a canonical PRD folder
> unless explicitly promoted by product.

## Needs Review

| File | Reason | Suggested Action |
|---|---|---|
| `docs/product/modules/m01-auth-onboarding.md` … `m19-committee-management.md` (×19) | Short-form module overview pages exist for m01–m19 but NOT for m20-booking, m21-billing, m22-email. Inconsistent pattern. Possibly duplicate of nested `MODULE_SPEC.md`. | Decide canonical pattern → either backfill m20–m22 or delete all 19 |
| `docs/aha/copy.md` | Filename suggests scratch; no inbound references found | Confirm intent with author; archive candidate |
| `docs/ver-3/plans/ux-inspiration-queue.md` | Auto-memory marks "SUPERSEDED by strategic upgrade plan" but file is still tracked | Confirm supersedence; archive candidate |
| `CONTRIBUTING.md:146` → `docs/audits/SANITY_CHECK.md` | File not present in tree | Either restore file or remove the reference (handoff to prompt 04) |
| `CONTRIBUTING.md:2454` → `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` | File not present | Same |
| `scripts/ui-consistency-detect.ts:68,163` → `docs/audits/PATTERNS.lock.md` | File not present | Same — confirm if script still active |
| `docs/product/{OBSERVABILITY,PERFORMANCE,THREAT_MODEL,DISASTER_RECOVERY}.md` | Borderline runbook/engineering content sitting inside `docs/product/` | Consider whether a future `docs/runbooks/` bucket would better host them; not urgent |
| Flat vs nested `MODULE_SPEC.*` confusion risk | Both layers are canonical but humans new to the repo see "duplicates" | Add a 2-line note at the top of each flat `MODULE_SPEC.*.md` pointing to the nested product spec, and vice-versa |
