# AHA Fix Report: Dental Patient — Batch A (FIX-001)

**Executed:** 2026-06-11 · **Prompt:** `docs/aha/prompts/04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed)
**Batch:** A (FIX-001 — patient demographics edit) · **Protocol:** Vertical TDD (RED→GREEN per layer) + 4-lens adversarial verification before commit.

## Headline: scope correction (the erratum hid a missing backend path)

The fix-ready plan framed FIX-001 as **"FE-only wiring against a tested handler"** (`updateDentalPatient`, "SDK already generated, no backend/TypeSpec/regen work"). Verifying SDK type vs handler shape **before wiring** (per the orchestrator's explicit warning — same pattern as org B / billing E) revealed this is **false**, and worse than a shape mismatch — there was **no staff backend path for demographics at all**:

| Candidate | Reality |
| --- | --- |
| `updateDentalPatient` (staff, branch-gated, archived-guarded) | Body has **only dental fields** (needsFollowUp, dentalHistorySummary, preferredBranchId, status, emergencyContact, communicationPreferences, recallDate, recallNote). **No name/DOB/gender/phone/email.** |
| `updatePerson` (person module — has the demographic fields) | **Hard-locked to self-edit**: `if (user.id !== personId) throw ForbiddenError`. It is the upstream account-template handler; a patient's person is **not** a user, so clinic staff can never reach it for a patient. |

Demographics (firstName/lastName/dateOfBirth/gender + contactInfo) live on the **Person** record (`dental_patient.person_id` FK). The dental-patient module already reaches Person via a facade for consent (`updatePatientChannelConsent`, resolving `patientId→personId` under the dental handler's branch auth). **There was simply no equivalent for demographics.** So "fix a registration typo in a patient's name" — the gap's stated motivation — was impossible.

**Second finding (V-PAT-014 / PII minimisation):** `getDentalPatient` *deliberately* excludes `person.contactInfo` from the profile response ("return a DECLARED subset of person — never spread the full person row"). So **phone/email are never exposed by the API** (the profile shows "—" always; registration never captures them either). The plan's literal "edit phone → reload → shown" E2E is therefore **not decision-free** — it would require overriding a deliberate compliance decision.

**Resolution (correct, minimal, honest scope):** decision-free V1 demographics edit = **firstName, lastName, dateOfBirth, gender** (the fields displayed *and* returned by GET). Phone/email editing → **decision queue** (V-PAT-014). The fix extends the **already-staff-authorized** `updateDentalPatient` endpoint to also patch the linked Person via a new facade — mirroring the existing consent facade — exactly the "fix the drift, then wire" pattern used in org B / billing E.

## What shipped (full vertical, not FE-only)

1. **TypeSpec** (`specs/api/src/modules/dental-patient.tsp`): `UpdateDentalPatientRequest` gained optional `firstName`/`lastName`/`dateOfBirth`/`gender` (with a doc note that contactInfo is excluded by V-PAT-014). Regenerated OpenAPI + validators + SDK.
2. **Facade** (`person/repos/person-dental-patient.facade.ts`): new `updatePatientDemographics(db, patientId, {firstName?,lastName?,dateOfBirth?,gender?}, actorId)` — resolves `patientId→personId`, partial-updates the persons row via Drizzle `.set()` (cannot clobber other person columns), returns the **declared 5-column subset** via explicit `.returning()` (no contactInfo). Pure persistence (caller owns authz + validation).
3. **Handler** (`dental-patient/identity/updateDentalPatient.ts`): validates (blank/whitespace firstName → 400, future/<1900/invalid DOB via `validateDateOfBirth` → 400, gender against the person genderEnum allow-list → 400, `lastName ''` clears, `dob/gender ''|null` clears), calls the facade only when a demographic field is present, returns the **V-PAT-014 declared subset** + `displayName` + `person`. Branch-role + archived guards (pre-existing) protect the new path unchanged.
4. **FE**: `patient-edit-form.tsx` (new pure presentational modal — name/DOB/gender, archived→read-only), `useUpdatePatient` hook (`use-patient-actions.ts` — `updateDentalPatientMutation` + invalidates `getDentalPatient`/`listDentalPatients`), `patient-profile-page.tsx` Edit affordance (conditionally rendered modal).
5. **Tests**: backend FR2.4 describe (8 cases incl. persistence, clear-lastName, validation negatives, archived→403, V-PAT-014 negative subset), Hurl pins 5a/5b/5c (edit, reload, invalid-gender 400 + contactInfo/version/actor-UUID absence), FE component test (7), profile-page edit-flow tests (3: open-prefilled, cancel-reopen-reset, save→PATCH body), E2E edit-save-reload.

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| Backend unit (`dental-patient.test.ts` via `scripts/test-with-db.ts`) | **79 pass / 0 fail** |
| Contract (`CONTRACT_ONLY=dental-patient`, server restarted) | **46/46** |
| FE component (`patient-edit-form.test.ts`) | 7 pass |
| FE feature suite (`src/features/patients/`) | **133 pass / 0 fail** |
| Typecheck (root FE + `api-ts bunx tsc`) | both **exit 0** |
| E2E (`patient-profile.spec.ts` "Edit demographics", chromium) | **1 pass** |

## Adversarial verification (4 lenses, 12 agents) — findings actioned

Ran a 4-lens adversarial workflow (contract-shape / security-authz / correctness-edge / regression-integration) with per-finding triage. **8 suspects → 5 confirmed real → all in-scope ones fixed before commit:**

- **[FIXED] PATCH demographics response over-disclosed the raw DB row** (version/createdBy/updatedBy/archiveNote/primaryPharmacy/primaryProvider) — introduced by the `{...updated}` spread. Now returns the V-PAT-014 declared subset (mirrors getDentalPatient). Pinned by Hurl `version/createdBy/updatedBy not exists` + backend asserts.
- **[FIXED] emergencyContact/communicationPreferences PHI logged in cleartext** (Pino redact paths don't descend into JSONB). The diff touched that log line — switched to logging changed-field **names** (`updatedFields`/`demographicFields`), never values.
- **[FIXED] V-PAT-014 had no negative assertion** on the PATCH path — added `person.contactInfo`/`primaryAddress` absence pins to Hurl + backend.
- **[FIXED] PatientEditForm stale state after cancel+reopen** (rendered unconditionally → `useState` never re-init). Now conditionally rendered (`{editOpen && …}`) so it remounts each open. Regression test added.
- **[FIXED] no FE unit coverage for the edit flow** — added profile-page edit-flow tests (open/cancel-reopen/save→PATCH body).

**Refuted (3 over-claims, by triage):** non-atomic patient+person dual write (no integrity/security harm; matches `createDentalPatient` convention; failures throw, not silent 200); non-demographics path returning raw `person` FK (pre-existing module convention shared with archive/restore — neither introduced nor worsened); the emergencyContact-log issue being *attributable to this diff* (real latent gap, but pre-existing — fixed anyway since the line was touched).

## Decision queue (surface to orchestrator)

| Item | Why | Recommendation |
| --- | --- | --- |
| **Phone/email editing (V-PAT-014)** | `getDentalPatient` deliberately excludes `person.contactInfo` (PII minimisation); registration never captures phone/email. So contact info has **no read surface** and the profile's phone/email rows are effectively **dead UI** (always "—"). Editing them requires a compliance decision to expose contactInfo. | Decide: (a) keep contact info out of V1 and **remove the dead phone/email display rows** + the misleading test fixture; or (b) expose `contactInfo` on the profile (declared, audited) and add phone/email to this edit form. **Recommend (a) for V1** (honest minimisation); revisit (b) when reminders/SMS land. |
| **Pre-existing: profile-page test fixture carries fake `person.phone/email`** | Masks the dead contact UI above (test passes via a fallback the real API never hits). | Fix together with the phone/email decision (removing it changes the `PROF-01 contact info` test expectation). Deferred to avoid partial/incoherent change. |
| **Pre-existing latent: Pino PHI_REDACT_PATHS don't descend into JSONB** (emergencyContact/communicationPreferences) across other handlers | Real cleartext-PHI-in-logs risk beyond this handler. | Platform logger-hardening item (prompt-06 / security sweep) — add nested redact paths or strip JSONB PII at log sites repo-wide. |

## Not implemented (per plan §9–§11)

GAP-2 statement UI (Batch B — waits on billing print utility, already landed; can run next), GAP-3 claims/insurance (decision owned by billing), GAP-5 contacts, GAP-6 alerts, GAP-7 households, GAP-9 offline localId, patient merge, FTS, reminders, any second print utility — all out of Batch A scope.

Batch C (FIX-003 silent consent catch, FIX-004 safety-floor pin, FIX-005 unmerge 500→501, FIX-006 plan-total validation) and Batch B (statement) remain for follow-up passes.
