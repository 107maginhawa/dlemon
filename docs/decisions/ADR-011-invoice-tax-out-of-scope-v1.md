# ADR-011: Invoice Tax Out of Scope for V1

**Status**: Accepted
**Date**: 2026-06-18
**Context**: The create-invoice API (`POST /dental/billing/invoices`) exposes no tax input. Both `CreateInvoiceRequestSchema` (auto-generated from TypeSpec at `services/api-ts/src/generated/openapi/validators.ts`) and the TypeSpec source `CreateInvoiceRequest` (`specs/api/src/modules/billing.tsp`) omit any `tax` or tax-rate field entirely. The handler's `const tax = 0` is therefore **consistent with the contract** — it is not a silent-drop bug. The product targets **local-first, single-clinic, buy-once** practices (one jurisdiction, no multi-tenant cloud deployment for v1), so multi-jurisdiction tax calculation has no near-term driver.

---

## Decision

**Invoice tax is out of scope for v1.** Invoices are computed tax-exclusive: `total = subtotal + 0`. The hardcoded `tax = 0` in `createInvoice.ts` is intentional and must be treated as a product decision, not technical debt.

Adding tax support in a future vertical slice requires exactly these steps (and nothing else):
1. Add a `taxRate` (or equivalent) field to `CreateInvoiceRequest` in `specs/api/src/modules/billing.tsp`
2. Regenerate OpenAPI + TypeScript types (`cd specs/api && bun run build`)
3. Regenerate validators and routes (`cd services/api-ts && bun run generate`)
4. Replace the `const tax = 0` line in `createInvoice.ts` with real tax computation
5. Add or update handler tests and contract tests

No other files need to change for basic tax support.

---

## Rationale

| Concern | Defer to v2 (chosen) | Build tax engine now (rejected) |
|---------|----------------------|----------------------------------|
| **Contract alignment** | `tax = 0` matches the TypeSpec contract exactly — the API never accepts a tax input | Adding tax would require a breaking TypeSpec change and full codegen cycle |
| **Product scope** | Single-clinic buy-once; one jurisdiction; no sales-tax/VAT compliance requirement exists for v1 | Tax engines are complex (jurisdiction lookup, rounding rules, exempt categories); wrong scope for a pre-GA launch |
| **Honesty** | The omission is now explicit and documented | Leaving `TODO: Calculate tax` implies it is merely unfinished, not intentionally descoped |

---

## Consequences

- **Positive:** Invoice totals equal subtotals for v1. No tax-jurisdiction complexity in the billing module.
- **Positive:** The `tax` column on the `invoices` table remains nullable — a `null` vs. `0` distinction is preserved for a future migration path (explicit zero vs. not-yet-computed).
- **Trade-off:** Any practice operating in a sales-tax or VAT jurisdiction must add tax manually outside the system (e.g., bake it into line item prices) until v2 tax support lands.
- **No risk to existing tests:** `tax = 0` is the only value tested and the only value the contract permits.

---

## Revisit Triggers

Reopen this ADR when any of the following occur:
- Targeting a sales-tax (US state) or VAT (EU/UK/AU) market
- Multi-tenant cloud launch (different clinics in different jurisdictions)
- A billing integration (e.g., Stripe Tax) is adopted that returns jurisdiction-aware amounts

---

## References

- `services/api-ts/src/handlers/billing/createInvoice.ts` — `const tax = 0` (intentional, per this ADR)
- `specs/api/src/modules/billing.tsp` — `CreateInvoiceRequest` (no tax field)
- `services/api-ts/src/generated/openapi/validators.ts` — `CreateInvoiceRequestSchema` (no tax field, generated)
- `docs/decisions/ADR-004-idempotency.md` — related billing endpoint safety tiers
