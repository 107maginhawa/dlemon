# Legacy Module Fate Decisions — Phase 12

Source: structural remediation plan at `~/.claude/plans/id-like-to-understand-wiggly-storm.md`.
Execution is a **separate initiative** (H2 2026 → H1 2027). This document records the fate
decisions so teams can plan migrations without needing to re-analyze from scratch.

> ⚠️ None of the "migrate to delete" actions should start until:
> - Boundary lint is `error` for all consuming dental-* modules (Phase 10 complete)
> - DB backup + rollback tooling is verified for the tables involved
> - The data migration plan has been reviewed by two engineers

---

## Module-by-Module Decisions

### `person/` — PROMOTE to shared infrastructure

**Fate**: Keep permanently. Document as the canonical PII base layer.

**Rationale**: The `persons` table is Better-Auth-coupled — auth sessions carry `person.id` as
the user identity. fanIn=47 means 47 files depend on it. The dental-org, dental-patient, and
dental-billing modules all have FK paths that ultimately reference `persons.id`. This is not a
legacy module to delete; it is the lowest layer of the identity stack.

**Actions**:
- Add a `SHARED_INFRASTRUCTURE.md` marker in `handlers/person/` explaining its role
- Freeze scope at current CRUD (createPerson, getPerson, listPersons, updatePerson)
- New person-level features go here; new dental-specific features go to `dental-patient/`
- Do NOT restructure until Better-Auth FK audit is complete (reviewer landmine #8)

**Prerequisites before any changes**: Audit which Better-Auth tables have FKs to `persons.id`;
confirm the auth library doesn't hard-code the table name.

---

### `patient/` — PROMOTE to base layer (do not delete)

**Fate**: Keep permanently. Mark as the dental-neutral patient identity layer.

**Rationale**: The `patients` table is the FK anchor for all `dental-patient/` submodule
schemas (`recall`, `contact`, `dental-alert`, `claim-draft`, `treatment-plan`, `insurance-profile`,
`task` — all `CASCADE DELETE` on `patients.id`). Deleting this table requires simultaneously
moving all those FKs to a new `dental_patients` table and writing data migrations — a
multi-quarter effort. It is not "legacy"; it is the identity layer for the dental vertical.

**FK chain**:
```
persons.id ← patients.person_id
patients.id ← dental-patient/repos/recall.schema      (CASCADE)
patients.id ← dental-patient/repos/contact.schema     (CASCADE)
patients.id ← dental-patient/repos/dental-alert       (CASCADE)
patients.id ← dental-patient/repos/claim-draft        (CASCADE)
patients.id ← dental-patient/repos/treatment-plan     (CASCADE)
patients.id ← dental-patient/repos/insurance-profile  (CASCADE)
patients.id ← dental-patient/repos/task               (CASCADE)
```

**Actions**:
- Freeze `patient/` handlers at current CRUD (createPatient → getDentalPatient is the proper
  dental handler; no new features should land in `patient/createPatient`)
- Document that `patient/` = identity layer, `dental-patient/` = clinical features layer
- Do NOT attempt to merge or delete until all FK consumers are migrated (separate initiative F3)

---

### `billing/` — KEEP as template parity (frozen)

**Fate**: Freeze scope. Do not add new features; do not delete.

**Rationale**: `billing/` is the generic Stripe-based SaaS billing module (invoices, merchant
accounts, Stripe webhooks). `dental-billing/` is the dental procedure billing system (dental
invoices, payments, discounts). These are **different domains** and serve different purposes.
The generic billing module may be used by future non-dental verticals or account-level billing.

**Actions**:
- Add a `README.md` in `handlers/billing/` marking it as "upstream template parity — frozen"
- No new features; if a dental billing feature is needed, add it to `dental-billing/`
- SDK consumers: `listInvoices`, `createInvoice` at `/billing/invoices` remain live

---

### `emr/` — MIGRATE TO DELETE (after dental-clinical is complete)

**Fate**: Mark deprecated; migrate consumers to dental-clinical; delete when empty.

**Rationale**: `emr/` (6 handlers: create/finalize/get/list/updateConsultation, listEMRPatients)
is the upstream template's generic EMR module. `dental-clinical/` (27+ handlers in 9 sub-domains)
is the fully-developed dental equivalent covering prescriptions, consents, lab orders, medical
history, amendments, attachments, occlusion, and postop. No `apps/dentalemon/` frontend code
calls `emr/` routes. The `emr/` module exists only in the TypeSpec spec and generated SDK.

**Migration steps**:
1. Audit: `grep -r 'emr\|consultation' apps/dentalemon/src/` — confirm zero frontend calls
2. Update TypeSpec: deprecate `emr/` spec module, add Sunset header to all `/emr/` routes
3. Remove `emr/` route registrations from `generated/openapi/registry.ts` (after regenerating spec)
4. Delete `handlers/emr/` directory

**DB tables to verify**: `consultations`, `emr_records` — confirm no data in production before drop.

**Consumer count**: 0 frontend calls (confirmed); SDK functions exist but unused.

---

### `provider/` — MIGRATE TO DELETE (after dental-org covers all cases)

**Fate**: Mark deprecated; confirm dental-org covers use cases; delete when empty.

**Rationale**: `provider/` (15 handlers: practitioner CRUD, practitioner-role CRUD, provider CRUD)
is the upstream template's generic provider module. `dental-org/` handles dental team members
(dentist_owner, staff_full, staff_scheduling roles). No `apps/dentalemon/` frontend code calls
`/providers/` routes. The module exists only in the TypeSpec spec and generated SDK.

**Migration steps**:
1. Audit: `grep -r 'provider\|practitioner' apps/dentalemon/src/` — confirm zero frontend calls
2. Confirm dental-org members cover all use cases (role assignment, deactivation, etc.)
3. Update TypeSpec: deprecate `provider/` spec module, add Sunset header to `/providers/` routes
4. Remove `provider/` route registrations from `generated/openapi/registry.ts`
5. Delete `handlers/provider/` directory

**DB tables to verify**: `practitioners`, `practitioner_roles`, `providers` — confirm empty or migrated.

**Consumer count**: 0 frontend calls (confirmed); SDK functions exist but unused.

---

### `reviews/` — KEEP as template parity (frozen)

**Fate**: Freeze scope. Do not add new features; do not delete.

**Rationale**: `reviews/` (4 handlers: NPS review CRUD) is domain-neutral — NPS reviews may be
used for future patient satisfaction tracking, non-dental verticals, or account-level product
feedback. No dental-specific equivalent exists. Handler count is small (4); keeping it causes
no structural harm.

**Actions**:
- Add a `README.md` in `handlers/reviews/` marking it as "upstream template parity — frozen"
- If a dental patient satisfaction feature is needed in the future, build it in `dental-clinical/`
  or a new `dental-satisfaction/` module

---

## Execution Prerequisites (before any "migrate to delete" action)

1. **Boundary lint at error for all dental-* modules** — `bun run check:boundaries:error` must
   pass before deleting a module that dental-* code was importing
2. **DB backup + rollback verified** — automated backup tested, restore drill done
3. **Data migration plan reviewed by 2 engineers** — particularly for any table that has live
   production rows
4. **TypeSpec spec updated first** — spec change → codegen → handler delete (never delete handler
   without updating spec and regenerating registry first, per Phase 6 guardrail)
5. **SDK bump** — remove SDK functions for deprecated routes; bump minor version of `@monobase/sdk-ts`

---

## Summary Table

| Module | Handler count | Fate | DB impact | Effort |
|--------|--------------|------|-----------|--------|
| `person/` | 4 | Promote (permanent) | Keep `persons` table forever | Documentation only |
| `patient/` | 8 | Promote (permanent) | Keep `patients` table forever | Documentation + freeze scope |
| `billing/` | 17 | Freeze (template parity) | Keep `invoices`/`merchant_accounts` | README only |
| `emr/` | 6 | Migrate to delete | Drop `consultations`/`emr_records` | TypeSpec + registry + handler delete |
| `provider/` | 15 | Migrate to delete | Drop `practitioners`/`provider_roles` | TypeSpec + registry + handler delete |
| `reviews/` | 4 | Freeze (template parity) | Keep `reviews` | README only |

**Quick wins** (no DB migration needed): `emr/` and `provider/` deletion (tables appear empty
in dev; no frontend consumers). These can start when boundary lint gates are green.

**Long-term**: `person/` and `patient/` promotion decisions are final. They stay.
