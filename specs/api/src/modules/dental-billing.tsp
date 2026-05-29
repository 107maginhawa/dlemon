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

model DentalPaymentReceiptResponse {
  receiptNumber: string;
  amountCents: int32;
  method: PaymentMethod;
  paidAt: utcDateTime;
  invoiceId: UUID;
  patientId: UUID;
}

// ---------------------------------------------------------------------------
// API Interfaces
// ---------------------------------------------------------------------------

namespace DentalBillingModule {
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
      @path invoiceId: UUID
    ): ApiOkResponse<DentalInvoice>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    // V-BIL-006 / BR-013 / AC-BIL-005: write-off endpoint is contract-present
    // but deferred — handler returns 501 NOT_IMPLEMENTED until the
    // dental_billing_uncollectible feature flag is lifted.
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
  }
}
