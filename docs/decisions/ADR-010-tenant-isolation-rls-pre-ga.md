# ADR-010: Tenant Isolation — Application-Level Now, DB RLS as a Pre-GA Gate

**Status**: Accepted
**Date**: 2026-06-13
**Context**: Multi-tenant isolation is currently enforced **at the application / repository layer**: every tenant-scoped query filters by `organizationId`/`branchId`, handlers assert branch-role membership (`assertBranchRole`), and report/list endpoints require an explicit `branchId` (the EM-BIL-002 sweep hardened ~45 endpoints after a billing-report all-tenant leak). There is **no PostgreSQL Row-Level Security**: a grep of `services/api-ts/src/generated/migrations/` finds zero `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` statements. Both the base template standard and ADR-007 recommend RLS before GA. This ADR records the decision rather than leaving it implicit.

---

## Decision

**Keep application-level tenant isolation as the current control, and make DB RLS an explicit, tracked pre-GA gate** (defense-in-depth) rather than implementing it now.

- App-level isolation (per-query tenant filters + `assertBranchRole` + mandatory `branchId` on list/report endpoints) remains the load-bearing control through pre-GA.
- **Pre-GA gate (must land before general availability):** enable RLS on the top-PHI tables — `patient`, `dental_visit`, `dental_chart`, `dental_treatment`, and prescription/clinical tables — with policies keyed off a per-request tenant context (a `SET LOCAL` session variable set in the request pipeline), plus exhaustive cross-tenant policy tests.

**Implementation scoping** — a concrete, evidence-cited plan for this gate (target table set in tiers, policy shape, session-var plumbing, migration + test strategy, a 6-PR rollout, and open design decisions) is recorded in [ADR-010-rls-implementation-plan.md](./ADR-010-rls-implementation-plan.md). Two refinements that scoping surfaced over the sketch above: (1) the dominant tenant column is `branch_id`, so the session var should be a **set-valued `app.current_branches`** (a scalar `current_org` would break legitimate multi-branch reads — the EM-BIL-002 reports); (2) the app connects as a superuser/table-owner today, so RLS additionally requires a **dedicated non-owner role + `FORCE ROW LEVEL SECURITY`**, or every policy silently bypasses. The build is **deferred** (recorded for pre-GA; not yet started).

---

## Rationale

| Concern | Defer w/ pre-GA gate (chosen) | Implement RLS now (rejected for this pass) |
|---------|-------------------------------|--------------------------------------------|
| **Correctness of the control** | App-level isolation is implemented and tested today (cross-tenant negative tests + the EM-BIL-002 sweep) | RLS is a large, cross-cutting change; partial RLS (some tables, no session-var plumbing) gives a *false* sense of security |
| **Scope/risk** | No risky migration in a docs/handoff pass | Per-request tenant session-var plumbing + policies on every PHI table + migration + a full policy test matrix is GA-grade work, not a truth-up item |
| **Honesty** | The gap is explicit and gated, not hidden | — |

RLS is genuine defense-in-depth (it protects against a missing app-level filter), so it is worth doing — but as deliberate, separately-planned GA work, not rushed.

---

## Consequences

- **Positive:** The isolation posture is now explicit; the RLS requirement is a tracked, GA-blocking gate with concrete target tables and an implementation approach.
- **Trade-off / residual risk:** Until RLS lands, a single missing/incorrect app-level tenant filter could expose cross-tenant PHI (the EM-BIL-002 class). Mitigations in force: the mandatory-`branchId` convention, cross-tenant negative tests, and code review. This residual risk is accepted pre-GA only.

---

## References

- [`docs/decisions/ADR-010-rls-implementation-plan.md`](./ADR-010-rls-implementation-plan.md) — the implementation scoping plan for this gate (tiered target tables, policy shape, `withTenantTx` plumbing, migration/test strategy, 6-PR rollout, open decisions D1–D7)
- `docs/decisions/ADR-007-self-service-onboarding.md` — first flags "No DB RLS exists … recommended before GA"
- `docs/product/THREAT_MODEL.md` — Information Disclosure / at-rest section (related defense-in-depth gaps)
- `docs/KNOWN_LIMITATIONS.md` — "Architectural decisions in flight" (now resolved by this ADR)
- `services/api-ts/src/handlers/*/repos/` — repository-layer tenant filtering (the current control)
