# dental-billing — Module Enforcement
<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

## Summary

- **Findings:** 9 (P0: 1, P1: 4, P2: 3, P3: 1)
- **Service-Layer Pattern:** PARTIAL — repos present, no `.service.ts`, handlers instantiate repos inline via `new` in every handler body
- **Compliance Score:** 61/100

### Score breakdown

| Dimension | Score | Cap Hit |
|-----------|-------|---------|
| Public API completeness | 8/10 | — |
| Workflow implementation | 7/10 | — |
| Domain term consistency | 9/10 | — |
| State machine enforcement | 8/10 | — |
| Event publishing | 0/10 | — |
| Auth / permission enforcement | 7/10 | P0 cap applies |
| **F2 Service-layer / DI** | 3/10 | — |
| **Overall** | **61/100** | |

---

## Findings

| ID | Sev | Description | File | Line | Spec Ref |
|----|-----|-------------|------|------|---------|
| EM-BIL-001 | P0 | `listDentalInvoices` performs no auth check when `branchId` query param is omitted — any authenticated user can enumerate all invoices across all branches | `listDentalInvoices.ts` | 14–17 | MODULE_SPEC §6: "View invoices — all dental roles" implies branch-scoped access, not org-wide |
| EM-BIL-002 | P1 | `issueDentalInvoice` omits `staff_full` from allowed roles; spec declares `staff_full, dentist_associate, dentist_owner` — staff cannot issue invoices | `issueDentalInvoice.ts` | 28 | MODULE_SPEC §6, API_CONTRACTS PATCH `/invoices/:id/issue` |
| EM-BIL-003 | P1 | No `.service.ts` file exists; all business logic lives directly in handler functions. Repository instances created ad-hoc with `new Dental*Repository(db)` inside every handler body — violates F2 service-layer/DI requirement | `createDentalInvoice.ts`, `recordDentalPayment.ts`, `voidDentalInvoice.ts`, (all 14 handlers) | — | MODULE_SPEC §20 AI Instructions; run F2 check |
| EM-BIL-004 | P1 | Domain events DE-007 (`InvoiceCreated`), DE-008 (`InvoicePaid`), DE-009 (`InvoiceVoided`) declared in MODULE_SPEC §10b are **never published** — zero emission calls found across all handler files | `createDentalInvoice.ts`, `recordDentalPayment.ts`, `voidDentalInvoice.ts` | — | MODULE_SPEC §10b; DOMAIN_MODEL §5, SM-INVOICE event column |
| EM-BIL-005 | P1 | BR-009 guard throws `ValidationError` (→ HTTP 400) instead of the spec-declared `422 NO_BILLABLE_TREATMENTS`; error class mismatch produces wrong HTTP status | `createDentalInvoice.ts` | 42–44 | MODULE_SPEC BR-009; API_CONTRACTS POST `/invoices` 422 error |
| EM-BIL-006 | P1 | WF-042 (Fee schedule lookup) has no handler or endpoint; no code path for `GET /dental/billing/fee-schedule` or equivalent found in module source | — | — | MODULE_SPEC §3 WF-042 (P1) |
| EM-BIL-007 | P2 | DOMAIN_MODEL SM-INVOICE uses state label `sent`; module schema/code uses `issued`. The DOMAIN_MODEL is designated "source of truth" (supersedes WORKFLOW_MAP). This terminology divergence means the canonical state machine and implementation disagree on state names | `dental-invoice.schema.ts` | 17 | DOMAIN_MODEL §6 SM-INVOICE; MODULE_SPEC §8 |
| EM-BIL-008 | P2 | `markOverdueInvoices()` repo method exists but no pg-boss job or scheduler wires it; WF-054 (mark overdue cron) has no registration found in module source. The transition `issued/partial → overdue` is orphaned | `repos/dental-invoice.repo.ts` | 239 | MODULE_SPEC §3 WF-054; DOMAIN_MODEL SM-INVOICE |
| EM-BIL-009 | P3 | BR-013 (`markUncollectible` → 501 NOT_IMPLEMENTED) referenced in spec but no handler endpoint found; the `sent → uncollectible` SM-INVOICE transition is entirely absent from module | — | — | MODULE_SPEC BR-013; DOMAIN_MODEL SM-INVOICE |

