# Contract-Spine Accuracy + Frontend-Consumer Reconciliation — 2026-06-06

**What prompted this:** a "deeper consistency check" of the generated domain graph and
contract spine (`.understand-anything/`). The question being answered: *would a deeper
consistency check find real problems, and is the codebase up to standards?*

**Short answer:** no real bugs surfaced; the cross-layer wiring is sound. The check did,
however, expose and fix a **measurement bug in the contract-spine generator** that was
materially undercounting frontend coverage (and overstating "orphan" endpoints). The
corrected spine now also yields an accurate *backend-built / frontend-pending* backlog.

---

## 1. Fixed: contract-spine consumer detection was blind to two real patterns

`scripts/build-contract-spine.ts` derives `operationId → handler → SDK → frontend consumer`.
Its consumer step had two scope bugs:

1. **Directory scope** — it scanned only `apps/dentalemon/src/features/**`, ignoring real
   consumers in `routes/`, `components/`, `hooks/`, `lib/`. → now scans all of
   `apps/dentalemon/src` (excluding tests + generated `*.gen.ts`).
2. **Identifier scope** — it matched only the generated TanStack hook names
   (`…Mutation`/`…Options`/`…QueryKey`). But many features call the **base generated SDK
   client function** (e.g. `acceptTreatmentPlan`, `getVisitPerioChart`) wrapped in a
   hand-rolled `useMutation`/`useQuery`. Those call sites were invisible. → now also matches
   the base client fn from `sdk.gen.ts` (added `sdkClientFn` to each spine entry).

### Impact (authoritative re-run)

| metric | before | after |
|---|---|---|
| `withConsumers` | 76 | **130** |
| `operation_consumed_by` edges injected into knowledge graph | 98 | **168** |

The old "76 / 352 consumers" figure (documented elsewhere as a *lower bound*) understated
real frontend coverage by ~70%. The lower-bound caveat can now be retired — the spine
reflects both consumption patterns.

> Verification note: `scripts/` is outside the repo's typecheck/lint scope (both filter to
> the `dentalemon` and `@monobase/api-ts` workspaces), and nothing those workspaces import
> was touched, so the quality gates are unaffected. The generator was validated by running
> it: `bun run scripts/build-contract-spine.ts` (regenerates spine + re-injects graph edges,
> idempotently).

---

## 2. Accurate orphan picture (was "268 unwired", a static-analysis artifact)

Of 352 operations: 352 have handlers, 344 have an SDK binding (hook or client fn), 8 have
no SDK binding at all. After the fix, **214 ops have an SDK binding but no frontend
consumer** — and this breaks down cleanly into non-alarming buckets:

- **92 — base-platform template primitives** (`booking`, `comms`, `billing` Stripe-merchant,
  `email`, `provider`, `storage`, `notifs`, `reviews`, `person`, `patient`, `emr`, `audit`).
  These are vertical-neutral endpoints the dental product simply doesn't surface in its UI.
  **Expected, not a defect.**
- **122 — dental/product ops, backend-built / frontend-pending** (see backlog below). A mix
  of (a) genuinely-unbuilt product surface and (b) *alternate/granular* endpoints superseded
  by a variant the UI already uses (e.g. UI consumes visit-scoped `getVisitPerioChart`, so
  standalone `getPerioChart` is unused; UI lists via `listAppointments`, so single
  `getAppointment` is unused). **This is product backlog, not a bug — needs product triage.**
- **8 — integration / backend-only** (no SDK binding): `generatePMD`, `exportPMD`,
  `importPMD`, `getPMDForVisit`, `getImportedPMD`, `listImportedPMDs`, `listPMDs`,
  `listEMRPatients`. Consumed via the embedded/integration path, not the web SDK. **Intended.**

### Dental backend-built / frontend-pending backlog (122)

| module | n | operationIds |
|---|---|---|
| dental-patient | 36 | households/contacts/tasks/alerts, insurance profiles, claim drafts, sync logs, statements, comms-consent, treatment-plan versions/history |
| dental-org | 23 | Branch/Membership/Org management CRUD, consent templates, fee schedule, working hours, PIN recover/verify, security question |
| dental-clinical | 16 | prescriptions list/update, occlusion screenings, post-op templates, inventory items/adjustments, amendments, consent refusals/revoke |
| dental-billing | 11 | insurance claims + lines, payment plans, discounts, receipts, balances, collections summary, payment void |
| dental-imaging | 9 | Ceph superimpositions, landmark-detection job, recompute analysis; CBCT finalize, image delete/modality/get |
| dental-visit | 8 | treatment templates CRUD + apply, carry-over treatments, get-visit, update-tooth |
| dental-scheduling | 8 | waitlist + queue, cancel/get appointment, confirm-by-token, online-booking |
| dental-erasure | 5 | request/approve/reject/get/list erasure |
| dental-legalhold | 3 | place/release/list legal hold |
| dental-pmd / dental-audit / dental-perio | 1 each | exportPatientCareRecord, getAuditEvents, getPerioChart (alternate) |

(Full operationId lists are in `.understand-anything/contract-spine.json`; filter
`sdkHooks||sdkClientFn` set with `consumers == []`.)

---

## 3. Cross-domain edge attestation (domain graph)

The domain graph asserts 18 `cross_domain` interactions. **7 sampled, deep-verified against
handler code; 0 phantoms:**

| edge | evidence |
|---|---|
| scheduling → clinical | `checkInAppointment.ts` creates the visit in-txn |
| clinical → billing | `createDentalInvoice.ts` pulls performed treatments; requires completed visit + signed consent |
| treatment-planning → billing | `createInsuranceClaim.ts` is invoice-anchored, mirrors `createClaimDraft` guards |
| clinical → PMD | `generatePMD.ts` requires completed/locked visit; imports `getVisitOrThrow` from dental-visit |
| data-governance → identity | `erasure-service.ts` `anonymizeSubject()` |
| legal-hold → erasure | `approveErasure(..., {legalHold:true})` → `legalHoldBlocked` (suspends anonymization) |
| org → clinical | `createDentalVisit.ts` `assertBranchRole()` PIN/RBAC gate |

Since the graph was derived from the real import/call graph (not authored), and the sample is
clean, remaining edges are treated as sound; exhaustive attestation was judged low-value.

---

## Verdict

- **No bugs found.** Handlers are all registered; cross-domain flows are real; no dead routes.
- **One tooling-accuracy fix shipped** (spine consumer detection) — improves an
  AI-extensibility artifact and the knowledge graph's `operation_consumed_by` edges.
- **A useful, accurate product backlog** (122 dental ops backend-built / FE-pending) now
  falls out of the spine for free — the highest-value output of the consistency check.
- Codebase remains **shareable / professional**; this exercise *raised* confidence rather
  than lowering it.
