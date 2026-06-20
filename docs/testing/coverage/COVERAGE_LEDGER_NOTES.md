# Coverage Ledger — Notes & Completeness Findings

> Generated for `coverage-ledger.json` (generatedAt 2026-06-20T17:56:55Z, source phase0). Completeness joins computed deterministically (Phase 0).

## Surface size

| Metric | Count |
|--------|------:|
| **Total ledger items** | **915** |
| User-reachable (has a route) | 778 |
| type=business-rule | 450 |
| type=workflow | 269 |
| type=use-case | 169 |
| type=inter-module | 27 |
| Modules tagged | 60 |

### requiredLayers distribution (agents’ first-pass policy guess)

| requiredLayers | items |
|----------------|------:|
| be-unit+contract+e2e+fe-unit | 343 |
| be-unit | 260 |
| be-unit+fe-unit | 165 |
| be-unit+contract | 60 |
| fe-unit | 59 |
| (none) | 23 |
| e2e+fe-unit | 3 |
| be-unit+contract+fe-unit | 2 |

### Items per module (top 30)

| module | items |
|--------|------:|
| dental-org | 152 |
| patient | 120 |
| dental-patient | 116 |
| dental-visit | 104 |
| billing | 92 |
| dental-clinical | 91 |
| dental-billing | 90 |
| workspace | 87 |
| person | 82 |
| dental-imaging | 69 |
| dental-scheduling | 64 |
| imaging | 45 |
| notifs | 43 |
| dental-audit | 42 |
| booking | 41 |
| onboarding | 33 |
| org | 33 |
| patients | 32 |
| storage | 31 |
| settings | 29 |
| email | 25 |
| audit | 23 |
| comms | 23 |
| dental-perio | 23 |
| dental-pmd | 23 |
| provider | 21 |
| dental-erasure | 19 |
| staff | 19 |
| dashboard | 18 |
| rbac | 17 |

## Completeness findings

> **Caveat:** reader agents populated `relatedWF` on only 64% and `relatedBR` on 39% of items ("map where you can, else []"). A catalog id absent from ledger refs is a **candidate** to verify in Phase 1, not a proven gap — the behavior may exist but be untagged.

### A. Catalog WF-* with NO ledger reference (4 of 85)

- `WF-054` — Invoice overdue job _(matrix status: gap)_
- `WF-080` — Appointment notification _(matrix status: gap)_
- `WF-094` — Carry-over treatment display _(matrix status: covered)_
- `WF-P05` — Print perio chart (PDF export) _(matrix status: deferred)_

### B. Catalog BR-* with NO ledger reference (31 of 129) — candidate untested rules

`AC-AUD-003 / EM-AUD-002`, `AC-AUD-004 / V-AUD-001 / V-AUD-NEW-A`, `AC-LH-001..004 (legal-hold workflow + RBAC + FSM)`, `AC-RET-001..006 (retention enforcement: dry-run, soft-archive, protected, legal-hold-excluded)`, `BR-029`, `BR-031`, `BR-049`, `EM-DG-RBAC (erasure/legal-hold admin-only; non-admin → 403)`, `V-AUD-007 / EM-AUD-008`, `V-AUD-NEW-B / WF-028`, `V-DG-002-AN (erasure ANONYMIZES, never hard-deletes)`, `V-DG-002-AU (erasure audited AND the audit trail survives the erasure)`, `V-DG-002-LH (legal-hold blocks erasure — headline invariant)`, `V-EMR-001 (finalize is terminal — sign-immutability, no amend-after-finalize)`, `V-EMR-005 (audit tenant slot is a non-PHI sentinel, never the patient UUID)`, `V-EMR-AUTH (authoring/finalizing role-gated to the owning provider)`, `V-EMR-CTX (context idempotency key is unique)`, `V-EMR-OWN (ownership self-scope — headline isolation invariant)`, `V-PORTAL-001 (IDOR-free self-scope — headline invariant)`, `V-PORTAL-002 (staff-only account denied; patient-only boundary)`, `V-PORTAL-003 (empty self-scope returns [] / zero, never a fallback)`, `V-PORTAL-004 (patient-appropriate projection; internal fields & written-off debt hidden)`, `V-PORTAL-005 (read-only; no patient write/mutate path)`, `V-PROV-001 (Provider profile is self-service — created for the session user only)`, `V-PROV-002 (Practitioner credentials are privileged-read-only — no public/patient projection)`, `V-PROV-003 (Practitioner / PractitionerRole writes are admin/credentialing role-gated)`, `V-PROV-004 (deactivate is a soft-delete — records retained)`, `V-XRI-001 (bulk patient import is cross-tenant isolated — owner-of-the-named-branch only)`, `V-XRI-002 (ingestion safety — untrusted external input rejected with a specific 4xx, never a 500/crash)`, `V-XRI-003 (FHIR/CDA/PDF EMR-import bridge is FUTURE-PHASE — not built)`, `V-XRI-004 (imported-PMD immutability + checksum + provenance + audit are the PMD-side import invariants)`