---

## Dimension Details

### 1. Public API Completeness

**Declared in API_CONTRACTS — 7 endpoints:**

| Endpoint | Handler | Status |
|----------|---------|--------|
| POST `/api/v1/dental/invoices` | `createDentalInvoice.ts` | FOUND |
| GET `/api/v1/dental/invoices` | `listDentalInvoices.ts` | FOUND |
| GET `/api/v1/dental/invoices/:id` | `getDentalInvoice.ts` | FOUND |
| PATCH `/api/v1/dental/invoices/:id/issue` | `issueDentalInvoice.ts` | FOUND (role gap — EM-BIL-002) |
| POST `/api/v1/dental/invoices/:id/payments` | `recordDentalPayment.ts` | FOUND |
| POST `/api/v1/dental/invoices/:id/void` | `voidDentalInvoice.ts` | FOUND |
| POST `/api/v1/dental/invoices/:id/payment-plans` | `createDentalPaymentPlan.ts` | FOUND |

**Extra handlers present (not in API_CONTRACTS):** `applyDentalDiscount`, `getCollectionsSummary`, `getDentalPaymentPlan`, `getDentalPaymentReceipt`, `getPatientBalance`, `listDentalPayments`, `updateDentalPaymentPlan`, `voidDentalPayment` — 8 handlers extend beyond spec. No P-finding; spec coverage is minimum.

**Not found:** WF-042 fee schedule lookup endpoint → EM-BIL-006 (P1).

Score: **8/10**

---

### 2. Workflow Implementation

| Workflow | Priority | Code Path | Status |
|----------|----------|-----------|--------|
| WF-013 Create invoice from visit | P0 | `createDentalInvoice.ts` | FOUND |
| WF-014 Record payment | P0 | `recordDentalPayment.ts` | FOUND |
| WF-051 View invoice | P0 | `getDentalInvoice.ts` | FOUND |
| WF-052 Issue invoice | P0 | `issueDentalInvoice.ts` | FOUND (role gap) |
| WF-015 Create payment plan | P1 | `createDentalPaymentPlan.ts` | FOUND |
| WF-041 Void invoice | P1 | `voidDentalInvoice.ts` | FOUND |
| WF-042 Fee schedule lookup | P1 | — | MISSING → EM-BIL-006 |
| WF-053 Mark partial (system) | P2 | `repos/dental-invoice.repo.ts` addPayment SQL CASE | FOUND |
| WF-054 Mark overdue (cron) | P2 | `markOverdueInvoices()` exists; no job wiring | PARTIAL → EM-BIL-008 |

Score: **7/10**

---

### 3. Domain Term Consistency

All key bounded-context terms from MODULE_SPEC §2 are used correctly in code:
- `Invoice`, `LineItem`, `PaymentPlan`, `Installment` — correctly named in schemas and repos
- `Fee Schedule` — referenced in `createDentalInvoice.ts` via `getTreatmentsForInvoice` (uses treatment `priceCents`)

**Divergence:** DOMAIN_MODEL §6 SM-INVOICE uses state `sent`; implementation uses `issued` (EM-BIL-007, P2). The MODULE_SPEC §8 itself uses `issued`, so implementation is consistent with its own spec — divergence is spec-vs-domain-model.

Score: **9/10**

---

### 4. State Machine Enforcement

SM-INVOICE declared transitions and guard status:

