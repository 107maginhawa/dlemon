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
  bankTransfer,
}

enum PaymentPlanStatus {
  onTrack,
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
  amountCents: int32;
  method: PaymentMethod;
  receiptNumber: string;
  recordedByMemberId: UUID;
  notes?: string;
}

model VoidDentalPaymentRequest {
  voidReason: string;
}

model CreateDentalPaymentPlanRequest {
  patientId: UUID;
  numberOfInstallments: int32;
  frequency: PlanFrequency;
  startDate: utcDateTime;
}

model ApplyDentalDiscountRequest {
  reason: string;
  percentageRate: float32;
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
    ): ApiOkResponse<DentalInvoice[]>
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

    @post
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
    ): ApiOkResponse<DentalPayment[]>
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
}