### C. §14 discovered-gap WFG-* in WORKFLOW_MAP (15)

`WFG-001`, `WFG-002`, `WFG-003`, `WFG-004`, `WFG-005`, `WFG-006`, `WFG-007`, `WFG-008`, `WFG-009`, `WFG-010`, `WFG-011`, `WFG-012`, `WFG-013`, `WFG-014`, `WFG-015`

### D. Ledger references a WF id NOT in the parsed catalog (17)

**D1 — parser blind spot (16):** these WF ids DO exist in `WORKFLOW_MAP.md` (raw text = 104 distinct `WF-###` vs matrix parser's 85) but `workflow-matrix.ts` drops any id cell carrying an `[INFERRED]`/annotation suffix (e.g. `| WF-055 [INFERRED] |`). **These workflows are INVISIBLE to the existing E2E ratchet — Phase 2 must fix the parser.**

`WF-047`, `WF-055`, `WF-056`, `WF-057`, `WF-058`, `WF-060`, `WF-061`, `WF-063`, `WF-068`, `WF-069`, `WF-070`, `WF-072`, `WF-074`, `WF-078`, `WF-EMRC`, `WFG-006`

**D2 — truly invented (1):** no WORKFLOW_MAP backing — reconcile (rename to a real WF or drop).

`WF-RBAC`

### E. Ledger references a BR id NOT in br-registry (33) — reconcile

`AC-AUD-003`, `AC-AUD-004`, `AC-LH-001..004`, `EF-PMD-003`, `EM-AUD-002`, `EM-AUD-006`, `EM-AUD-008`, `EM-BIL-001`, `EM-DG-RBAC`, `V-AUD-001`, `V-AUD-007`, `V-AUD-NEW-A`, `V-AUD-NEW-B`, `V-DG-002-AN`, `V-DG-002-LH`, `V-EMR-001`, `V-EMR-002`, `V-EMR-003`, `V-EMR-004`, `V-EMR-005`, `V-EMR-006`, `V-EMR-008`, `V-EMR-AUTH`, `V-EMR-CTX`, `V-EMR-OWN`, `V-PMD-010`, `V-PROV-001`, `V-PROV-002`, `V-PROV-003`, `V-PROV-004`, `V-XRI-001`, `V-XRI-002`, `V-XRI-004`

### F. User-reachable workflow/use-case items with NO catalog WF tag (143) — uncataloged user workflows

The north-star risk surface: user-facing actions with no WORKFLOW_MAP entry. Top 50 by route:

| id | route | control |
|----|-------|---------|
| billing-get-invoice | /billing/invoices/:invoice |  |
| billing-get-merchant-account | /billing/merchant-accounts/:merchantAccount |  |
| billing-list-invoices | /billing/invoices | Invoices list |
| comms-get-chat-messages | /comms/chat-rooms/{room}/messages | message thread |
| comms-get-chat-room | /comms/chat-rooms/{room} |  |
| comms-get-ice-servers | /comms/ice-servers |  |
| comms-list-chat-rooms | /comms/chat-rooms | chat list / inbox |
| be-dental-billing-estimate-coverage | /billing | data-testid=claim-detail > data-testid=e |
| be-dental-billing-get-ar-aging | /billing | Collections tab -> data-testid=collectio |
| be-dental-billing-get-claim | /billing | Insurance > data-testid=claim-open-{clai |
| be-dental-billing-get-collections-kpis | /billing | data-testid=kpis-error -> ListErrorState |
| be-dental-billing-get-collections-summary | /dental/billing/collections/summary |  |
| be-dental-billing-get-collections-worklist | /billing | data-testid=worklist-error -> ListErrorS |
| be-dental-billing-get-patient-credits | /patients/$patientId | data-testid=patient-credit-balance / pat |
| be-dental-billing-get-payer-ar-aging | /dental/billing/claims/aging |  |
| be-dental-billing-list-claims | /billing | data-testid=claims-error -> ListErrorSta |
| uc-list-inventory-adjustments | /dental/branches/:branchId/inventory/:itemId/adjustments |  |
| uc-list-inventory-items | /dental/branches/:branchId/inventory |  |
| uc-list-occlusion-screenings | /$patientId | occlusion-tab-btn (data-testid=occlusion |
| uc-list-postop-templates | /dental/branches/:branchId/postop-templates |  |
| branch-settings-get | /settings | Notifications tab |
| dp-get-household | /dental/households/:householdId | household view |
| dp-get-patient-household | /patients/$patientId | data-testid=household-card / household-e |
| dp-list-patient-tasks | /$patientId | tasks-tab-btn (data-testid=tasks-sheet) |
| dp-list-sync-logs | /$patientId | SyncStatusBadge (top filter row) |
| exit-comparison | /$patientId (imaging overlay, comparison) | aria-label=Close comparison ("✕ Exit") |
| export-ceph-report-png | /$patientId (imaging workspace, ceph panel) | "PNG" button (shown after a report versi |
| offline-image-cache | /$patientId (imaging workspace) | (automatic on image load) |
| select-ceph-landmark-palette | /$patientId (imaging workspace, ceph panel) | CephLandmarkPalette data-landmark-code b |
| superimposition-overlay-controls | /$patientId (imaging overlay, superimpose) | data-testid=superimposition-opacity slid |
| switch-ceph-norm-population | /$patientId (imaging workspace, ceph panel) | aria-label=Norm population select |
| toggle-ceph-layers | /$patientId (imaging workspace, ceph panel) | CephLayerPanel Landmarks / Tracing / Arc |
| viewer-brightness-contrast | /$patientId (imaging workspace) | data-testid=brightness-control / contras |
| viewer-fullscreen | /$patientId (imaging workspace) | data-testid=fullscreen-btn (aria-label F |
| viewer-pan-zoom | /$patientId (imaging workspace) | canvas drag (toolMode none) / wheel |
| viewer-rotate-flip | /$patientId (imaging workspace) | aria-label Rotate clockwise / counter-cl |
| notif-onesignal-init | app root (app.tsx useEffect, gated on runtimeConfig.onesignalAppId) |  |
| notif-onesignal-user-id-sync | app root (useOneSignal in app.tsx, runs on session change) |  |
| notif-push-opt-in-dismiss | /_workspace | data-testid=push-opt-in-dismiss ("Not no |
| clinic-onboarding-back | /dental-onboarding | Back button |
| clinic-onboarding-view-wizard | /dental-onboarding | OnboardingWizard step indicator (Clinic  |
| person-onboarding-back | /onboarding | Back button |
| person-onboarding-view-personal-info | /onboarding | Step 1 of 2: Personal Information (Perso |
| onboarding-back-navigation | /onboarding | Back button (ChevronLeft) |
| onboarding-country-selector | /onboarding | Country combobox (role=combobox, 'Select |
| provider-get-practitioner | /providers/practitioners/:id |  |
| provider-get-practitioner-role | /providers/practitioner-roles/:id |  |
| provider-list-practitioner-roles | /providers/practitioner-roles |  |
| provider-list-practitioners | /providers/practitioners |  |
| invoice-detail-sheet-close | /reports | Close button (aria-label 'Close') / back |

_(+93 more user-reachable, plus 6 backend-only workflow/use-case items with no WF tag.)_


## Reconcile-agent synthesis (qualitative triage)

The Phase 0 Reconcile agent (catalog totals: 115 WF, 132 BR) classified the candidate gaps —
this is the judgment layer the deterministic joins above can't infer:

- **Only real *functional* product gap = notification triggers** (`WFG-009`..`WFG-013`:
  appointment reminder, invoice overdue, PMD ready, lab-order complete, booking confirmation).
  See untracked `plans/012-process-queued-notifications-without-schedule.md`.
- **No user-facing screen lacks a reachable workflow.** The 7 UI routes without an actionable
  item are RBAC gates / PIN guards / push opt-in prompts / client-side validation on
  canonical-route workflows — not gaps.
- **20 catalog WFs unreferenced, 0 are real coverage gaps:** 16 are the `[INFERRED]` parser
  blind-spot ids (finding D1), ~the rest are composite day-in-the-life reads (WF-052/053/062/
  065/067/071/073/075/076/077/079) or DEFERRED (WF-P05).
- **5 registry BRs unrepresented, 0 are coverage gaps:** BR-049 (cron, no UI), BR-029
  (per-handler imaging isolation, untagged), BR-031 (unauditable FE IndexedDB cache),
  AC-RET-001..006 (retention items shipped but `relatedBR` not back-linked = traceability gap),
  V-XRI-003 (FHIR/CDA import — not built, absent by design).
- **~156 uncataloged workflows** (no WF-id) are shipped + tested: platform primitives
  (booking, comms/chat/WebRTC, email, notifs, reviews, provider, emr-consultation, storage,
  retention, inventory) + patient sub-resources (insurance, contacts, alerts, tasks, household,
  recalls, follow-up notes, credits) + imaging-viewer affordances. **Recommendation:** extend
  WORKFLOW_MAP to catalog platform-primitive workflows, or formally scope them out.
- **33 ledger BR-ids are not in br-registry** (V-PORTAL-*, V-EMR-*, V-PROV-*, V-AUD-*, V-DG-*,
  AC-LH-*, EM-*) — real tested invariants from BE part files to reconcile into br-registry.json.

**Phase 1 implication:** the surface is built and largely tested. The backlog is about
**layer gaps** (e.g. a workflow proven at be-unit but with no e2e) + the notification-trigger
feature gap — NOT missing features.