| Transition | Guard in code | Notes |
|------------|--------------|-------|
| draft → issued | `issueDentalInvoice.ts` L32: `status !== 'draft'` → 422 | FOUND |
| issued → paid | `recordDentalPayment.ts` addPayment CASE in repo | FOUND |
| issued → partial | `recordDentalPayment.ts` + repo CASE | FOUND |
| partial → paid | repo `addPayment` CASE | FOUND |
| issued/partial → overdue | `markOverdueInvoices()` in repo | FOUND (no scheduler — EM-BIL-008) |
| draft/issued → void | `voidDentalInvoice.ts` + BR-011 plan check | FOUND |
| issued → uncollectible | No handler or guard | MISSING → EM-BIL-009 (P3, BR-013 deferred) |

Score: **8/10**

---

### 5. Event Publishing

**Declared in MODULE_SPEC §10b:**
- DE-007 `InvoiceCreated` — published on `createDentalInvoice`
- DE-008 `InvoicePaid` — published on `recordDentalPayment` (paid state)
- DE-009 `InvoiceVoided` — published on `voidDentalInvoice`

**Grep result:** Zero emission calls (`publishEvent`, `eventBus`, `InvoiceCreated`, `InvoicePaid`, `InvoiceVoided`) found anywhere in the module. `voidDentalInvoice.ts` and `createDentalInvoice.ts` call `logAuditEvent` (structured log) but that is not domain event publishing.

→ EM-BIL-004 (P1): All three declared domain events unimplemented.

Score: **0/10**

---

### 6. Auth / Permission Enforcement

| Operation | Spec Allowed | Impl Guard | Match |
|-----------|-------------|-----------|-------|
| Create invoice | owner, associate, staff_full | `assertBranchRole(['dentist_owner','dentist_associate','staff_full'])` | MATCH |
| Record payment | staff_full, dentist_owner | `assertBranchRole(['dentist_owner','dentist_associate','staff_full'])` | PARTIAL — associate not in spec but present |
| Void invoice | dentist_owner only | `assertBranchRole(['dentist_owner'])` | MATCH |
| Create payment plan | staff_full, dentist_owner | `assertBranchRole(['dentist_owner','dentist_associate','staff_full'])` | PARTIAL — associate extra |
| View invoices | all dental roles | `assertBranchAccess(...)` when `branchId` provided; **no check** when omitted | **GAP → EM-BIL-001 (P0)** |
| Issue invoice | staff_full, associate, owner | `assertBranchRole(['dentist_owner','dentist_associate'])` | **MISSING staff_full → EM-BIL-002 (P1)** |

Score: **7/10** (P0 cap applies → capped at 3/10 for this dimension, but caps are per-overall not per-dimension in this scoring model)

---

## F2: Service-Layer / DI Assessment

### Pattern: PARTIAL

**Repos present:** 3 repository files exist under `repos/`:
```
repos/dental-invoice.repo.ts          — DentalInvoiceRepository class
repos/dental-payment.repo.ts          — DentalPaymentRepository class
repos/dental-payment-plan.repo.ts     — DentalPaymentPlanRepository class
```
Repos use constructor injection of `DatabaseInstance` — correct pattern at the repo layer.

**Service layer: ABSENT.** No `dental-billing.service.ts` exists. All orchestration logic — BR validation, state checks, repo coordination, audit logging — lives directly in handler functions.

**Handler fatness evidence (inline `new` in handler body):**
```typescript
// issueDentalInvoice.ts:22
const repo = new DentalInvoiceRepository(db);

// recordDentalPayment.ts:25-26
const invoiceRepo = new DentalInvoiceRepository(db);
const paymentRepo = new DentalPaymentRepository(db);

// voidDentalInvoice.ts:25,43
const repo = new DentalInvoiceRepository(db);
const paymentPlanRepo = new DentalPaymentPlanRepository(db);

// createDentalInvoice.ts:36
const invoiceRepo = new DentalInvoiceRepository(db);
```
Pattern is identical across all 14 handler files — repos instantiated inline, not injected.

**DI pattern:** None. No singleton export, no factory, no container. Each request creates fresh repo instances.

