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
  subtotalCents: int32;
  discountCents: int32;
  taxCents: int32;
  taxRate: float32;
  totalCents: int32;
  paidCents: int32;
  balanceCents: int32;
  dueDate?: utcDateTime;
  issuedAt?: utcDateTime;
  paidAt?: utcDateTime;
  voidedAt?: utcDateTime;
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

  /** GAP-001: optional client-generated id for offline-first idempotent sync */
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

model PatientBalanceResponse {
  patientId: UUID;
  balanceCents: int32;
  overdueInvoices: int32;
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

model DentalPaymentReceiptResponse {
  receiptNumber: string;
  isVoid: boolean;
  voidedAt: utcDateTime | null;
  voidReason: string | null;
  payment: DentalPaymentReceiptPayment;
  invoice: DentalPaymentReceiptInvoice;
  patient: DentalPaymentReceiptPatient;
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
