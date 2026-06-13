# dental-org — workflow-verification run report

**Module #1 · Status: DONE · Rating: 🟢 GREEN · 2026-06-08**
Branch `chore/workflow-verification-sweep`. Driven live (webwright/Firefox) as owner Dr. Maria Reyes (PIN 123456) + RBAC-negative as staff Ana Santos (PIN 654321).

## Personas driven
- **Alex / owner** (Dr. Maria Reyes, dentist_owner) — dashboard, branch settings, staff list.
- **Sam / front-desk** (Ana Santos, staff_full) — RBAC negative (owner-only admin denied).

## Workflows verified (smoke = `apps/dentalemon/tests/smoke/dental-org_smoke.py`, 4/4 CP pass)
| CP | Workflow | Type | Result |
|----|----------|------|--------|
| CP1 | Owner dashboard morning-briefing renders (active payment plans + lab orders), no "Failed to load" | happy | PASS |
| CP2 | Branch-settings **round-trip**: save Clinic Name → "Settings saved" → full reload (drops PIN session) → re-auth → field pre-populated with saved value | happy + coherence | PASS |
| CP3 | `/staff` renders real member rows with role labels; owner row non-deactivatable (last-owner guard visible) | happy + coherence | PASS |
| CP4 | Staff_full denied owner-only admin: sidebar hides Admin section; direct-URL `/staff` + `/settings` → redirect `/patients` | RBAC negative | PASS |

## Gap fixed (Type A — static contract drift, STEP 3a)
**shape-diff: dental-org TypeSpec drifted from handler reality across 3 models.** The `.tsp` declared shapes the handlers stopped returning; the SDK types were therefore wrong, and the branch-settings FE hook read the response flat (envelope keys came back `undefined` → blank settings panels on read).

| Operation | Stale TypeSpec said | Handler actually returns (source of truth) |
|-----------|--------------------|--------------------------------------------|
| `GET /dental/org/context` | flat `{ organizationId, branchId, memberId, role, orgName, branchName, timezone }` | nested `{ org:{id,name,tier}, branch:{id,name,timezone}, member:{id,role,displayName} }` — `getOrgContext.ts:57` |
| `GET /dental/dashboard/summary` | `{ todayVisits, pendingInvoices, totalPatients, revenueThisMonthCents }` | `{ activePaymentPlans:{count,behindCount,totalOutstandingCents}, labOrders:{totalPending,ordered,inFabrication,overdueDelivery} }` (FR0.7/FR0.8) — `getDashboardSummary.ts:39` |
| `GET/PUT /dental/branches/:id/settings` | fixed columns `{ branchId, appointmentDurationMinutes, currency, taxRate, appointmentReminderEnabled }` | envelope `{ branchId, settings: Record<unknown> }`; PUT accepts flat-or-wrapped — `branchSettings.ts:55,78` |

**Fix (true source):** updated `specs/api/src/modules/dental-org.tsp` to match the handlers → regen (`validators.ts`, SDK `types.gen.ts`/`index.ts`) → FE hook `use-branch-settings.ts` now unwraps `.settings`. RED pins first: FE unit corrected to assert the nested-envelope unwrap (the prior fixture asserted the flat shape and masked the drift); `dental-org.hurl` gained drift pins for dashboard-summary + org-context.

## Tests added/strengthened
- `apps/dentalemon/src/features/settings/hooks/use-branch-settings.test.ts` — pins envelope unwrap (clinicName/feeSchedule/locale resolve; envelope keys don't leak). 12 pass.
- `specs/api/tests/contract/dental-org.hurl` — drift pins for `GET /dental/dashboard/summary` (`activePaymentPlans`/`labOrders`) and `GET /dental/org/context` (nested `org`/`branch`/`member`). 31 requests pass.
- `apps/dentalemon/tests/smoke/dental-org_smoke.py` — committed regression guard (CP1–CP4).

## Deferred-reported (Type C — none fixed)
- None. No deferred/Phase-2 affordances surfaced for dental-org during the drive.

## Regen
- **Ran regen** (tsp → validators + SDK). Regenerated operationIds: org-context, dashboard-summary, branch-settings (GET/PUT). Blast-radius re-gate run by orchestrator: full typecheck clean, full contract suite — `dental-org.hurl` Success; no other module's `.hurl` regressed (the 8 failing files are MinIO/Mailpit infra, Docker down).

## Gate
typecheck ✓ (FE+api-ts exit 0) · backend ✓ (329 pass / 0 fail) · contract ✓ (`dental-org.hurl` Success, 31 req) · FE unit ✓ (12 pass / 0 fail) · lint ✓ (0 errors) · boundaries ✓ (dental-org + all clean) · smoke ✓ (4/4 CP)

## Evidence
- `screenshots/` — 8 final-execution PNGs (CP1 dashboard, CP2 settings saved+reloaded, CP3 staff list, CP4 staff/settings denied).
- `drive-log.txt` — webwright step log.
