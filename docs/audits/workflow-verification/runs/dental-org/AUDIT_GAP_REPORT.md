# dental-org — Gap Audit (pre-implementation, no-fix)

**Date:** 2026-06-09 · **Mode:** audit only (no fixes) · **Driven live:** chromium @ localhost:3003 as owner Dr. Maria Reyes (PIN 123456).
**Verdict: PARTIAL PASS** — core org/branch/membership/dashboard work; 3 P1 "configuration-with-no-effect / unenforced" gaps remain.

Sources compared: PRD `docs/product/modules/dental-org/MODULE_SPEC.md` + `API_CONTRACTS.md`; IDEAL §3.1/§7; `specs/api/src/modules/dental-org.tsp`; handlers `services/api-ts/src/handlers/dental-org/`; FE `apps/dentalemon/src/features/{settings,staff,dashboard}` + routes; live drive.

## Headline confirmed gaps (all code- AND live-verified)

### G1 (P1) — Working hours: configured in UI, never enforced (split-brain)
- FE `features/settings/components/working-hours.tsx:118` saves via `useUpdateBranchSettings` → `PUT /dental/branches/:id/settings` → merges into `dental_branch.settings.workingHours` blob (`branchSettings.ts:84`).
- Appointment validation `dental-scheduling/createAppointment.ts:60-66` reads `getBranchSchedulingConfig().workingHours` = the **dedicated `dental_branch.working_hours` column** (`org-scheduling.facade.ts:52`) — NOT `settings.workingHours`.
- The dedicated `updateWorkingHours` endpoint (writes the column) has **0 FE consumers**; `branchSettings` does not mirror blob→column. Seed populates neither.
- **Effect:** owner sets clinic hours, sees "Save Working Hours" success, but `branch?.workingHours` stays falsy → FR3.10 / BR-SCH-004 validation is silently skipped. False sense of configuration. Live: screenshot `v2_2_working_hours.png`.

### G2 (P1) — Fee schedule: configured in UI, consumed by nothing (AC-ORG-002 unmet)
- FE `features/settings/components/fee-schedule.tsx:66` saves `settings.feeSchedule` (Record<cdt,priceCents>). Readable back via `getFeeSchedule` (`feeSchedule.ts:69`), so the editor round-trips.
- BUT no clinical/billing path consumes it: `dental-visit/treatments/createDentalTreatment.ts:69` takes `priceCents` straight from the request body; **no FE component reads `settings.feeSchedule` to pre-fill a treatment/invoice price** (grep: only the editor + the type def reference it).
- **Effect:** owner sets D0120 = ₱1500, sees "Fee schedule saved", but new treatments/invoices never default to it. AC-ORG-002 ("fee schedule update affects new invoices") has no real path. Live: `v2_5_fee_saved.png`.

### G3 (P1) — Granular permission grid is editable but unenforced
- Full stack exists: catalog + `buildPermissionGrid` + `getPermissionGrid`/`updatePermissions` + FE `permission-grid.tsx` (saves overrides via `use-permissions.ts`).
- Enforcement primitive `handlers/shared/assert-permission.ts` (`assertPermission`/`resolvePermission`) is called by **0 production files** (repo-wide grep). Real gate is coarse `assertBranchRole` (109 files).
- **Effect:** owner toggles a (role,feature) permission in Settings → Permissions, sees it saved, but no handler consults the override → authorization unchanged. Security-relevant false affordance (over- or under-restriction both possible vs. operator intent).

## Secondary gaps

| ID | Sev | Gap |
|----|-----|-----|
| G4 | P2 | **Staff invitation / `invited` state divergence.** PRD WF-004 / AC-ORG-003 / §8 describe email-invite → set-password → `invited→active`. Actual = direct PIN-staff creation (displayName+role+6-digit PIN, `staff-create-modal.tsx:158`); tsp `MemberStatus` omits `invited`. Likely intentional local-first pivot — **[NEEDS CONFIRMATION]** of intent; either way PRD/spec are unreconciled. |
| G5 | P2 | **No post-creation staff edit.** Staff screen subtitle says "Manage your team and assign roles" but ACTIONS column only offers Deactivate; `updateMember` has 0 FE consumers. Role cannot be changed after creation; provider license/NPI/credentialType (needed for claims, CLAIM-BR-001) cannot be entered anywhere in the UI. Live: 0 edit affordances on `/staff`. |
| G6 | P2 | **Consent-template management has no UI.** Backend full CRUD (ORG-S4 = P1, `list/create/update/deleteConsentTemplate`); 0 FE consumers. PRD §9 lists consent templates as a Branch-Settings purpose. (`workspace/consent-sheet.tsx` is patient consent capture, a different thing.) |
| G7 | P2 | **No multi-branch create / switcher in FE.** `CreateBranchRequest` + `getBranchesByUser` exist (WF-070 = P0 "create branch"); `getBranchesByUser` has 0 FE consumers; onboarding provisions only the default branch. IDEAL §3.1 org-switcher / multi-location not surfaced. |
| G8 | P3 | **PIN self-recovery has no UI.** `setSecurityQuestion` + `recoverPin` = 0 FE consumers; only owner-reset (`resetMemberPin`) is wired. §13 edge case. |
| G9 | P3 | **SDK bypass / raw fetch.** org-context (`lib/load-org-context.ts:24`) and verify-pin (`routes/auth/pin-entry.$memberId.tsx:261`) call `fetch` directly, bypassing the generated SDK (and the no-raw-fetch rule). Works; polish/consistency. |
| G10 | P3 | **Audit-viewer param drift (EM-AUD-013, already tracked).** viewer query uses camelCase + limit/offset vs spec snake_case + page. |

## Terminology inconsistencies
- `invited` membership status: in MODULE_SPEC §8 + AC-ORG-003, absent from tsp `MemberStatus` enum (active|inactive) and from the FSM the code implements.
- `revoked` (MODULE_SPEC §7 calls it a legacy unused enum value) — confirm removed from schema or document as dead.
- Role label surface: spec key `staff_full` renders as "Staff - Full Operations" / "Staff" in the staff table — acceptable, but the PIN-select shows just "Staff" (less precise than the table).

## Why the prior "DONE" pass missed G1–G3
The earlier sweep verified the branch-settings **round-trip** (save → reload → field repopulated) and the org-context/dashboard **shape**. It never asserted **downstream consumption**: that UI-configured hours block an out-of-hours appointment, that a configured fee defaults an invoice line, or that a permission override changes a handler's allow/deny. All three gaps live precisely in that untested seam.

## Recommended fix sequence (when authorized)
1. **G3** (security first): wire `assertPermission` into handlers OR remove/disable the Permissions tab so it can't mislead. Decide enforce-vs-remove before anything else.
2. **G1**: make the Working Hours UI call the dedicated `updateWorkingHours` endpoint (or have `branchSettings` mirror `workingHours`→column); seed the column; add an E2E that an out-of-hours non-walk-in booking is rejected.
3. **G2**: either consume `settings.feeSchedule` to pre-fill treatment/invoice prices (close AC-ORG-002 with an E2E) or relabel the screen as a non-binding reference list.
4. **G5/G9** (staff edit + credentials), **G6** (consent templates), **G7** (branch mgmt) — wire the already-built backends to FE.
5. **G4** terminology reconcile; **G8/G10** polish.

## Evidence
- `outputs/dental-org-audit/screenshots/v2_2_working_hours.png`, `v2_5_fee_saved.png` (+ staff body text in `final_script_log_v2.txt`).
- Drivers: `outputs/dental-org-audit/drive2.cjs`.
