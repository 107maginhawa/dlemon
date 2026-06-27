/**
 * Dental Billing Module
 *
 * Covers Phase 2.2 billing:
 * - DentalInvoice: visit-based invoices with line items from treatments
 * - DentalPayment: cash/card/bank payments against invoices
 * - DentalPaymentPlan: installment-based payment plans
 * - Status lifecycles, discount application, void workflows
 */

import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

enum DentalInvoiceStatus {
  draft,
  issued,
  partial,
  paid,
  overdue,
  voided,
  // BR-013: terminal write-off state — an issued/partial/overdue invoice the
  // practice has given up collecting. Owner-only, no further payments/voids.
  uncollectible,
}

// §g DQ3: invoice kind discriminator. `standard` bills performed work; `deposit`
// is an advance/downpayment invoice for PLANNED work (one non-treatment line,
// due-on-receipt), excluded from recognized revenue/AR so it is not
// double-counted against the performed-work invoice it later funds.
enum DentalInvoiceKind {
  standard,
  deposit,
}

enum PaymentMethod {
  cash,
  card,
  bank_transfer,
}

enum PaymentPlanStatus {
  on_track,
  behind,
  completed,
  defaulted,
}

enum InstallmentStatus {
  pending,
  paid,
  overdue,
  waived,
}