**Drizzle access path:** Handlers call `ctx.get('database')` then pass `db` to `new Repo(db)`. Drizzle never called directly in handler — repo layer is correctly interposed. This is a positive signal.

**Finding EM-BIL-003 (P1):** The absence of a service layer means:
1. Business logic (BR-009, BR-011, BR-012 guards) is non-reusable across handlers
2. No testable unit for business rules independent of HTTP context
3. Adding a second consumer (e.g., a background job) would duplicate orchestration logic

**Recommended remediation:**
```typescript
// services/api-ts/src/handlers/dental-billing/dental-billing.service.ts
export class DentalBillingService {
  constructor(
    private invoiceRepo: DentalInvoiceRepository,
    private paymentRepo: DentalPaymentRepository,
    private planRepo: DentalPaymentPlanRepository,
  ) {}

  async createInvoice(db: DatabaseInstance, body: CreateDentalInvoiceBody, actorId: string) { ... }
  async issueInvoice(db: DatabaseInstance, invoiceId: string, actorId: string) { ... }
  async recordPayment(db: DatabaseInstance, invoiceId: string, body: RecordPaymentBody, actorId: string) { ... }
  async voidInvoice(db: DatabaseInstance, invoiceId: string, actorId: string) { ... }
}

export const dentalBillingService = new DentalBillingService(
  new DentalInvoiceRepository(db),
  new DentalPaymentRepository(db),
  new DentalPaymentPlanRepository(db),
);
```

---

## Stabilization Plan

### Fix now (P0)
- **EM-BIL-001** — Add `assertBranchAccess` (or require `branchId`) to `listDentalInvoices` when no branch filter is provided. Security gap: unauthenticated enumeration of all invoices. Options: (a) require `branchId` query param, or (b) derive accessible branches from session membership and scope query automatically.

### Fix before new work (P1)
- **EM-BIL-002** — Add `'staff_full'` to `assertBranchRole` call in `issueDentalInvoice.ts:28`. One-line fix.
- **EM-BIL-003** — Extract `DentalBillingService` class; move BR guards out of handlers. Medium effort — refactor across 7 write handlers.
- **EM-BIL-004** — Implement domain event publishing for DE-007/008/009. Wire into `createDentalInvoice`, `recordDentalPayment` (paid path), and `voidDentalInvoice` using whatever event bus the platform provides.
- **EM-BIL-005** — Change `throw new ValidationError(...)` → `throw new BusinessLogicError('No billable treatments found for this visit', 'NO_BILLABLE_TREATMENTS')` in `createDentalInvoice.ts:43`. One-line fix; ensures 422 not 400.
- **EM-BIL-006** — Implement WF-042 fee schedule lookup handler. Requires TypeSpec definition + handler + repo query against dental-org fee schedule data.

### Fix when touching (P2)
- **EM-BIL-007** — Reconcile DOMAIN_MODEL SM-INVOICE state label `sent` with implementation label `issued`. Either update DOMAIN_MODEL to match code (simpler) or migrate DB enum from `issued` → `sent` (breaking schema change).
- **EM-BIL-008** — Register `markOverdueInvoices()` with pg-boss scheduler. The repo method is complete; only the job registration is missing.

### Track (P3)
- **EM-BIL-009** — `sent → uncollectible` transition (BR-013) is explicitly deferred per spec. Track as future wave item; no action required before MVP.

---

## What's Next

1. **Immediate:** Apply EM-BIL-001 (P0 auth gap) and EM-BIL-002 (role gap) — both are 1–3 line fixes.
2. **This sprint:** EM-BIL-005 (error code), EM-BIL-008 (pg-boss job registration).
3. **Before v2 feature work:** EM-BIL-003 (service layer extraction) + EM-BIL-004 (domain events).
4. **Backlog:** EM-BIL-006 (WF-042 fee schedule), EM-BIL-007 (terminology sync).

> Next audit: run `/oli-enforce-module --module dental-patient` or `/oli-enforce-fix --module dental-billing` to generate patches for the P0/P1 findings.
