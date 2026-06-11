# AHA Module & Audit Batch Index

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/01-platform-discovery-audit-index.md`

## 1. Discovery Summary

**Code areas inspected:** `services/api-ts/src/handlers/` (27 handler modules), `apps/dentalemon/src/` (16 feature dirs, 4 route groups: `_dashboard`/`_workspace`/`_portal`/`auth`), `services/api-ts/src/generated/migrations/` (100 migrations, latest `0100_messy_wrecker.sql`), per-module `repos/*.schema.ts`, `specs/api/` (TypeSpec + generated OpenAPI), `packages/sdk-ts/`, `services/cadence/` + `services/api-ts-embedded/` (offline/Tauri layer), test trees (backend unit, contract Hurl, FE unit, Playwright E2E).

**Docs/specs inspected:** `docs/prd/` (PRD_INDEX, v3-dentalemon.md canonical PRD, BUSINESS_RULES.md BR-001..048, ACCEPTANCE_CRITERIA.md), `docs/product/` (21 engineering-spec files incl. MODULE_MAP, WORKFLOW_MAP, DOMAIN_MODEL, ROLE_PERMISSION_MATRIX + `modules/` with 14 per-module spec dirs), `docs/context/` (7 reference docs incl. ceph PRD, imaging guide, charting research guide, workspace reference spec), `docs/clinical/STANDARDS_COMPLIANCE.md`.

**Prior audit artifacts inspected (heavily reused — this is a previously-audited codebase):**
- `docs/audits/MODULE_AUDIT_TRACKER.md` — 15-module adversarial deep audit (2026-06-08): 14 READY / 1 honest-GAPS (dental-portal) / 0 BLOCKED; 8 real behavioral bugs found+fixed; ~40 adversarial test pins added.
- `docs/audits/MASTER-GAP-MATRIX.md` — 19 module gap-plans consolidated (2026-06-09): 2 P0 (both FIXED), 36 P1, 47 P2, 41 P3; Batches 1–4 IMPLEMENTED; Batch 5+ open. Dominant gap class = **orphan endpoint** (built+tested backend, zero FE consumer).
- `docs/audits/modules/` — 15 per-module audit reports (2026-06-08); `docs/audits/module-gap-plans/` — 19 source gap plans. **These are pre-AHA artifacts; AHA outputs stay separate under `docs/aha/` per shared rules §1.**
- Post-matrix work already landed on this branch (2026-06-09→10): offline-sync chain complete (localId idempotency, clock-aware LWW, conflict persistence), 4 dental-charting P0 slices, ceph report version-pinning, SL-03/05/08 slices, visit-lifecycle/chart living-doc work. Several MASTER-GAP-MATRIX rows are therefore already ✅-annotated in place.

**Tests inspected (counts):** ~327 backend test files (`services/api-ts/src/**/*.test.ts`), 48 contract files (`specs/api/tests/contract/`), ~250 FE test files, 82 Playwright E2E specs (`apps/dentalemon/tests/e2e/`), backend e2e dirs (~15 base-module groups).

**KG:** used existing graph — see §2. **`/understand-domain`:** existing 2026-06-08 output used as cross-check — see §3. **Webwright/Playwright:** NOT run for this discovery pass — route/journey coverage was already established by the prior live-drive gap plans (every module gap-plan included a webwright drive and/or static wiring map ≤2 days old); re-driving the app adds no discovery-level information. Runtime evidence will be gathered per-module in prompt 02 where needed.

**Limitations:** (1) Findings inherited from prior audits are cross-referenced, not re-verified line-by-line — prompt 02 re-verifies per module. (2) Some matrix rows may already be fixed by the 2026-06-10 slice work; status marked `[NEEDS CONFIRMATION]` where unverified. (3) Tauri/cadence runtime sync is a known stub (`apps/account/src-tauri/src/sync.rs`) — not driveable end-to-end.

## 2. Knowledge Graph Status

| Item | Status | Notes |
| --- | --- | --- |
| Existing KG found | Yes | `.understand-anything/knowledge-graph.json` (4.4 MB) + `contract-spine.json` (357 ops → handler → SDK → FE-consumer) + `domain-graph.json` |
| KG tool/source | understand-anything 2.7.6 | contract-spine regenerated 2026-06-10 |
| KG appears fresh | Partially | Node graph baseline 2026-06-06; drift = type-import edges only. Contract-spine fresh. |
| KG refreshed or regenerated | No | Deliberate — full regen ≈12M tokens for marginal value (prior measured decision) |
| Regeneration needed | No | Use contract-spine for wiring; ground-truth in source |
| Missing areas | Known under-modeling: no `emr` node, phantom routes, bulk-import/FHIR bridge/retention unmodeled | Listed in status file |
| KG status file saved | Yes | `docs/aha/kg/knowledge-graph-status.md` |

## 3. Domain Knowledge Status

| Item | Status | Notes |
| --- | --- | --- |
| `/understand-domain` available | Yes | Output at `.understand-anything/domain-graph.json` (15 domains, 2026-06-08) |
| Domain graph/output used | Yes | Cross-check only; curated docs are richer |
| Domain output appears sufficient | Yes | Supplemented by `docs/product/DOMAIN_MODEL.md`, `WORKFLOW_MAP.md`, `ROLE_PERMISSION_MATRIX.md`, PRD §6 |
| Domain output refreshed or regenerated | No | Boundaries unchanged since 2026-06-08 |
| Missing or unclear domain areas | case-presentation ownership; emr-consultation relabel status; external-records-import Phase-3+ | See status file |
| Domain status file saved | Yes | `docs/aha/kg/domain-knowledge-status.md` |

## 4. PRD / Spec Inventory

| Product Reference | Path | Type | Related Module/Group | Related Module Slug | Appears Current? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| v3 PRD (canonical) | `docs/prd/v3-dentalemon.md` | PRD | whole platform | — | Yes | Single authoritative PRD (vision, personas, MVP scope, §6 feature areas, §8 NFR, §11 entities) |
| PRD index | `docs/prd/PRD_INDEX.md` | index | whole platform | — | Yes | Two-layer pattern: prd/ = what+why, product/ = engineering layer |
| Business rules | `docs/prd/BUSINESS_RULES.md` | business rules | all modules | — | Yes | BR-001..048; load-bearing (consumed by `scripts/audit-traceability.ts` + `br-registry.json` + tests) |
| Acceptance criteria | `docs/prd/ACCEPTANCE_CRITERIA.md` | acceptance criteria | all modules | — | Yes | Given/When/Then gates; load-bearing |
| Design rationale | `docs/prd/context/design-doc.md` | design narrative | whole platform | — | Yes | v2→v3 narrative, APPROVED 2026-05-01 |
| Wireframes | `docs/prd/context/wireframes/` (28 HTML) | UI prototypes | all FE modules | — | Yes | Referenced by UI_CONSISTENCY_SPEC |
| Module map | `docs/product/MODULE_MAP.md` | architecture map | all modules | — | Stale / Needs Confirmation | Marked [DRAFT] 2026-05-24; M-numbering current but handler counts drifted (e.g. dental-perio absent as M-row) `[NEEDS CONFIRMATION]` |
| Workflow map | `docs/product/WORKFLOW_MAP.md` | workflow spec | all modules | — | Yes | 33 KB; reconciled repeatedly during 2026-06-08 audit series |
| Domain model | `docs/product/DOMAIN_MODEL.md` | data model | all modules | — | Stale / Needs Confirmation | Flagged NEEDS-REVIEW during 2026-06-11 docs cleanup |
| Role/permission matrix | `docs/product/ROLE_PERMISSION_MATRIX.md` | RBAC spec | auth-rbac | auth-rbac | Stale / Needs Confirmation | Flagged NEEDS-REVIEW during 2026-06-11 docs cleanup |
| Per-module specs (14 dirs) | `docs/product/modules/<module>/MODULE_SPEC.md` + `API_CONTRACTS.md` | module specs | per module | per module | Yes | dental-audit, dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit, emr-consultation, external-records-import, legal-hold, retention. Reconciled per-module on 2026-06-08. **No spec dir for: provider, dental-portal, dental-erasure (anchor absent), case-presentation, notifs.** |
| UI consistency spec | `docs/product/UI_CONSISTENCY_SPEC.md` + `UI_CONVENTIONS.md` + `SHARED_COMPONENTS.md` | UI standard | shared-ui | shared-ui-workspace-shell | Yes | |
| Threat model | `docs/product/THREAT_MODEL.md` | security spec | auth-rbac | auth-rbac | Unknown | Use in cross-cutting audit (prompt 05) |
| Seed manifest | `docs/product/SEED_MANIFEST.md` | test plan / seed | test-infrastructure | test-infrastructure | Unknown | |
| Ceph tracing PRD | `docs/context/CEPH_TRACING_MODULE_PRD_AND_IMPLEMENTATION_GUIDE.md` | PRD (module) | dental-imaging | dental-imaging | Yes | Plus reconciliation: `docs/reviews/research/ceph-guide-reconciliation.md` (guide *undershoots* current module) |
| Imaging/ceph guide | `docs/context/DENTAL_IMAGING_AND_MANUAL_CEPH_..._UPDATED.md` | ideal-standard document | dental-imaging | dental-imaging | Stale / Needs Confirmation | Reconciled 2026-06-10; 6 known gaps, G2 (report version-pinning) already shipped |
| Charting research guide | `docs/context/DENTALEMON_V1_DENTAL_CHARTING_RESEARCH_GUIDE.md` | ideal-standard document | dental-visit | dental-visit | Stale / Needs Confirmation | External guide over-estimated gaps; reconciliation at `docs/audits/dental-charting/CHARTING_RESEARCH_RECONCILIATION.md`; 4 P0 slices shipped 2026-06-10 |
| Workspace reference spec | `docs/context/DENTALEMON-DENTAL-WORKSPACE-REFERENCE-SPEC.md` | workflow spec | dental-visit + workspace shell | dental-visit | Yes | Drove the workspace-workflow slices (SL-01..12) |
| Ideal module workflow standard | `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` | ideal-standard document | all dental modules | — | Unknown | Useful rubric for prompt 02 use-case completeness |
| Personas | `docs/context/personas.md` | personas | whole platform | — | Yes | |
| Clinical standards compliance | `docs/clinical/STANDARDS_COMPLIANCE.md` | regulatory constraints | dental-perio, dental-imaging | dental-perio | Yes | AAP/EFP 2017; **binding non-goals: no-AI, offline-first** — do not propose AI features |
| Module audit tracker | `docs/audits/MODULE_AUDIT_TRACKER.md` | prior audit (pre-AHA) | all modules | — | Yes | 2026-06-08 series; treat as evidence input, not AHA output |
| Master gap matrix | `docs/audits/MASTER-GAP-MATRIX.md` | prior gap consolidation (pre-AHA) | all modules | — | Yes (partially superseded) | Batches 1–4 done; some open rows since closed by 2026-06-10 slices `[NEEDS CONFIRMATION]` per row |

## 5. PRD / Spec Coverage by Module

| Module/Group | Module Slug | PRD/Spec Coverage | Primary Product References | Missing Product Detail | Risk | Label |
| --- | --- | --- | --- | --- | --- | --- |
| Dental Org & Staff | dental-org | Strong | PRD §6.6/§11.1; `docs/product/modules/dental-org/` | invite-flow vs direct-PIN divergence (matrix G4) | Medium | — |
| Dental Patient | dental-patient | Strong | PRD §6.2/§11.2; `modules/dental-patient/` | insurance/claims source-of-truth decision | High | `[NEEDS PRODUCT DECISION]` (claims vertical) |
| Dental Visit & Charting | dental-visit | Strong | PRD §6.1/§3/§4; `modules/dental-visit/`; workspace reference spec; charting reconciliation | carry-over UX details | High | — |
| Dental Scheduling | dental-scheduling | Strong | PRD §6.3; `modules/dental-scheduling/` | — | Medium | — |
| Dental Billing | dental-billing | Strong | PRD §6.4/§8.4/§11.3; `modules/dental-billing/`; BR-010..015 | recordedByMemberId server-validation decision | High | `[NEEDS PRODUCT DECISION]` (1 item) |
| Dental Clinical | dental-clinical | Strong | PRD §6.1 clinical tabs; `modules/dental-clinical/` | consent-revocation downstream policy | High | — |
| Dental Imaging & Ceph | dental-imaging | Strong | Ceph PRD + imaging guide + `modules/dental-imaging/` + ceph reconciliation | trace-session FSM + sign-off split are product decisions | Medium | `[NEEDS PRODUCT DECISION]` (G1/G4) |
| Dental Perio | dental-perio | Strong | `modules/dental-perio/`; clinical STANDARDS_COMPLIANCE | amendment + PDF export deferred scope | Low | — |
| Dental PMD | dental-pmd | Strong | PRD §6.12 + Appendix E; `modules/dental-pmd/` | signing (JWS) + FHIR-bundle decisions | Medium | `[NEEDS PRODUCT DECISION]` (P1-1/2/5) |
| Case Presentation | case-presentation | Partial | PRD treatment-plan sections; workspace reference spec; no dedicated spec dir | single spec anchor absent | Medium | `[INFERRED]` boundary |
| Dental Portal | dental-portal | Partial | PRD portal sections; WORKFLOW_MAP WF-078 (reconciled); no MODULE_SPEC anchor | Phase-2 scope (onboarding/linking, self-booking, self-pay) | High | `[NEEDS PRODUCT DECISION]` (Phase-2) |
| Dental Audit | dental-audit | Strong | `modules/dental-audit/`; PRD §8 NFR | viewer-role widening decision (P2-C) | Medium | — |
| Data Governance (erasure/legal-hold/retention) | data-governance | Partial | `modules/legal-hold/` + `modules/retention/`; **no dental-erasure spec anchor** | who-may-erase decision; erasure FE scope | High | `[NEEDS PRODUCT DECISION]` + `[BLOCKED BY MISSING SPEC]` (erasure) |
| EMR Consultation | emr-consultation | Strong | `modules/emr-consultation/` | scope resolved 2026-06-10 as dormant-relabel + clinic-scope — verify landed | Medium | `[NEEDS CONFIRMATION]` |
| External Records Import | external-records-import | Strong | `modules/external-records-import/` | Phase-3+ by design; bulk-import row-cap decision | Low (deferred) | — |
| Provider | provider | Missing | none (tracker: "no product MODULE_SPEC") | deprecate-vs-productize decision | Medium | `[BLOCKED BY MISSING SPEC]` |
| Notifications (in-app/push) | notifications | Weak | PRD reminder mentions; no module spec | inbox/bell scope, opt-in UX | Medium | `[INFERRED]` |
| Monobase base modules | monobase-base | Weak | upstream CLAUDE/CONTRACT docs | vertical-neutral primitives; dental product intent N/A | Low | `[INFERRED]` |
| Auth / RBAC / Security | auth-rbac | Partial | ROLE_PERMISSION_MATRIX (needs-review) + THREAT_MODEL | matrix flagged NEEDS-REVIEW 2026-06-11 | High | `[NEEDS CONFIRMATION]` |
| Offline Sync & Conflicts | offline-sync | Partial | workspace reference spec (offline sections); ADRs | FE conflict-resolution UX beyond shipped P0 | High | — |
| Desktop/Tauri embedding | desktop-embedding | Weak | CLAUDE.md notes only | runtime sync integration is a known stub | Low (not shipped) | `[INFERRED]` |
| Reporting & Dashboard | reporting-dashboard | Partial | PRD reporting mentions; BIL report endpoints | report catalog completeness | Medium | `[INFERRED]` |
| API Spec & Codegen pipeline | api-spec-codegen | Strong | `specs/api/CONTRACT.md` + `IMPLEMENTING.md` | — | Medium | — |
| Shared UI / Workspace shell | shared-ui-workspace-shell | Strong | UI_CONSISTENCY_SPEC + SHARED_COMPONENTS + wireframes | — | Low | — |
| Database / Schema (global) | database-schema | Strong | DOMAIN_MODEL (needs-review) + per-module schemas | DOMAIN_MODEL flagged NEEDS-REVIEW | Medium | `[NEEDS CONFIRMATION]` |
| Test Infrastructure | test-infrastructure | Strong | VERTICAL_TDD.md, TESTING docs, SEED_MANIFEST | — | Medium | — |

## 6. PRD / Spec to Code Discovery Notes

Discovery-level mismatches only (full traceability happens per-module in prompt 02):

| PRD / Spec Area | Related Module/Group | Module Slug | Code Area Found? | Evidence | Concern | Recommended Handling |
| --- | --- | --- | --- | --- | --- | --- |
| Insurance/claims revenue cycle (PRD §6.4) | dental-billing + dental-patient | dental-billing | Partial | `ClaimsWorklist` renders but no create-claim affordance; dental-patient claim vertical dead (matrix BIL-G2, G2) | Two claim subsystems; requirement spans modules | Audit in dental-billing round; product decision on source of truth |
| V1-Required billing affordances (PRD §8.4: discount, receipt) | dental-billing | dental-billing | Partial | `applyDentalDiscount`, `getDentalPaymentReceipt` 0 FE consumers (contract-spine) | PRD-required behavior unreachable in product | First AHA module audit (see §19) |
| Right-to-erasure (GDPR/RA-10173) | data-governance | data-governance | Partial | Backend handlers exist; zero FE (matrix ER-P1-2); tenant-validation fix status post-SL-08 `[NEEDS CONFIRMATION]` | Compliance workflow undeliverable by operators | Audit as one governance group |
| Patient portal (PRD portal scope) | dental-portal | dental-portal | Partial | Phase-1 reads GREEN; no onboarding/account-linking → real patients 403 (matrix P1) | Phase-2 unscheduled | Delay until product decision (§20) |
| Telemedicine consultation notes | emr-consultation | emr-consultation | Yes (backend) / No (FE) | 6 handlers implemented; zero FE; decision = dormant-relabel | Docs may still claim `implemented` | Verify relabel landed; low-priority audit |
| External EMR bridge (FHIR/CDA) | external-records-import | external-records-import | No | `/dental/emr-import` unbuilt, Phase-3+ by design (MODULE_MAP M9) | None — intentionally absent | Do not audit for completeness against Phase-3 scope |
| Lab orders workflow (PRD clinical tabs) | dental-clinical | dental-clinical | Partial | Backend FSM complete+tested; `onLab` dead prop — no Lab button in `WorkspaceTopBar` (matrix G1) | Built backend unreachable (dead-trigger class) | Audit in dental-clinical round |
| In-app notifications | notifications | notifications | Partial | 4 endpoints + hooks, 0 consumers (matrix notifs G1) | Rows created, never surfaced | Own small audit batch |
| Provider/Practitioner entity | provider | provider | Yes (backend) | Competing with `dentalMemberships` source of truth (matrix G1); orphan handlers deleted 2026-06-08 | Code without product reference | `[NEEDS PRODUCT DECISION]` deprecate-vs-productize |
| Treatment templates | dental-visit | dental-visit | Partial | Built+seeded backend, zero FE (matrix G3) | Possible Overbuild or pending wire-up | dental-visit round |

## 7. Business / Domain Workflows

| Workflow | Actors | Main Steps | Modules/Groups Involved | Module Slugs Involved | Product Reference | Evidence | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Golden path: register → schedule → check-in → visit → chart → treat → invoice → pay | front desk, dentist, patient | registration; appointment; check-in; visit FSM; tooth chart; treatment; invoice; payment | patient, scheduling, visit, billing, org | dental-patient, dental-scheduling, dental-visit, dental-billing, dental-org | PRD §6.1–6.4; WORKFLOW_MAP | `golden_path_smoke.py` 9/9 PASS (2026-06-07); cold-start E2E | High | The core revenue chain; any break = P0 |
| Treatment plan → case presentation → e-sign accept | dentist, patient | plan versions; present; e-sign; accept links treatments + approval record | visit, patient, clinical, case-presentation | dental-visit, dental-patient, dental-clinical, case-presentation | PRD treatment-plan sections; workspace ref spec | Was the only FAIL (matrix); fixed+live-verified 2026-06-09 | High | Header-FSM canonical (decision 2026-06-10) |
| Clinical → billing handoff (treatment → line items → balance) | dentist, front desk | completed treatments → invoice lines → payment → balance | visit, billing | dental-visit, dental-billing | PRD §6.4; BR-010..015 | `clinical-billing-handoff` E2E | High | PaymentSummaryBar coherence fix 2026-06-07 |
| Offline visit sync & conflict resolution | dentist (iPad), sync engine | offline edits → localId idempotent replay → LWW merge → conflict persistence → FE resolve | offline-sync, visit, billing, patient | offline-sync, dental-visit, dental-billing, dental-patient | workspace ref spec; ADR-008 | SL-01..12 chain complete 2026-06-10; charting P0 slice A (conflict resolve UI) | High | Newest large surface; least battle-tested |
| Imaging study → ceph trace → report → finding → treatment | dentist | upload; calibrate; trace; analysis; versioned report; finding → treatment | imaging, visit | dental-imaging, dental-visit | Ceph PRD; imaging guide reconciliation | 4 ceph journeys real-API; finding→treatment slice C 2026-06-10 | Medium | Trace-session FSM + sign-off = open product decisions |
| Perio exam → staging/grading → longitudinal comparison | dentist, hygienist | chart sites; AAP/EFP stage/grade; complete; compare exams | perio, visit | dental-perio, dental-visit | STANDARDS_COMPLIANCE; `modules/dental-perio/` | multi-exam comparison shipped 2026-06-07; staging bug fixed round 6 | Low | Diagnosis-persistence gap P1-1 still open `[NEEDS CONFIRMATION]` |
| PMD export → share → import at another clinic | dentist, patient | completed visit → PMD generate → share → import → safety-floor merge | pmd, clinical, patient | dental-pmd, dental-clinical, dental-patient | PRD §6.12 + Appendix E | matrix P1-1..5: no signing, no safety-floor merge on import, viewer unreachable | High | Core portability promise materially incomplete |
| Patient portal self-view | patient | login → /portal → own appts/invoices | portal, scheduling, billing | dental-portal, dental-scheduling, dental-billing | WF-078 (reconciled) | Phase-1 reads GREEN; no onboarding path → unreachable for real patients | High | Phase-2 decision-gated |
| Erasure request → legal-hold check → anonymize → audit survives | owner/admin, compliance | request; approve; legal-hold blocks; anonymize; audit retained | data-governance, patient, person | data-governance, dental-patient | `modules/legal-hold/`, `modules/retention/` | round-11 audit: enforced+tested on 4 axes; zero FE | High | Operator UI absent (matrix ER-P1-2) |
| Staff lifecycle: onboard clinic → invite/add staff → role/PIN → permission effect | owner, staff | self-service onboarding; add member; role change; PIN gate | org, auth-rbac | dental-org, auth-rbac | PRD §6.6; ADR-007 | `staff_lifecycle` smoke tool; role-change audit pinned | Medium | invited-state divergence (matrix G4) |
| Recall/reminder → notification → patient action | system, patient | recall due → notif/email → (no inbox to see it) | notifications, scheduling, patient | notifications, dental-scheduling, dental-patient | PRD reminders | matrix notifs G1/G3: rows created, never surfaced; no opt-in UX | Medium | |

## 8. Business Modules

| Module | Module Slug | Purpose | Main Paths | Routes/Pages | APIs/Handlers | DB/Schema | Tests Found | PRD/Spec Coverage | Primary PRD/Spec | Domain Workflow Mapping | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dental Org & Staff | dental-org | Org/branches/memberships/settings/onboarding | `handlers/dental-org/` (92 files); FE `features/staff/`, `features/settings/`, `features/onboarding/` | `_dashboard` settings/staff | ~30 ops | `dental_organization`, `dental_branch`, `dental_membership` (5 schema files) | BE+contract+FE+E2E | Strong | `modules/dental-org/` | staff lifecycle, onboarding | Medium | Working-hours + fee-schedule split-brain fixed (Batch 4); open: staff-edit (G5), consent-templates (G6), multi-branch UI (G7) |
| Dental Patient | dental-patient | Patient extensions: identity, contacts, insurance, alerts, recalls, sync, treatment plans, household | `handlers/dental-patient/` (151 files, 8 sub-domains); FE `features/patients/` | `_dashboard` patients; `_workspace` | ~46 ops | `dental_patient` + 10 more schema files | BE+contract+FE+E2E | Strong | `modules/dental-patient/` | golden path; portability | High | Largest module. P0 sync-leak fixed; insurance/claims vertical decision open (G2 `[NC]`); archived-write guards (G4); many unwired sub-surfaces (G7–G11) |
| Dental Visit & Charting | dental-visit | Visit FSM, tooth chart, treatments, notes, templates, plans, carry-over | `handlers/dental-visit/` (98 files, 6 sub-domains); FE `features/workspace/` | `_workspace` | ~26 ops | `dental_visit`, `dental_treatment`, `dental_chart`, `dental_finding` + 8 schema files | BE+contract+FE+E2E (heavy) | Strong | `modules/dental-visit/` + workspace ref spec + charting reconciliation | golden path; plans; offline | High | Most product-dense. Charting P0 slices A–D + cumulative layers + carry-over shipped 2026-06-10; carry-over FE trigger (G1) + template FE (G3) open `[NEEDS CONFIRMATION]` |
| Dental Scheduling | dental-scheduling | Appointments, check-in, queue, waitlist, online booking, working hours | `handlers/dental-scheduling/` (65 files); FE `features/scheduling/` | `_dashboard` calendar | ~20 ops | `dental_appointment` + 4 schema files | BE+contract+FE+E2E | Strong | `modules/dental-scheduling/` | golden path; recalls | Medium | Cancellation UI absent (SCH-G1 P1); queue/waitlist/no-show unwired (G2/G4/G5); concurrent-layout fixed |
| Dental Billing | dental-billing | Invoices, line items, payments, plans, discounts, claims, reports | `handlers/dental-billing/` (69 files); FE `features/billing/` | `_dashboard` billing | ~25 ops | `dental_invoice`, line items, payment plans (5 schema files) | BE+contract+FE+E2E | Strong | `modules/dental-billing/` + BR-010..015 + PRD §8.4 | clinical→billing handoff | High | EM-BIL-002 cross-tenant fixed; invoice-void failClosed (SL-05). Open: discount UI (BIL-G1 P1, V1-Required), claims cycle (BIL-G2 `[NC]`), void/plan/receipt UIs (G3–G5), balance dual-source (G6) |
| Dental Clinical | dental-clinical | Rx, lab orders, consent, med history, attachments, amendments, occlusion, post-op, inventory | `handlers/dental-clinical/` (102 files, 9 sub-domains); FE in workspace sheets | `_workspace` sheets | ~27 ops | `prescription`, `lab_order`, `consent_form`, `medical_history_entry` + 11 schema files | BE+contract+FE+E2E | Strong | `modules/dental-clinical/` | consent; clinical tabs | High | Consent FSM fixed round 5. Open: Lab button dead-trigger (G1 P1), consent revoke/history (G3 P1), Rx surfacing (G4 P1), amendments list (G5) |
| Dental Imaging & Ceph | dental-imaging | Studies, annotations, ceph analyses (6), findings, CBCT, superimposition | `handlers/dental-imaging/` (90 files); FE `features/imaging/` | `_workspace` imaging tab | ~30 ops | `imaging_study`, images, teeth, annotations (3 schema files) | BE (~340KB)+contract+FE+E2E (4 real-API ceph journeys) | Strong | Ceph PRD + `modules/dental-imaging/` + reconciliation | imaging→treatment | Medium | Meets clinical standards. Ceph G2 shipped. Open: G1 trace-FSM + G4 sign-off `[NEEDS PRODUCT DECISION]`; superimposition panel unmounted (IMG-P2-1); AI-upsell contradiction (IMG-P1-1 `[NC]`) |
| Dental Perio | dental-perio | Perio charting, AAP/EFP staging/grading, longitudinal comparison | `handlers/dental-perio/` (22 files); FE perio overlay | `_workspace` perio | ~8 ops | 2 schema files | BE+contract+FE+iPad E2E | Strong | `modules/dental-perio/` + STANDARDS_COMPLIANCE | perio workflow | Low | Healthiest module. Open: diagnosis persistence (P1-1) `[NEEDS CONFIRMATION]`, risk-factor persistence (P2-2) |
| Dental PMD | dental-pmd | Portable Medical Document generate/share/import | `handlers/dental-pmd/` (22 files); FE `features/pmd/` | `_workspace` (dead `onPmd`) | ~10 ops | `pmd_document`, `imported_pmd` (1 schema file) | BE+contract+E2E (pmd-import) | Strong | `modules/dental-pmd/` + PRD Appendix E | PMD portability | Medium | Whole P1 block open: viewer unreachable (P1-3), no signing (P1-2), no safety-floor merge (P1-4), bespoke JSON not FHIR (P1-5 `[NC]`), safety floor omitted (P1-1 `[NC]`) |
| Case Presentation | case-presentation | Present plan options → patient e-sign → accept | FE `features/case-presentation/`; handlers inside dental-patient `treatment-plans/` | `_workspace` nested route | shared ops | treatment-plan tables | BE+contract+FE+live-verified | Partial | PRD plan sections; workspace ref spec | plan→accept journey | Medium | Was platform's only FAIL; fixed+verified 2026-06-09. No dedicated spec anchor `[INFERRED]` boundary |
| Dental Portal | dental-portal | Patient self-service reads (Phase-1) | `handlers/dental-portal/` (4 files); FE `features/portal/` | `_portal` | ~6 ops | reuses other tables | BE+adversarial pins | Partial | WF-078 reconciled; no spec anchor | portal self-view | High | Phase-1 GREEN but unreachable for real patients (no onboarding/linking/seed) — all `[NEEDS PRODUCT DECISION]` Phase-2 |
| EMR Consultation | emr-consultation | Telemedicine consultation notes | `handlers/emr/` (15 files) | none (no FE) | 6 ops | `consultation_note` | BE+pins; no hurl | Strong | `modules/emr-consultation/` | none (dormant) | Medium | Decision 2026-06-10: dormant-relabel + clinic-scope — verify implementation landed `[NEEDS CONFIRMATION]` |
| External Records Import | external-records-import | Bulk patient import (built) + FHIR/CDA bridge (Phase-3+, unbuilt) | bulk import in `handlers/dental-patient/`; no `/dental/emr-import` code | none | 1 op built | `emr_record` planned only | BE pins (7 adversarial) | Strong | `modules/external-records-import/` | onboarding data migration | Low | RFC-4180 fixed (Batch 3). Open: row-cap (G2 `[NC]`), import FE (G1 `[NC]`) |
| Provider | provider | Provider/Practitioner profiles (competing with memberships) | `handlers/provider/` (22 files) | none | reduced ops (orphans deleted 2026-06-08) | 2 schema files | BE+pins | Missing | none | none (EMR facade only) | Medium | `[BLOCKED BY MISSING SPEC]` + deprecate-vs-productize `[NEEDS PRODUCT DECISION]` |

## 9. Platform / Shared Groups

| Group | Group Slug | Purpose | Main Paths | Main Consumers | Tests Found | PRD/Spec Coverage | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Monobase base modules | monobase-base | person, patient(base), billing(Stripe), booking, comms, email, storage, reviews, audit(base) primitives | `handlers/{person,patient,billing,booking,comms,email,storage,reviews,audit}/` | dental modules via facades | BE e2e dirs per module | Weak (vertical-neutral upstream) | Low | Upstream-template layer; audit only when a dental workflow depends on it (storage→imaging, email→notifs) |
| Notifications | notifications | In-app/push/email notification delivery + UI | `handlers/notifs/` (9 files); FE `features/notifications/` | scheduling, billing producers | BE tests; deliveredAt drop pinned | Weak | Medium | Worth a small dedicated audit: G1 inbox, G3 opt-in UX |
| Offline Sync & Conflicts | offline-sync | localId idempotency, clock-aware LWW, conflict persistence/resolution, sync status | sync handlers in dental-patient `sync/`; `use-sync-status.ts`; conflict UI (charting slice A); `services/cadence/` (transport) | visit, treatment, invoice, chart write paths | SL-01..12 test chain + slice A FE tests | Partial | High | Newest cross-cutting capability; candidate for prompt 05 after module audits |
| API Spec & Codegen | api-spec-codegen | TypeSpec → OpenAPI → routes/validators/SDK pipeline | `specs/api/`, `services/api-ts/src/generated/`, `packages/sdk-ts/` | everything | contract suite + spec-trace (matched 352/0/0) | Strong | Medium | Drift class well-policed (oli spec-trace 2026-06-04); never edit generated files |
| Shared UI / Workspace shell | shared-ui-workspace-shell | shadcn primitives, WorkspaceTopBar, PaymentSummaryBar, DOM coherence oracles | `apps/dentalemon/src/components/` | all FE features | FE tests + coherence oracle in test-utils | Strong | Low | Dead-trigger class (onLab/onPmd) lives at this seam |
| Desktop/Tauri embedding | desktop-embedding | QuickJS-embedded api-ts + cadence P2P for offline desktop | `services/api-ts-embedded/`, `apps/account/src-tauri/` | future desktop build | cargo check green; runtime sync stub | Weak | Low | Known stub (`sync.rs` TODO); do not audit for completeness yet `[INFERRED]` |

## 10. Database / Schema Groups

| Schema Area | Schema Slug | Tables/Models | Owning Module(s) | Owning Module Slug(s) | Migrations Found | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Global schema | database-schema | ~60+ tables across 24 schema-file groups; 100 migrations (latest `0100_messy_wrecker.sql` = `dental_finding`) | all | — | 0000–0100 in `src/generated/migrations/` | migration-safety comments (18); db:setup:test flow | DOMAIN_MODEL.md (needs-review) | Medium | Single global group — audit via prompt 06 only if module audits keep surfacing schema issues. Known hot spots: audit append-only trigger, perio numeric-string coercion, conflictPayload persistence |
| Clinical core | (part of above) | visit/treatment/chart/finding/notes/plan-version tables (8 files) | dental-visit | dental-visit | yes | heavy | DOMAIN_MODEL | Medium | Offline merge semantics (LWW, monotonic status) live here |
| Patient core | (part of above) | dental_patient + 10 sub-domain tables | dental-patient | dental-patient | yes | heavy | DOMAIN_MODEL | Medium | |
| Financial | (part of above) | invoice/line/payment/plan tables (5 files) | dental-billing | dental-billing | yes | heavy | §11.3 | High | Money + tenancy |
| Governance | (part of above) | erasure/legal-hold/retention/audit-log tables | data-governance, dental-audit | data-governance | yes | 77 governance tests | modules/legal-hold, retention | Medium | Append-only enforced by trigger |

## 11. API / Integration Groups

| API Group | API Group Slug | Purpose | Main Paths | Consumers | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dental REST API | api-spec-codegen | 357 operations under `/dental/*` + base modules | `specs/api/src/modules/`, `services/api-ts/src/routes` (generated) | FE via sdk-ts (135 consumer files) | 48 contract files; schemathesis fuzz (0 real bugs 2026-06-05) | CONTRACT.md | Medium | ~92 base-primitive ops + ~122 dental FE-pending ops intentionally unconsumed (per contract-spine analysis 2026-06-06) — do NOT re-flag wholesale as orphans; per-module audits judge each |
| Stripe Connect | (defer) | base billing payments | `handlers/billing/` | not in dental V1 flow | BE e2e | upstream docs | Low | dental-billing does not use Stripe path |
| OneSignal / SMTP | (defer) | push + transactional email | `handlers/notifs/`, `handlers/email/` | notification flows | BE tests | upstream docs | Low | Audit within notifications batch |
| S3/MinIO storage | (defer) | file upload/download | `handlers/storage/` | imaging, clinical attachments | BE tests | upstream docs | Low | MinIO required for readyz (env gotcha) |

## 12. Frontend Route / Page Groups

| Route/Page Group | Route/Page Slug | Purpose | Main Paths | Related Module(s) | Related Module Slug(s) | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard shell | fe-dashboard | calendar, patients, billing, reports, settings, staff | `src/routes/_dashboard/` | scheduling, patient, billing, org | dental-scheduling, dental-patient, dental-billing, dental-org | FE + E2E | NAVIGATION_MAP | Medium | |
| Workspace (chairside) | fe-workspace | visit-centric clinical workspace: chart, imaging, perio, sheets, case presentation | `src/routes/_workspace/` | visit, clinical, imaging, perio, pmd | dental-visit, dental-clinical, dental-imaging, dental-perio, dental-pmd | FE + E2E (heavy) | workspace reference spec | High | The product's core surface |
| Patient portal | fe-portal | patient self-service | `src/routes/_portal/` | portal | dental-portal | pins only | WF-078 | High | Unreachable for real patients (no linking path) |
| Auth | fe-auth | login, onboarding entry | `src/routes/auth/` | auth-rbac, org | auth-rbac, dental-org | E2E (cold-start) | ADR-007 self-service onboarding | Medium | Post-login branching for patient→portal missing (matrix portal P1) |
| Reports | fe-reports | revenue/daily reports | `features/reports/` | billing | dental-billing | strengthened specs 2026-06-05 | PRD reporting | Medium | RevenueReport empty-bug class fixed; report catalog completeness unaudited |

## 13. Auth / RBAC / Security Groups

| Group | Group Slug | Purpose | Main Paths | Consumers | Tests Found | Product Reference | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth / RBAC / tenancy | auth-rbac | Better-Auth sessions, PIN gate, `assertBranchAccess`/`assertBranchRole` (109 files), role matrix, portal self-scoping | `handlers/shared/`, FE `lib/rbac.ts`, PIN flows | every handler + FE guard | ~40 adversarial pins (2-org denials, role-rejects, IDOR-inert) + cross-tenant sweep SL-08 | ROLE_PERMISSION_MATRIX `[NEEDS CONFIRMATION]` + THREAT_MODEL | High | All 6 security classes dispositioned 2026-06-08; permission-grid removed (Batch 4) — coarse roles are THE model. Audit as cross-cutting (prompt 05), not per-module re-litigation |

## 14. Test Infrastructure Groups

| Test Group | Test Group Slug | Purpose | Main Paths | Related Modules/Groups | Current Coverage | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Backend unit/integration | test-infrastructure | Bun tests via `scripts/test-with-db.ts` (+ inline `DATABASE_URL=...monobase_test`) | `services/api-ts/src/**/*.test.ts` (~327 files; ~3,400 tests green) | all backend | Strong | Medium | NEVER `bun test <path>` directly; never point server/contract/E2E at monobase_test |
| Contract suite | (same) | Hurl + schemathesis against live :7213 | `specs/api/tests/contract/` (48 files) | api-spec-codegen | Strong | Medium | Restart server before contract runs (stale-server masks drift) |
| FE unit | (same) | component/feature tests + DOM coherence oracle | `apps/dentalemon/src/**` (~2,200 tests green) | all FE | Strong overall; only 4/16 feature dirs have `__tests__` folders | Medium | Mock-drift class (self-consistent-fiction mocks) documented in CONTRIBUTING_FRONTEND |
| E2E / journeys | (same) | Playwright (82 specs incl. 18 journeys, iPad project) + webwright smoke tools | `apps/dentalemon/tests/e2e/` | cross-module journeys | 18/18 journeys; run ALL projects not just chromium | Medium | Known masking classes: API-only false-green specs (lab-order), mock-masked flows |
| Seed/demo data | (same) | seed-demo via HTTP, seed-supplement, per-scenario seeds | root `db:reseed`; api-ts seed scripts | all | Good; portal seed account missing (matrix) | Medium | detUuid collision gotcha documented |

## 15. Cross-Module Journeys

| Journey | Journey Slug | Modules/Groups Involved | Module Slugs Involved | Product Reference | Current Evidence | Risk | Suggested Audit Timing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Golden path (register→pay) | journey-golden-path | patient, scheduling, visit, billing, org | dental-patient, dental-scheduling, dental-visit, dental-billing, dental-org | PRD §6 | smoke 9/9 PASS; cold-start E2E | High | Continuously; re-drive after each fix batch |
| Plan → case presentation → accept | journey-case-presentation | visit, patient, clinical, case-presentation | dental-visit, dental-patient, dental-clinical, case-presentation | workspace ref spec | fixed+live-verified 2026-06-09 | High | With case-presentation audit |
| Offline edit → sync → conflict resolve | journey-offline-sync | offline-sync, visit, billing, chart | offline-sync, dental-visit, dental-billing | workspace ref spec; ADR-008 | SL chain + slice A tests; no full E2E of FE conflict resolve `[TEST GAP]` | High | Prompt 05 candidate after 2–3 module audits |
| Clinical→billing handoff | journey-clinical-billing | visit, billing | dental-visit, dental-billing | BR-010..015 | E2E exists | High | With dental-billing audit (first) |
| PMD export→import | journey-pmd-portability | pmd, clinical, patient | dental-pmd, dental-clinical, dental-patient | PRD Appendix E | import E2E exists; export viewer unreachable | High | With dental-pmd audit |
| Erasure vs legal-hold | journey-erasure-legalhold | data-governance, patient | data-governance, dental-patient | modules/legal-hold | 4-axis backend tests; no FE journey | High | With data-governance audit |
| Patient portal self-view | journey-portal | portal, auth, scheduling, billing | dental-portal, auth-rbac | WF-078 | reads pinned; journey undemoable (no seed account) | High | Delayed — Phase-2 decision (§20) |
| Imaging→finding→treatment | journey-imaging-treatment | imaging, visit | dental-imaging, dental-visit | charting reconciliation | slice C shipped 2026-06-10 with tests | Medium | With dental-imaging audit |
| Role change → permission effect | journey-role-permission | org, auth-rbac | dental-org, auth-rbac | ROLE_PERMISSION_MATRIX | role-change audit pinned; staff smoke | Medium | Prompt 05 (auth cross-cutting) |
| Recall → notification → patient | journey-recall-notification | scheduling, notifications, patient | dental-scheduling, notifications, dental-patient | PRD reminders | no inbox; cannot complete | Medium | With notifications audit |

## 16. Suggested Audit Order

Rationale: prior 15-module audit + gap matrix already cleared security classes; AHA value-add is **V1 workflow completeness vs PRD** (the orphan-endpoint / dead-trigger / unreachable-workflow classes) per module, with fresh re-verification of what the 2026-06-10 slices already closed. Order = (money/PHI risk × PRD-required unbuilt affordances × no pending product decision) first.

| Order | Module/Group | Module Slug | Type | Risk | PRD/Spec Coverage | Why This Order | Recommended Prompt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Dental Billing | dental-billing | Business Module | High | Strong | Money+PHI; PRD §8.4 V1-Required affordances still unwired (discount BIL-G1, receipt BIL-G5, void BIL-G3); claims cycle decision needs surfacing; matrix partially superseded by SL-05 — needs re-verification | 02 |
| 2 | Dental Clinical | dental-clinical | Business Module | High | Strong | Largest dead-trigger cluster (Lab G1, consent revoke G3, Rx G4) — all P1, mostly decision-free | 02 |
| 3 | Dental Patient | dental-patient | Business Module | High | Strong | Largest module; archived-write guards (G4) + many unwired sub-surfaces; claims decision interacts with #1 findings | 02 |
| 4 | Dental Visit & Charting | dental-visit | Business Module | High | Strong | Heavy recent change (charting P0s, carry-over, cumulative layers, offline merge) — verify the new surface coheres with PRD; carry-over/template FE rows | 02 |
| 5 | Dental Scheduling | dental-scheduling | Business Module | Medium | Strong | Cancellation (SCH-G1 P1) + queue/waitlist completeness | 02 |
| 6 | Dental PMD | dental-pmd | Business Module | Medium | Strong | Whole portability P1 block (signing, safety-floor merge, viewer) — several `[NEEDS PRODUCT DECISION]` to surface crisply | 02 |
| 7 | Data Governance | data-governance | Business Module (governance) | High | Partial | Erasure operability + tenant-validation re-check post-SL-08; legal-hold/retention UI decisions | 02 |
| 8 | Dental Audit | dental-audit | Business Module (governance) | Medium | Strong | Viewer (P1-A) now unblocked since P1-B/P1-C landed; sink consolidation (P2-B) | 02 |
| 9 | Notifications | notifications | Platform Capability | Medium | Weak | Inbox/opt-in; small batch | 02 |
| 10 | Case Presentation | case-presentation | Cross-Module Journey | Medium | Partial | Re-verify fixed flow + spec-anchor gap | 02 |
| 11 | Dental Imaging & Ceph | dental-imaging | Business Module | Medium | Strong | Healthy; open items mostly product-decision-gated (trace FSM, sign-off) | 02 |
| 12 | Dental Perio | dental-perio | Business Module | Low | Strong | Healthiest; diagnosis-persistence re-check | 02 |
| 13 | Dental Org & Staff | dental-org | Business Module | Medium | Strong | Batch-4 fixes landed; staff-edit/consent-templates/multi-branch remain | 02 |
| 14 | Dental Portal | dental-portal | Business Module | High | Partial | After Phase-2 product decision (§20) | 02 (after decision) |
| 15 | Cross-cutting patterns (auth/tenancy, offline-sync, dead-trigger, orphan-endpoint, audit-coverage) | cross-cutting | Auth/RBAC + Platform | High | Partial | After ≥3 module audits confirm repeated patterns | 05 |
| 16 | Database / Schema | database-schema | Database/Schema Group | Medium | Strong | Only if module audits keep surfacing schema issues | 06 |
| 17 | emr-consultation / provider / external-records-import | emr-consultation | Business Modules (dormant) | Medium/Low | Strong/Missing | Dormant or decision-gated; verify relabels then park | 02 (light) |
| 18 | Consolidated roadmap | — | — | — | — | After several audits/fixes | 07 |

## 17. Missing or Weak Product References

| Module/Group | Module Slug | Missing Reference | Why It Matters | Label |
| --- | --- | --- | --- | --- |
| Provider | provider | No MODULE_SPEC at all | Cannot judge deprecate-vs-productize without product intent | `[BLOCKED BY MISSING SPEC]` |
| Dental Erasure | data-governance | No dental-erasure MODULE_SPEC anchor (legal-hold + retention have specs) | Erasure FE scope + who-may-erase undecidable | `[BLOCKED BY MISSING SPEC]` + `[NEEDS PRODUCT DECISION]` |
| Case Presentation | case-presentation | No dedicated spec dir; behavior spread across PRD + workspace ref spec | Boundary/acceptance criteria inferred | `[INFERRED]` |
| Dental Portal | dental-portal | No MODULE_SPEC anchor; Phase-2 scope undefined | Whole onboarding/linking path is a product call | `[NEEDS PRODUCT DECISION]` |
| Notifications | notifications | No module spec; PRD mentions reminders only | Inbox/bell/opt-in scope inferred | `[INFERRED]` |
| Auth/RBAC | auth-rbac | ROLE_PERMISSION_MATRIX flagged NEEDS-REVIEW (2026-06-11 docs sweep) | Stale matrix risks wrong RBAC audit verdicts | `[NEEDS CONFIRMATION]` |
| Database | database-schema | DOMAIN_MODEL flagged NEEDS-REVIEW (2026-06-11 docs sweep) | Schema audit baseline may be stale | `[NEEDS CONFIRMATION]` |

## 18. Immediate Concerns

Indexing-level only — not deep-audited here.

| Concern | Module/Group | Module Slug | Evidence | Risk | Recommended Next Step |
| --- | --- | --- | --- | --- | --- |
| PRD §8.4 V1-Required billing affordances unreachable (discount, receipt; void P2) | Dental Billing | dental-billing | matrix BIL-G1/G3/G5: `applyDentalDiscount`, `voidDentalPayment`, `getDentalPaymentReceipt` 0 FE consumers | High | First module audit (02) |
| Erasure tenant-validation status unclear post-SL-08 | Data Governance | data-governance | matrix ER-P1-1 vs memory of SL-08 cross-tenant sweep — unverified | High | Verify in data-governance audit `[NEEDS CONFIRMATION]` |
| PMD has no digital signature but UI implies portability/non-repudiation | Dental PMD | dental-pmd | matrix P1-2: checksum misrepresented | High | dental-pmd audit; surface product decision |
| Dead-trigger class persists (Lab `onLab`, PMD `onPmd`) | Dental Clinical / PMD | dental-clinical | matrix G1 / P1-3: handler passed, no button renders | Medium | dental-clinical audit |
| Real patients cannot reach the portal (no account-linking, no seed) | Dental Portal | dental-portal | matrix portal P1 rows | High | Park until Phase-2 decision |
| FE conflict-resolution journey has no full E2E despite offline-sync chain completing | Offline Sync | offline-sync | SL chain done; slice A UI tests exist; no end-to-end browser drive `[TEST GAP]` | Medium | Prompt 05 cross-cutting audit |

## 19. Recommended First Module/Group To Audit

- **Module/group:** Dental Billing
- **Module slug:** `dental-billing`
- **Reason:** Highest-stakes domain (money + PHI + tenancy) with **PRD-cited V1-Required affordances still unwired** (discount apply §8.4, printable receipt, payment void) and a revenue-cycle (claims) decision to surface. The 2026-06-08/09 audits cleared its security classes, and SL-05 (invoice-void failClosed) plus Batch 2/4 landed afterwards — so the gap picture is partially stale and is the best candidate for a fresh PRD-to-code completeness pass. Mostly decision-free P1/P2 work ⇒ a fix-ready plan from 03 can execute immediately.
- **PRD/spec coverage:** Strong
- **Primary PRD/spec:** `docs/prd/v3-dentalemon.md` §6.4 + §8.4 + §11.3; `docs/product/modules/dental-billing/MODULE_SPEC.md` + `API_CONTRACTS.md`; `docs/prd/BUSINESS_RULES.md` BR-010..015; prior evidence `docs/audits/modules/MODULE_dental-billing_AUDIT_2026-06-08.md` + `docs/audits/module-gap-plans/` billing plan + `docs/audits/MASTER-GAP-MATRIX.md` rows BIL-G1..G6
- **Recommended prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 20. Do Not Audit Yet / Delay

| Module/Group | Module Slug | Reason To Delay | Label | Recommended Prerequisite |
| --- | --- | --- | --- | --- |
| Dental Portal (Phase-2 scope) | dental-portal | Onboarding/account-linking, self-booking, self-pay are unscheduled product scope; auditing completeness against undecided scope produces noise | `[NEEDS PRODUCT DECISION]` | Phase-2 scope decision (audit Phase-1 reads only if desired) |
| External Records Import (FHIR/CDA bridge) | external-records-import | Bridge is Phase-3+ by design; only the built bulk-import surface is auditable | `[INFERRED]` | Phase-3 scheduling + ingestion-hardening review |
| Provider | provider | No spec; deprecate-vs-productize undecided | `[BLOCKED BY MISSING SPEC]` | Product decision |
| EMR Consultation | emr-consultation | Dormant-relabel decision made 2026-06-10; only a light verification pass is worthwhile | `[NEEDS CONFIRMATION]` | Confirm relabel/clinic-scope landed |
| Desktop/Tauri embedding | desktop-embedding | Runtime sync integration is a known stub; not shipped | `[BLOCKED BY ENVIRONMENT]` | cadence SyncEngine integration completed |
| Monobase base modules | monobase-base | Vertical-neutral primitives without dental product intent; audit only via consuming dental workflows | `[INFERRED]` | Surfaced need from a dental module audit |

---

**Next recommended audit:**
Module/group: Dental Billing
Module slug: dental-billing
PRD/spec coverage: Strong
Primary PRD/spec: docs/prd/v3-dentalemon.md §6.4/§8.4/§11.3 + docs/product/modules/dental-billing/
Prompt: docs/aha/prompts/02-module-or-group-audit-gap-plan.md