enum PlanFrequency {
  weekly,
  biweekly,
  monthly,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@example(#{
  id: "inv-1a2b3c4d-0000-4000-8000-000000000001",
  visitId: "v1a2b3c4-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  branchId: "b1a2b3c4-0000-4000-8000-000000000001",
  dentistMemberId: "m1a2b3c4-0000-4000-8000-000000000001",
  invoiceNumber: "INV-2026-0042",
  status: DentalInvoiceStatus.issued,
  kind: DentalInvoiceKind.standard,
  subtotalCents: 36000,
  discountCents: 0,
  taxCents: 0,
  taxRate: 0.0,
  totalCents: 36000,
  paidCents: 0,
  balanceCents: 36000,
  dueDate: utcDateTime.fromISO("2026-04-15T00:00:00Z"),
  issuedAt: utcDateTime.fromISO("2026-03-15T11:30:00Z"),
  createdAt: utcDateTime.fromISO("2026-03-15T11:30:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-15T11:30:00Z"),
}, #{ title: "Issued invoice for composite restoration" })
model DentalInvoice {
  id: UUID;
  visitId: UUID;
  patientId: UUID;
  branchId: UUID;
  dentistMemberId: UUID;
  invoiceNumber: string;
  status: DentalInvoiceStatus;
  /** §g DQ3: `standard` (default) or `deposit`. Deposit invoices are advance
   *  payments on planned work, excluded from recognized revenue/AR. */
  kind: DentalInvoiceKind;
  subtotalCents: int32;
  discountCents: int32;
  taxCents: int32;
  taxRate: float32;
  totalCents: int32;
  paidCents: int32;
  balanceCents: int32;
  /** BR-048: per-invoice payment-terms override (days); resolves to dueDate at issue. */
  paymentTermsDays?: int32;
  dueDate?: utcDateTime;
  issuedAt?: utcDateTime;
  paidAt?: utcDateTime;
  voidedAt?: utcDateTime;

  /**
   * Read-side enrichments populated by listDentalInvoices / getDentalInvoice
   * (patient display name + the visit's calendar date). Optional because the
   * create/void/issue responses do not join them. `visitDate` is a YYYY-MM-DD
   * calendar string and is intentionally typed `string` (not utcDateTime) so the
   * SDK date transformer leaves it verbatim.
   */
  patientName?: string;
  visitDate?: string;

  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model DentalInvoiceLineItem {
  id: UUID;
  invoiceId: UUID;
  treatmentId?: UUID;
  cdtCode?: string;
  description: string;
  toothNumber?: int32;
  unitPriceCents: int32;
  quantity: int32;
  amountCents: int32;
  isDone: boolean;
}

@example(#{
  id: "pay-1a2b3c4d-0000-4000-8000-000000000001",
  invoiceId: "inv-1a2b3c4d-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  branchId: "b1a2b3c4-0000-4000-8000-000000000001",
  amountCents: 36000,
  method: PaymentMethod.card,
  receiptNumber: "RCP-2026-0099",
  recordedByMemberId: "m1a2b3c4-0000-4000-8000-000000000001",
  notes: "Visa card ending 4242",
  isVoid: false,
  createdAt: utcDateTime.fromISO("2026-03-20T09:45:00Z"),
}, #{ title: "Card payment clearing invoice" })
model DentalPayment {
  id: UUID;
  invoiceId: UUID;
  patientId: UUID;
  branchId: UUID;
  amountCents: int32;
  method: PaymentMethod;
  receiptNumber: string;
  recordedByMemberId: UUID;
  notes?: string;
  isVoid: boolean;
  voidedAt?: utcDateTime;
  voidReason?: string;
  // AHA FIX-004 §15 reconcile: the void soft-delete records WHO voided the
  // payment (dental_payment.voided_by_member_id). The handler returns the full
  // row via .returning(), so the wire already carries this on a voided payment;
  // the contract previously omitted it (same drift class as the clinical-B
  // consent revokedBy reconcile). Optional — null until the payment is voided.
  voidedByMemberId?: UUID;
  createdAt: utcDateTime;
}

model DentalPaymentPlan {
  id: UUID;
  invoiceId: UUID;
  patientId: UUID;
  totalCents: int32;
  numberOfInstallments: int32;
  frequency: PlanFrequency;
  startDate: utcDateTime;
  amountPerInstallmentCents: int32;
  status: PaymentPlanStatus;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;

  // AHA FIX-005 §15 reconcile: both createPaymentPlan (201) and getPaymentPlan (200)
  // return the plan WITH its installment schedule (`ctx.json({ ...plan, installments })`)
  // and the Hurl contract already pins `$.installments` — but the model omitted the
  // field, forcing the FE to cast `data as unknown`. Declared now so the SDK type
  // carries it and the FE renders the schedule from typed truth (the
  // DentalPaymentPlanInstallment model below already existed, just unreferenced).
  installments: DentalPaymentPlanInstallment[];
}

model DentalPaymentPlanInstallment {
  id: UUID;
  planId: UUID;
  installmentNumber: int32;
  dueDate: utcDateTime;
  amountCents: int32;
  paidCents: int32;
  paidDate?: utcDateTime;
  status: InstallmentStatus;
}

// ---------------------------------------------------------------------------
// Request Models
// ---------------------------------------------------------------------------

model CreateDentalInvoiceRequest {
  visitId: UUID;
  patientId: UUID;
  branchId: UUID;
  dentistMemberId: UUID;
  taxRate?: float32;
  dueDate?: utcDateTime;

  /** BR-048: optional per-invoice payment-terms override (days, 0–365). When set
   *  and no explicit dueDate is given, dueDate = issuedAt + this at issue. */
  paymentTermsDays?: int32;

  /** GAP-001: optional client-generated id for offline-first idempotent sync */
  localId?: string;
}

// §g: collect a deposit / pay-in-full against a PLANNED treatment estimate. Mints
// a finalized (created-and-issued, due-on-receipt) deposit invoice with one
// non-treatment line. Does NOT touch treatments or the performed|verified billable
// filter. The deposit is paid via the normal recordDentalPayment → BIR OR path and
// later reconciled to the performed-work invoice via the patient-credit bridge.
model CreateDepositInvoiceRequest {
  visitId: UUID;
  patientId: UUID;
  branchId: UUID;
  dentistMemberId: UUID;

  /** Deposit amount in cents (≥ 1). Capped at the visit's planned estimate total
   *  in the handler. VAT is carved out of this gross per the branch tax mode. */
  @minValue(1) depositCents: int32;

  /** Optional client-generated id for offline-first idempotent replay (F-06). */
  localId?: string;
}

model RecordDentalPaymentRequest {
  // V-BIL-010: payments must be for at least 1 cent. Enforced at the schema layer
  // (contract min:1) AND in the handler (422 INVALID_AMOUNT defense-in-depth for
  // direct callers). MODULE_SPEC BR-015 accepts 400 VALIDATION_ERROR for amount bounds.
  @minValue(1) amountCents: int32;

  method: PaymentMethod;

  // V-BIL-009: the human-facing reference/receipt number is optional. When
  // omitted the server generates one; when supplied it doubles as the
  // idempotency key for the payment.
  receiptNumber?: string;

  recordedByMemberId: UUID;

  // V-BIL-009: optional caller-supplied payment date (defaults to now()).
  paymentDate?: utcDateTime;

  notes?: string;
}

// AHA FIX-004 §15 ROADMAP FLAG (deliberate deferral, not an omission): unlike the
// sibling VoidDentalInvoiceRequest below (@minLength(5)/@maxLength(500)), voidReason
// carries NO length bound — and voidDentalPayment.ts does not trim/empty-guard it
// either — so a direct API caller can void a payment (a financial reversal) with an
// empty reason and write an empty-reason audit row. The FE wired in Batch B
// (invoice-detail.tsx handleVoidPayment) imposes a 5-char floor, but the contract +
// handler stay lenient, so the two now diverge on the validation floor. This is a
// server-validation/behavior change (RED-first 422 test + handler guard), out of
// scope for the FE-wiring batch; tracked in dental-billing-fix-report.md Batch B
// roadmap flags. [V2: add @minLength(5)/@maxLength(500) + a handler trim/empty guard,
// mirroring the invoice void; consider the same bound for ApplyDentalDiscountRequest
// .percentageRate (also contract-unbounded, handler-only INVALID_DISCOUNT_RATE).]
model VoidDentalPaymentRequest {
  voidReason: string;
}

// BR/AC: voiding an invoice is an auditable money correction — the caller MUST
// supply a human reason (API_CONTRACTS: min 5, max 500). The handler records it
// on the invoice.voided audit event. An empty body previously 200'd silently.
model VoidDentalInvoiceRequest {
  @minLength(5)
  @maxLength(500)
  reason: string;
}

model CreateDentalPaymentPlanRequest {
  patientId: UUID;

  // V-BIL-002: bound installment count to the contract range (2–24). A count
  // of 0/1 or an unbounded value breaks installment math (division by zero →
  // Infinity) and the agreement semantics. Enforced in handler → 422 INVALID_INSTALLMENT_COUNT.
  numberOfInstallments: int32;

  frequency: PlanFrequency;
  startDate: utcDateTime;
}

model ApplyDentalDiscountRequest {
  reason: string;

  // V-BIL-001: a discount percentage must be within 0–100. An unbounded rate
  // can drive the invoice total negative (money-integrity breach). Enforced in handler → 422 INVALID_DISCOUNT_RATE.
  percentageRate: float32;
}

// ---------------------------------------------------------------------------
// Response Models (Billing Extras)
// ---------------------------------------------------------------------------

// Wire shape matches the tested `getPatientBalance` handler (FR4.4): authoritative
// server-computed aggregates over the patient's non-voided invoices + active plans.
// (Previously drifted to a stale {balanceCents, overdueInvoices} — corrected so the
// SDK type reflects what the handler actually emits.)
model PatientBalanceResponse {
  patientId: UUID;
  totalBilledCents: int32;
  totalPaidCents: int32;
  outstandingBalanceCents: int32;
  overdueAmountCents: int32;
  invoiceCount: int32;
  overdueInvoiceCount: int32;
  activePaymentPlanCount: int32;
}

model CollectionsSummaryResponse {
  totalCollectedCents: int32;
  period: string;
  invoiceCount: int32;
}

// AHA dental-billing FIX-007: reconciled to the implemented (tested) handler
// shape. The receipt is a rich nested document — void info (EC5 watermark),
// patient name, and invoice context — not the never-implemented flat projection.
model DentalPaymentReceiptPayment {
  id: UUID;
  amountCents: int32;
  method: PaymentMethod;
  recordedAt: utcDateTime;
  notes: string | null;
}

model DentalPaymentReceiptInvoice {
  id: UUID;
  invoiceNumber: string;
  totalCents: int32;
  paidCents: int32;
  balanceCents: int32;
  status: string;
}

model DentalPaymentReceiptPatient {
  id: UUID;
  name: string;
}

// BR-055 (PH): BIR-required receipt header from branch settings. Null fields are
// simply not yet configured by the clinic.
model DentalPaymentReceiptClinic {
  registeredName: string | null;
  businessStyle: string | null;
  tin: string | null;
  address: string | null;
  isVatRegistered: boolean;
}

// BR-055 (PH): VAT breakdown on the receipt. For a non-VAT clinic all VAT fields
// are 0 and vatExemptCents carries the full gross.
model DentalPaymentReceiptTax {
  vatRate: float32;
  vatableCents: int32;
  vatExemptCents: int32;
  zeroRatedCents: int32;
  vatCents: int32;
}

model DentalPaymentReceiptResponse {
  receiptNumber: string;
  isVoid: boolean;
  voidedAt: utcDateTime | null;
  voidReason: string | null;
  payment: DentalPaymentReceiptPayment;
  invoice: DentalPaymentReceiptInvoice;
  patient: DentalPaymentReceiptPatient;
  // BR-055 (PH): BIR official-receipt fields.
  orNumber: string;
  clinic: DentalPaymentReceiptClinic;
  tax: DentalPaymentReceiptTax;
  taxStatement: string;
  generatedAt: utcDateTime;
}

// ---------------------------------------------------------------------------
// P2-14: AR aging + statements
// ---------------------------------------------------------------------------

/**
 * Accounts-receivable aging for a single patient. Outstanding balance is
 * bucketed by the age (days since invoice due date, falling back to issue
 * date) of each non-voided invoice's remaining balance.
 */
model ArAgingPatientRow {
  patientId: UUID;
  patientName: string;
  currentCents: int32;
  days30Cents: int32;
  days60Cents: int32;
  days90PlusCents: int32;
  totalOutstandingCents: int32;
  oldestInvoiceDays: int32;
}

/** Practice-wide aging totals across all outstanding patients. */
model ArAgingSummary {
  currentCents: int32;
  days30Cents: int32;
  days60Cents: int32;
  days90PlusCents: int32;
  totalOutstandingCents: int32;
  patientCount: int32;
}

model ArAgingResponse {
  asOf: utcDateTime;
  summary: ArAgingSummary;
  patients: ArAgingPatientRow[];
}

/**
 * A generated patient billing statement summarizing charges, payments, and
 * the resulting balance as of a point in time.
 */
model PatientStatement {
  patientId: UUID;
  patientName: string;
  statementNumber: string;
  asOf: utcDateTime;
  totalChargedCents: int32;
  totalPaidCents: int32;
  totalDiscountCents: int32;
  balanceCents: int32;
  invoiceCount: int32;
  oldestUnpaidInvoiceDays: int32;
}

model GenerateStatementBatchRequest {
  branchId?: UUID;

  /** Optional explicit patient subset; when omitted, every patient with an outstanding balance is included. */
  patientIds?: UUID[];

  /** Statement date; defaults to now(). */
  asOf?: utcDateTime;

  /** When true, include patients whose balance is zero. Defaults to false. */
  includeZeroBalance?: boolean;
}

model GenerateStatementBatchResponse {
  batchId: UUID;
  asOf: utcDateTime;
  statementCount: int32;
  totalBalanceCents: int32;
  statements: PatientStatement[];
}

// ---------------------------------------------------------------------------
// Phase 2.4: Collections worklist + outreach log (BR-051)
// ---------------------------------------------------------------------------

/** Channel a collections contact was made on. */
enum CollectionContactChannel {
  phone,
  email,
  sms,
  in_person: "in-person",
  other,
}

model CreateCollectionNoteRequest {
  patientId: UUID;
  /** Optional specific invoice the contact concerned. */
  invoiceId?: UUID;
  /** Explicit branch (asserts membership); omitted uses the patient's branch. */
  branchId?: UUID;
  @minLength(1) note: string;
  contactChannel: CollectionContactChannel;
  /** When the patient was contacted; defaults to now. */
  contactedAt?: utcDateTime;
}

model CollectionNote {
  id: UUID;
  patientId: UUID;
  invoiceId?: UUID;
  branchId: UUID;
  note: string;
  contactChannel: string;
  contactedAt: utcDateTime;
  createdByMemberId?: UUID;
  createdAt: utcDateTime;
}

/** One actionable overdue-patient row for the collections worklist. */
model CollectionsWorklistRow {
  patientId: UUID;
  patientName: string;
  totalOverdueCents: int32;
  oldestDaysOverdue: int32;
  openInvoiceCount: int32;
  hasActivePlan: boolean;
  lastContactedAt?: utcDateTime;
  lastContactChannel?: string;
  noteCount: int32;
}

model CollectionsWorklistResponse {
  asOf: utcDateTime;
  rows: CollectionsWorklistRow[];
}

// ---------------------------------------------------------------------------
// Phase 4.2: Payment refunds (BR-053)
// ---------------------------------------------------------------------------

model RefundPaymentRequest {
  /** Amount to refund (1 .. remaining refundable on the payment). */
  @minValue(1) amountCents: int32;
  @minLength(3) reason: string;
  /** When true, book the refund to patient credit instead of cash-out. */
  bookAsCredit?: boolean;
}

model RefundPaymentResponse {
  refundId: UUID;
  paymentId: UUID;
  invoiceId: UUID;
  amountCents: int32;
  /** Invoice balance after reversing the refunded amount. */
  invoiceBalanceCents: int32;
  invoiceStatus: string;
  bookedAsCredit: boolean;
  /** Patient credit balance after the refund (only meaningful when booked as credit). */
  creditBalanceCents: int32;
}

// ---------------------------------------------------------------------------
// Phase 4.1: Patient credit ledger (BR-052)
// ---------------------------------------------------------------------------

model PatientCredit {
  id: UUID;
  patientId: UUID;
  branchId: UUID;
  /** Signed: > 0 adds credit, < 0 consumes it. */
  amountCents: int32;
  source: string;
  invoiceId?: UUID;
  note?: string;
  createdAt: utcDateTime;
}

model AddPatientCreditRequest {
  /** Amount to add (must be > 0). */
  @minValue(1) amountCents: int32;
  /** manual | overpayment | refund */
  source: string;
  branchId?: UUID;
  note?: string;
}

model PatientCreditLedgerResponse {
  patientId: UUID;
  /** Available credit = sum of the ledger. */
  balanceCents: int32;
  credits: PatientCredit[];
}

model ApplyCreditRequest {
  /** Amount of credit to apply to the invoice (must be > 0). */
  @minValue(1) amountCents: int32;
}

model ApplyCreditResponse {
  invoiceId: UUID;
  appliedCents: int32;
  /** Invoice balance after applying the credit. */
  invoiceBalanceCents: int32;
  invoiceStatus: string;
  /** Patient's remaining available credit after the draw. */
  remainingCreditCents: int32;
}

// ---------------------------------------------------------------------------
// Phase 3.1: AR KPI dashboard (read-only analytics)
// ---------------------------------------------------------------------------

model AgingBucketPoint {
  /** current | days30 | days60 | days90Plus */
  bucket: string;
  amountCents: int32;
}

model CollectionsKpiResponse {
  asOf: utcDateTime;
  /** Active receivables (non-voided, non-uncollectible balance). */
  outstandingArCents: int32;
  /** Balance on invoices written off as uncollectible. */
  writeOffCents: int32;
  billedTotalCents: int32;
  collectedTotalCents: int32;
  /** collectedTotal / billedTotal, 0..1. */
  collectionRate: float32;
  /** Days Sales Outstanding (approx: AR / avg daily billing). */
  dsoDays: int32;
  /** Current AR aging breakdown for the dashboard chart. */
  agingSeries: AgingBucketPoint[];
}

/** BR-050: manual dunning nudge — send a patient their current statement now. */
model SendPatientStatementRequest {
  /** Explicit branch (asserts membership); omitted scopes to the caller's branches. */
  branchId?: UUID;
}

model SendPatientStatementResponse {
  patientId: UUID;
  /** Whether a statement notification was enqueued (false when balance is zero). */
  sent: boolean;
  outstandingBalanceCents: int32;
  /** Channels the statement was enqueued on (e.g. ["email","push"]). */
  channels: string[];
}

// ---------------------------------------------------------------------------
// P1-26: Insurance / Revenue-Cycle (PH HMO) — invoice-anchored multi-line claim,
// remittance posting, coverage estimate, AR-by-payer aging.
// PH-shaped: submission = "mark submitted + attach reference"; NO EDI 837/835,
// NO real-time eligibility, NO PPO fee schedule, NO clearinghouse.
// ---------------------------------------------------------------------------

@doc("Lifecycle of an invoice-anchored HMO claim (PH workflow)")
enum InsuranceClaimStatus {
  draft,
  ready,
  submitted,
  under_review,
  approved,
  partially_paid,
  paid,
  denied,
  appealed,
  written_off,
}

@doc("How a claim was submitted to the payer (no EDI/clearinghouse)")
enum SubmissionChannel {
  portal,
  email,
  fax,
  in_person,
  other,
}

@doc("Per-procedure claim-line coverage status")
enum ClaimLineStatus {
  pending,
  covered,
  partial,
  disallowed,
}

@doc("How an HMO remittance was received")
enum PayerPaymentMethod {
  bank_transfer,
  check,
  portal,
}

@doc("One per-procedure line on an insurance claim")
model InsuranceClaimLine {
  id: UUID;
  claimId: UUID;
  treatmentId?: UUID;
  invoiceLineItemId?: UUID;
  cdtCode: string;
  description: string;
  billedAmountCents: int32;
  approvedAmountCents?: int32;
  paidAmountCents: int32;
  status: ClaimLineStatus;
}

@doc("An invoice-anchored, multi-line HMO claim (the submittable unit)")
model InsuranceClaim {
  id: UUID;
  patientId: UUID;
  insuranceProfileId: UUID;
  branchId: UUID;
  invoiceId?: UUID;
  visitId?: UUID;
  authorizationId?: UUID;
  claimNumber: string;
  payerReference?: string;
  status: InsuranceClaimStatus;
  submissionChannel?: SubmissionChannel;
  billedAmountCents: int32;
  approvedAmountCents?: int32;
  paidByPayerCents: int32;
  disallowedCents?: int32;
  patientPortionCents: int32;
  denialReason?: string;
  submittedAt?: utcDateTime;
  decisionAt?: utcDateTime;
  paidAt?: utcDateTime;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

@doc("A claim with its line items (and any transition warnings)")
model InsuranceClaimWithLines {
  ...InsuranceClaim;
  lines: InsuranceClaimLine[];
}

@doc("Body to create an invoice-anchored claim")
model CreateInsuranceClaimRequest {
  patientId: UUID;
  insuranceProfileId: UUID;

  @doc("Invoice to anchor the claim to; lines are derived from it when none supplied")
  invoiceId?: UUID;

  visitId?: UUID;

  @doc("Optional coverage authorization (LOA) backing the claim")
  authorizationId?: UUID;

  submissionChannel?: SubmissionChannel;

  @doc("Inline claim lines (omit to derive from the invoice's line items)")
  lines?: CreateInsuranceClaimLineRequest[];
}

@doc("A claim line on a create/add request")
model CreateInsuranceClaimLineRequest {
  treatmentId?: UUID;
  invoiceLineItemId?: UUID;
  @minLength(1) cdtCode: string;
  @minLength(1) description: string;
  @minValue(0) billedAmountCents: int32;
}

@doc("Body to transition a claim's status (FSM-validated)")
model UpdateInsuranceClaimStatusRequest {
  status: InsuranceClaimStatus;
  @doc("Payer tracking reference, captured on submit")
  payerReference?: string;
  submissionChannel?: SubmissionChannel;
  @doc("Reason captured on a denial")
  denialReason?: string;
}

@doc("Body to update a claim line after a payer decision")
model UpdateInsuranceClaimLineRequest {
  @minValue(0) approvedAmountCents?: int32;
  @minValue(0) paidAmountCents?: int32;
  status?: ClaimLineStatus;
  description?: string;
  @minValue(0) billedAmountCents?: int32;
}

@doc("An HMO remittance posting (the PH EOB-posting analogue)")
model PayerPayment {
  id: UUID;
  claimId: UUID;
  insuranceProfileId: UUID;
  branchId: UUID;
  invoiceId?: UUID;
  amountCents: int32;
  remittanceReference?: string;
  method: PayerPaymentMethod;
  disallowanceCents?: int32;
  disallowanceReason?: string;
  createdAt: utcDateTime;
}

@doc("Body to post an HMO remittance against a claim")
model RecordRemittanceRequest {
  @doc("Amount the payer remitted, in centavos")
  @minValue(0) amountCents: int32;

  @doc("Payer remittance reference (idempotency key per claim)")
  remittanceReference?: string;

  @doc("Remittance date (YYYY-MM-DD)")
  @pattern("^\\d{4}-\\d{2}-\\d{2}$")
  remittedAt?: string;

  method?: PayerPaymentMethod;

  @doc("Disallowed/contractual-gap amount to write off, in centavos")
  @minValue(0) disallowanceCents?: int32;

  disallowanceReason?: string;
}

@doc("Result of posting a remittance")
model RecordRemittanceResult {
  payerPayment: PayerPayment;
  claim: InsuranceClaim;
}

@doc("A planned line for a coverage estimate")
model CoverageEstimateLine {
  @minLength(1) cdtCode: string;
  @minValue(0) billedAmountCents: int32;
  description?: string;
}

@doc("Body for a read-only coverage estimate (no persistence)")
model CoverageEstimateRequest {
  patientId?: UUID;
  insuranceProfileId?: UUID;
  authorizationId?: UUID;
  lines: CoverageEstimateLine[];
}

@doc("Per-line coverage estimate result")
model CoverageEstimateLineResult {
  cdtCode: string;
  description?: string;
  billedAmountCents: int32;
  coveredCents: int32;
  patientPortionCents: int32;
  uncovered: boolean;
}

@doc("Coverage estimate result (covered vs patient portion)")
model CoverageEstimateResult {
  estimatedCoveredCents: int32;
  estimatedPatientPortionCents: int32;
  estimatedBilledCents: int32;
  perLine: CoverageEstimateLineResult[];
  cappedByAnnualLimit: boolean;
  uncoveredProcedures: string[];
}

@doc("Claim worklist page")
model InsuranceClaimList {
  items: InsuranceClaim[];
  total: int32;
}

@doc("AR aging row for one payer")
model PayerArRow {
  insuranceProfileId: UUID;
  payerName: string;
  currentCents: int32;
  days30Cents: int32;
  days60Cents: int32;
  days90PlusCents: int32;
  totalOutstandingCents: int32;
  claimCount: int32;
  oldestClaimDays: int32;
}

@doc("Practice-wide AR-by-payer totals")
model PayerArSummary {
  currentCents: int32;
  days30Cents: int32;
  days60Cents: int32;
  days90PlusCents: int32;
  totalOutstandingCents: int32;
  payerCount: int32;
  claimCount: int32;
}

@doc("AR-by-payer aging response")
model PayerArAgingResponse {
  asOf: utcDateTime;
  summary: PayerArSummary;
  payers: PayerArRow[];
}

// ---------------------------------------------------------------------------
// API Interfaces
// ---------------------------------------------------------------------------

namespace DentalBillingModule {
  @doc("P1-26 insurance / revenue-cycle (PH HMO)")
  interface RevenueCycle {
    @doc("Create an invoice-anchored, multi-line HMO claim")
    @operationId("createInsuranceClaim")
    @post
    @route("/claims")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    createInsuranceClaim(@body body: CreateInsuranceClaimRequest):
      | ApiCreatedResponse<InsuranceClaimWithLines>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Claim worklist — filter by branch, status, payer, patient")
    @operationId("listInsuranceClaims")
    @get
    @route("/claims")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listInsuranceClaims(
      @query branchId?: UUID,
      @query status?: InsuranceClaimStatus,
      @query insuranceProfileId?: UUID,
      @query patientId?: UUID,
    ):
      | ApiOkResponse<InsuranceClaimList>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;

    @doc("AR-by-payer aging worklist (outstanding claims bucketed by age)")
    @operationId("getPayerArAging")
    @get
    @route("/claims/aging")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getPayerArAging(@query branchId?: UUID, @query asOf?: utcDateTime):
      | ApiOkResponse<PayerArAgingResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ErrorResponse;

    @doc("Read-only coverage estimate (covered vs patient portion); no persistence")
    @operationId("estimateClaimCoverage")
    @post
    @route("/estimate")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    estimateClaimCoverage(@body body: CoverageEstimateRequest):
      | ApiOkResponse<CoverageEstimateResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ErrorResponse;

    @doc("Get a claim with its line items")
    @operationId("getInsuranceClaim")
    @get
    @route("/claims/{claimId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getInsuranceClaim(@path claimId: UUID):
      | ApiOkResponse<InsuranceClaimWithLines>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Transition a claim's status (FSM-validated)")
    @operationId("updateInsuranceClaimStatus")
    @patch(#{ implicitOptionality: false })
    @route("/claims/{claimId}/status")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateInsuranceClaimStatus(@path claimId: UUID, @body body: UpdateInsuranceClaimStatusRequest):
      | ApiOkResponse<InsuranceClaim>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Add a line to a draft claim")
    @operationId("addInsuranceClaimLine")
    @post
    @route("/claims/{claimId}/lines")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    addInsuranceClaimLine(@path claimId: UUID, @body body: CreateInsuranceClaimLineRequest):
      | ApiCreatedResponse<InsuranceClaimLine>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Update a claim line after a payer decision")
    @operationId("updateInsuranceClaimLine")
    @patch(#{ implicitOptionality: false })
    @route("/claims/{claimId}/lines/{lineId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    updateInsuranceClaimLine(@path claimId: UUID, @path lineId: UUID, @body body: UpdateInsuranceClaimLineRequest):
      | ApiOkResponse<InsuranceClaimLine>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ErrorResponse;

    @doc("Post an HMO remittance against a claim (payment + disallowance write-off)")
    @operationId("recordClaimRemittance")
    @post
    @route("/claims/{claimId}/remittance")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    recordClaimRemittance(@path claimId: UUID, @body body: RecordRemittanceRequest):
      | ApiCreatedResponse<RecordRemittanceResult>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ErrorResponse;
  }

  interface InvoiceManagement {
    @post
    @route("/invoices")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createDentalInvoice")
    createInvoice(
      @body body: CreateDentalInvoiceRequest
    ): ApiCreatedResponse<DentalInvoice>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    // §g: deposit/pay-in-full on a planned estimate. Mints a finalized
    // (issued, due-on-receipt) kind='deposit' invoice. Owner/associate only.
    @post
    @route("/invoices/deposit")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createDentalDepositInvoice")
    createDepositInvoice(
      @body body: CreateDepositInvoiceRequest
    ): ApiCreatedResponse<DentalInvoice>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/invoices")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listDentalInvoices")
    listInvoices(
      @query patientId?: UUID,
      @query branchId?: UUID,
      @query status?: DentalInvoiceStatus
    ): ApiOkResponse<PaginatedResponse<DentalInvoice>>
      | ApiUnauthorizedResponse;

    @get
    @route("/invoices/{invoiceId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getDentalInvoice")
    getInvoice(
      @path invoiceId: UUID
    ): ApiOkResponse<DentalInvoice>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    // V-BIL-008: issue is a state transition on an existing invoice → PATCH
    // (per MODULE_SPEC §10), not POST.
    @patch
    @route("/invoices/{invoiceId}/issue")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("issueDentalInvoice")
    issueInvoice(
      @path invoiceId: UUID
    ): ApiOkResponse<DentalInvoice>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/invoices/{invoiceId}/void")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("voidDentalInvoice")
    voidInvoice(
      @path invoiceId: UUID,
      @body body: VoidDentalInvoiceRequest
    ): ApiOkResponse<DentalInvoice>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    // V-BIL-006 / BR-013 / AC-BIL-005: write-off endpoint. Owner-only; transitions
    // an issued/partial/overdue invoice to the terminal `uncollectible` state.
    // Rejects paid/voided/draft. Implemented 2026-06-04 (BR-013 promoted).
    @post
    @route("/invoices/{invoiceId}/uncollectible")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("markUncollectible")
    markUncollectible(
      @path invoiceId: UUID
    ): ApiOkResponse<DentalInvoice>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/invoices/{invoiceId}/payments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("recordDentalPayment")
    recordPayment(
      @path invoiceId: UUID,
      @body body: RecordDentalPaymentRequest
    ): ApiCreatedResponse<DentalPayment>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/invoices/{invoiceId}/payments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listDentalPayments")
    listPayments(
      @path invoiceId: UUID
    ): ApiOkResponse<PaginatedResponse<DentalPayment>>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/invoices/{invoiceId}/payments/{paymentId}/void")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("voidDentalPayment")
    voidPayment(
      @path invoiceId: UUID,
      @path paymentId: UUID,
      @body body: VoidDentalPaymentRequest
    ): ApiOkResponse<DentalPayment>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/invoices/{invoiceId}/discount")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("applyDentalDiscount")
    applyDiscount(
      @path invoiceId: UUID,
      @body body: ApplyDentalDiscountRequest
    ): ApiOkResponse<DentalInvoice>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/invoices/{invoiceId}/plan")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createDentalPaymentPlan")
    createPaymentPlan(
      @path invoiceId: UUID,
      @body body: CreateDentalPaymentPlanRequest
    ): ApiCreatedResponse<DentalPaymentPlan>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/invoices/{invoiceId}/plan")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getDentalPaymentPlan")
    getPaymentPlan(
      @path invoiceId: UUID
    ): ApiOkResponse<DentalPaymentPlan>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface BillingExtras {
    @get
    @route("/patients/{patientId}/balance")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getPatientBalance")
    getPatientBalance(
      @path patientId: UUID
    ): ApiOkResponse<PatientBalanceResponse>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    // BR-050: manual statement send (collections "send statement" action).
    @post
    @route("/patients/{patientId}/statement/send")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("sendPatientStatement")
    sendPatientStatement(
      @path patientId: UUID,
      @body body: SendPatientStatementRequest
    ): ApiOkResponse<SendPatientStatementResponse>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/collections/summary")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getCollectionsSummary")
    getCollectionsSummary(
      @query branchId?: UUID,
      @query period?: string
    ): ApiOkResponse<CollectionsSummaryResponse>
      | ApiUnauthorizedResponse;

    @get
    @route("/invoices/{invoiceId}/payments/{paymentId}/receipt")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getDentalPaymentReceipt")
    getDentalPaymentReceipt(
      @path invoiceId: UUID,
      @path paymentId: UUID
    ): ApiOkResponse<DentalPaymentReceiptResponse>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    // P2-14: AR aging buckets (current / 30 / 60 / 90+) per patient + summary.
    @get
    @route("/collections/aging")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getArAging")
    getArAging(
      @query branchId?: UUID,
      @query asOf?: utcDateTime
    ): ApiOkResponse<ArAgingResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    // Phase 4.2: refund a payment (BR-053) — owner-only, reason-required.
    @post
    @route("/payments/{paymentId}/refund")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("refundDentalPayment")
    refundDentalPayment(
      @path paymentId: UUID,
      @body body: RefundPaymentRequest
    ): ApiOkResponse<RefundPaymentResponse>
      | ApiBadRequestResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    // Phase 4.1: patient credit ledger (BR-052).
    @get
    @route("/patients/{patientId}/credits")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getPatientCredits")
    getPatientCredits(
      @path patientId: UUID
    ): ApiOkResponse<PatientCreditLedgerResponse>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/patients/{patientId}/credits")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("addPatientCredit")
    addPatientCredit(
      @path patientId: UUID,
      @body body: AddPatientCreditRequest
    ): {
      @statusCode statusCode: 201;
      @body body: PatientCredit;
    }
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/invoices/{invoiceId}/apply-credit")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("applyCreditToInvoice")
    applyCreditToInvoice(
      @path invoiceId: UUID,
      @body body: ApplyCreditRequest
    ): ApiOkResponse<ApplyCreditResponse>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    // Phase 3.1: AR KPI dashboard — DSO, collection rate, write-offs, AR + aging.
    @get
    @route("/collections/kpis")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getCollectionsKpis")
    getCollectionsKpis(
      @query branchId?: UUID,
      @query asOf?: utcDateTime
    ): ApiOkResponse<CollectionsKpiResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    // Phase 2.4: collections worklist — overdue patients enriched with last
    // contact + open-invoice/plan state, branch-scoped (EM-BIL-002).
    @get
    @route("/collections/worklist")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getCollectionsWorklist")
    getCollectionsWorklist(
      @query branchId?: UUID,
      @query asOf?: utcDateTime
    ): ApiOkResponse<CollectionsWorklistResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    // Phase 2.4: log a collections outreach attempt (audited, append-only).
    @post
    @route("/collections/notes")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createCollectionNote")
    createCollectionNote(
      @body body: CreateCollectionNoteRequest
    ): {
      @statusCode statusCode: 201;
      @body body: CollectionNote;
    }
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    // P2-14: batch patient statements run.
    @post
    @route("/statements/batch")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("generateStatementBatch")
    generateStatementBatch(
      @body body: GenerateStatementBatchRequest
    ): ApiOkResponse<GenerateStatementBatchResponse>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;
  }
}
