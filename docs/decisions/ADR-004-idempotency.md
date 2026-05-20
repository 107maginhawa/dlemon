# ADR-004: Idempotency Policy

**Status**: Accepted  
**Date**: 2026-05-08  
**Context**: V2 Audit Gate #6 — no `Idempotency-Key` header support and no retry safety documentation. Duplicate POST requests to financial endpoints could create duplicate records.

---

## Decision

Document endpoint safety tiers. No `Idempotency-Key` header middleware is implemented in Phase 0 — the risk is mitigated by existing unique constraints on the highest-value endpoints. Full middleware is deferred.

**Rule**: Any new financial endpoint that creates a monetary record **must** have an idempotency guard before shipping.

---

## Endpoint Safety Tiers

### Tier 1: Naturally Idempotent (safe to retry)

These endpoints have unique constraints or domain guards that prevent duplicate records:

| Endpoint | Protection | Location |
|----------|-----------|----------|
| `POST /billing/invoices` | `unique('invoices_context_unique')` on `context` column | `billing.schema.ts:67-68` |
| `POST /emr/consultations` | `unique('consultation_notes_context_unique')` on `context` column | `emr.schema.ts:44-45` |
| `POST /reviews` | `unique('reviews_context_reviewer_type_unique')` on `(context, reviewer, reviewType)` | `review.schema.ts:53` |
| `POST /notifs/:id/read` | `// Idempotent: only update if not already read` | `notification.repo.ts:217` |

### Tier 2: At-Risk (no duplicate guard)

These endpoints can create duplicate records on retry. Listed by risk:

| Endpoint | Risk Level | Impact | Notes |
|----------|-----------|--------|-------|
| `POST /dental/billing/invoices/:id/payments` | **HIGH** | Double payment recorded, balance over-counted | No duplicate guard |
| `POST /dental/billing/invoices/:id/discounts` | MEDIUM | Double discount applied | No guard |
| `POST /dental/billing/payment-plans` | MEDIUM | Duplicate payment plan | No guard |

### Tier 3: Low-Risk (duplicates visible and deletable)

These endpoints can create duplicates but the impact is low — staff will see and can delete them:

| Endpoint | Notes |
|----------|-------|
| `POST /dental/appointments` | Double-booking is visible on calendar |
| `POST /dental/visits` | One-per-appointment semantics reduce risk |
| `POST /dental/treatments` | Staff can delete accidental duplicates |
| `POST /dental/lab-orders` | Lab staff will see duplicates |

---

## Existing Partial Mitigations

The `context` field pattern (Tier 1 above) is the recommended approach for new endpoints. It ties a resource to a business event (e.g., a booking ID) via a unique constraint:

```typescript
// In handler: set context = the triggering event's ID
const invoice = await invoiceRepo.createOne({
  context: body.bookingId,  // unique constraint on context
  ...
});
// Duplicate attempt → PostgreSQL unique violation → 409 Conflict
```

---

## Future: Idempotency-Key Middleware

`specs/api/docs/standards/api-side-effects.md:365-373` describes a planned `Idempotency-Key` header pattern for financial operations. Implementation deferred. When implemented:

1. Add Hono middleware that intercepts `Idempotency-Key` header on POST requests
2. Check `idempotency_keys` table: `(key, endpoint)` with 24h TTL
3. On hit: return cached response (same status + body)
4. On miss: execute request, store `(key, endpoint, response, created_at)`, return response
5. Apply to all Tier 2 endpoints as minimum

---

## Consequences

- Tier 2 endpoints remain at risk until middleware is implemented or unique constraints are added
- Frontend must treat double-submit button clicks as a UX issue to solve client-side (disable on submit, debounce)
- The highest-risk endpoint (`POST /dental/billing/invoices/:id/payments`) should get an idempotency guard in Phase 2 (SDK migration phase)
