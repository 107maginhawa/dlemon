# Philippines Localization Roadmap

**Scoped:** 2026-06-19. Target market: 1–3 dentist indie PH clinics.
**Decisions locked** (owner): tax = per-branch mode defaulting to **non-VAT**; BIR receipts = **fields/wording only** (no ATP/CAS e-accreditation); claims = **HMO LOA workflow**.

## Already PH-ready (no work)
- **Currency** — `apps/dentalemon/src/lib/format-currency.ts` is ₱ / en-PH, money stored in centavos. Done.
- **Timezone** — branches carry `Asia/Manila`.
- **Phone** — `phone-input` component exists.

## The real surface is billing + regulatory. Three vertical slices, in order.

---

### Slice 1 — Per-branch tax mode (resolves BR-010)
**Why first:** smallest, unblocks correct receipts (slice 2 needs the VAT breakdown), and closes the one drift the audit found.

Today `createDentalInvoice.ts:94` hardcodes `taxRate=0, taxCents=0`. Make tax **server-derived from a per-branch setting**, still never caller-controlled (keeps EM-BILL-001).

- **Branch setting:** `taxMode: 'non_vat' | 'vat_registered'` (default `non_vat`), `vatRate` (default 12).
- **Invoice compute:** `non_vat` → tax 0; `vat_registered` → 12% (decide VAT-inclusive vs exclusive — PH displayed prices are usually VAT-inclusive, so back-compute VATable + VAT from the gross). Persist the breakdown (vatableCents, vatExemptCents, vatCents).
- **New BR-054:** invoice tax is derived from the branch tax mode, not the caller; non-VAT → 0, VAT-registered → 12% broken out.
- **Vertical TDD:** TypeSpec (branch settings + invoice tax fields) → BE tests (non-VAT 0 / VAT 12% / caller taxRate ignored — this is the test BR-010 was missing) → BE → contract → FE settings toggle (mirrors payment-terms / reminder-cadence panels) → E2E.

### Slice 2 — BIR receipt fields + wording
**Why second:** needs slice 1's VAT breakdown for the VAT-registered receipt.

- **Branch settings:** TIN, registered business name + business style, BIR permit / OR series prefix, registered address.
- **OR number:** decide — reuse `invoiceNumber` as the OR series, or a dedicated BIR OR sequence. (BIR wants a controlled, gapless series.)
- **Receipt template:** add TIN, OR number, registered name/style, address, and the BIR-required wording. Non-VAT → "Non-VAT registered" + "THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX". VAT-registered → VATable / VAT-exempt / zero-rated / VAT-amount breakdown.
- **New BR-055:** printed receipt carries the BIR-required fields + the correct non-VAT vs VAT wording for the branch tax mode.
- **Out of scope (explicit):** ATP / CAS / e-receipt BIR accreditation — separate regulatory process, not v1.
- **Vertical TDD:** TypeSpec (branch BIR settings) → BE tests (receipt payload carries fields + correct wording per tax mode) → BE → contract → FE receipt/print template → E2E.

### Slice 3 — HMO LOA claims workflow (largest)
**Why last:** independent, biggest, and benefits from a stable billing core.

HMO (Maxicare, Intellicare, etc.) is the dominant PH dental payer. Patient presents a **Letter of Authorization (LOA)**: approved procedures + amount + validity. Clinic bills the HMO for the covered portion; patient pays the copay/excess.

- **Payer model:** extend the claim with `payerType: 'philhealth' | 'hmo' | 'private'`.
- **LOA fields:** `loaNumber`, `hmoName`, `approvedAmountCents`, `validUntil`, `coveredProcedures`.
- **Computation:** covered (≤ approved) vs patient copay/excess; invoice splits HMO-billed vs patient-paid.
- **New BR-056+:** LOA validity gate (expired LOA can't be claimed), approved-amount cap (claim ≤ approved), copay = total − covered.
- **Vertical TDD:** TypeSpec (payer + LOA on claim) → BE tests (LOA cap, expiry gate, copay split) → BE → contract → FE (LOA capture on claim + copay display) → E2E.

---

## Sequencing & sizing
| Slice | Size | Gates | New BRs |
|---|---|---|---|
| 1 Tax mode | S | closes BR-010 + FR4.10 drift | BR-054 |
| 2 BIR receipt | M | needs slice 1 | BR-055 |
| 3 HMO LOA | L | independent | BR-056+ |

Each slice: one BR, atomic `withTenantTx`, adversarial tests, contract + FE + E2E, registry updated with the test link (keep the 99% traceability). One slice per commit, per the billing-roadmap pattern.

## Open sub-decisions (resolve at slice start, not now)
- Slice 1: VAT-inclusive vs exclusive pricing (rec: inclusive, back-compute).
- Slice 2: reuse `invoiceNumber` as OR series vs dedicated BIR OR sequence.
- Slice 3: PhilHealth modeling — deferred (HMO-first per scope); revisit after slice 3.
