import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "../core/primitives.tsp";
import "../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Healthcare Administrative Patient Financial — payment recording, receipt generation,
 * payment plan management, promissory notes, and financial counseling sessions for
 * patient-responsibility balances.
 */
namespace Healthcare.Administrative.PatientFinancial;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The lifecycle status of a payment record.")
enum PaymentStatus {
  @doc("The payment is valid and active")
  active,

  @doc("The payment has been cancelled")
  cancelled,

  @doc("The payment was entered in error and should be ignored")
  enteredInError,
}

@doc("The method used to make a payment.")
enum PaymentMethod {
  @doc("Cash payment")
  cash,

  @doc("Credit or debit card payment")
  card,

  @doc("Cheque or check payment")
  check,

  @doc("Electronic bank transfer")
  bankTransfer,

  @doc("Payment by insurance claim")
  insurance,

  @doc("A payment method not covered by other values")
  other,
}

@doc("The recurrence frequency of payment plan installments.")
enum PaymentFrequency {
  @doc("Installments are due weekly")
  weekly,

  @doc("Installments are due every two weeks")
  biweekly,

  @doc("Installments are due monthly")
  monthly,
}

@doc("The lifecycle status of a payment plan.")
enum PaymentPlanStatus {
  @doc("The payment plan is active and installments are being collected")
  active,

  @doc("All installments have been paid and the plan is fulfilled")
  completed,

  @doc("The patient has missed payments and the plan is in default")
  defaulted,

  @doc("The payment plan has been cancelled")
  cancelled,
}

@doc("The status of a single payment plan installment.")
enum InstallmentStatus {
  @doc("The installment is not yet due or awaiting payment")
  pending,

  @doc("The installment has been paid")
  paid,

  @doc("The installment is past its due date and unpaid")
  overdue,

  @doc("The installment has been waived by the facility")
  waived,
}

@doc("The lifecycle status of a promissory note.")
enum PromissoryNoteStatus {
  @doc("The promissory note is active and the obligation is outstanding")
  active,

  @doc("The promissory note has been fully paid")
  paid,

  @doc("The promissory note has been voided")
  voided,

  @doc("The patient has defaulted on the promissory note")
  defaulted,
}

@doc("The outcome of a financial counseling session.")
enum CounselingOutcome {
  @doc("A payment arrangement was established")
  paymentArranged,

  @doc("The patient was approved for financial assistance")
  financialAssistance,

  @doc("The patient will self-pay without assistance or plan")
  selfPay,

  @doc("The patient was referred to another assistance programme")
  referred,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A single installment within a patient payment plan.")
model Installment {
  @doc("The sequential number of this installment within the plan")
  sequence: int32;

  @doc("The date on which this installment is due")
  dueDate: plainDate;

  @doc("The amount due for this installment")
  amount: Money;

  @doc("The date and time on which this installment was paid")
  paidDate?: utcDateTime;

  @doc("The current status of this installment")
  status: InstallmentStatus;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A patient payment recorded against an account or encounter balance.")
model Payment extends HealthcareBaseEntity {
  @doc("The lifecycle status of this payment record")
  status: PaymentStatus;

  @doc("The monetary amount of this payment")
  amount: Money;

  @doc("The method used to make the payment")
  paymentMethod: PaymentMethod;

  @doc("The patient responsible for this payment")
  patient: Reference;

  @doc("The encounter this payment is associated with, if applicable")
  encounter?: Reference;

  @doc("The date and time at which the payment was made")
  paidAt: utcDateTime;

  @doc("The person or entity that made the payment (if different from the patient)")
  paidBy?: Reference;

  @doc("The receipt number issued for this payment")
  @maxLength(50)
  receiptNumber?: string;

  @doc("Reference to the invoice or billing statement satisfied by this payment")
  invoiceReference?: Reference;

  @doc("Additional free-text note about this payment")
  @maxLength(1000)
  note?: string;
}

@doc("An official receipt issued to a patient summarising one or more payments.")
model Receipt extends HealthcareBaseEntity {
  @doc("Auto-generated sequential receipt number")
  @maxLength(50)
  receiptNumber: string;

  @doc("The patient to whom the receipt was issued")
  patient: Reference;

  @doc("The payment records included in this receipt")
  payments: Reference[];

  @doc("The total amount covered by this receipt")
  totalAmount: Money;

  @doc("The date and time at which the receipt was issued")
  issuedAt: utcDateTime;

  @doc("The staff member who issued the receipt")
  issuedBy?: Reference;

  @doc("Whether this receipt has been voided")
  voided?: boolean;

  @doc("The reason the receipt was voided, if applicable")
  @maxLength(500)
  voidReason?: string;
}

@doc("A structured instalment plan for a patient to pay a balance over time.")
model PaymentPlan extends HealthcareBaseEntity {
  @doc("The patient responsible for the payment plan")
  patient: Reference;

  @doc("The total balance amount to be paid under this plan")
  totalAmount: Money;

  @doc("The down payment made at plan inception, if any")
  downPayment?: Money;

  @doc("The number of installments in the plan")
  installmentCount: int32;

  @doc("The amount due per installment")
  installmentAmount: Money;

  @doc("The frequency at which installments are due")
  frequency: PaymentFrequency;

  @doc("The date of the first installment")
  startDate: plainDate;

  @doc("The current status of the payment plan")
  status: PaymentPlanStatus;

  @doc("The individual installment schedule")
  installments: Installment[];
}

@doc("A signed promissory note committing a patient to pay a specified amount.")
model PromissoryNote extends HealthcareBaseEntity {
  @doc("The patient who signed the promissory note")
  patient: Reference;

  @doc("The monetary amount promised under the note")
  amount: Money;

  @doc("The terms and conditions of the promissory note")
  @maxLength(2000)
  terms: string;

  @doc("The date and time at which the note was signed")
  signedAt: utcDateTime;

  @doc("The patient or authorised representative who signed the note")
  signedBy: Reference;

  @doc("The witness to the signing, if applicable")
  witnessedBy?: Reference;

  @doc("The date by which the promised amount must be paid")
  dueDate?: plainDate;

  @doc("The current status of the promissory note")
  status: PromissoryNoteStatus;
}

@doc("A financial counseling session conducted to assess patient responsibility and assistance options.")
model FinancialCounseling extends HealthcareBaseEntity {
  @doc("The patient who attended the counseling session")
  patient: Reference;

  @doc("The encounter associated with the counseling session, if applicable")
  encounter?: Reference;

  @doc("The financial counselor who conducted the session")
  counselor: Reference;

  @doc("The date and time of the counseling session")
  date: utcDateTime;

  @doc("The estimated total charges discussed during the session")
  estimatedCharges?: Money;

  @doc("The estimated insurance coverage amount discussed")
  insuranceCoverage?: Money;

  @doc("The patient's estimated out-of-pocket responsibility")
  patientResponsibility?: Money;

  @doc("Financial assistance programmes discussed during the session")
  assistanceProgramsDiscussed?: string[];

  @doc("The outcome of the counseling session")
  outcome: CounselingOutcome;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for Payment resources.")
model PaymentSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by payment status")
  @query status?: PaymentStatus;

  @doc("Filter by payment method")
  @query paymentMethod?: PaymentMethod;

  @doc("Filter payments made on or after this date-time")
  @query paidFrom?: utcDateTime;

  @doc("Filter payments made on or before this date-time")
  @query paidTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for Receipt resources.")
model ReceiptSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by receipt number (partial match)")
  @query receiptNumber?: string;

  @doc("Filter by voided state")
  @query voided?: boolean;

  ...PaginationQuery;
}

@doc("Search parameters for PaymentPlan resources.")
model PaymentPlanSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by payment plan status")
  @query status?: PaymentPlanStatus;

  @doc("Filter by payment frequency")
  @query frequency?: PaymentFrequency;

  ...PaginationQuery;
}

@doc("Search parameters for PromissoryNote resources.")
model PromissoryNoteSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by promissory note status")
  @query status?: PromissoryNoteStatus;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for Payment resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface PaymentManagement {
  @doc("Record a new patient payment.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createPayment")
  create(
    @body body: Payment,
  ): {
    @statusCode statusCode: 201;
    @body payment: Payment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Payment by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getPayment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body payment: Payment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Payment record.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @operationId("updatePayment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Payment,
  ): {
    @statusCode statusCode: 200;
    @body payment: Payment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Payment record.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchPayment")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body payment: Payment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Payment record by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deletePayment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Payment resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchPayments")
  @route("/search")
  search(
    ...PaymentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Payment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for Receipt resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface ReceiptManagement {
  @doc("Issue a new Receipt.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createReceipt")
  create(
    @body body: Receipt,
  ): {
    @statusCode statusCode: 201;
    @body receipt: Receipt;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Receipt by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getReceipt")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body receipt: Receipt;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a Receipt (e.g., to void it).")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchReceipt")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body receipt: Receipt;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Receipt resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchReceipts")
  @route("/search")
  search(
    ...ReceiptSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Receipt>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for PaymentPlan resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface PaymentPlanManagement {
  @doc("Create a new PaymentPlan.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createPaymentPlan")
  create(
    @body body: PaymentPlan,
  ): {
    @statusCode statusCode: 201;
    @body paymentPlan: PaymentPlan;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single PaymentPlan by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getPaymentPlan")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body paymentPlan: PaymentPlan;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing PaymentPlan.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @put
  @operationId("updatePaymentPlan")
  @route("/{id}")
  update(
    @path id: string,
    @body body: PaymentPlan,
  ): {
    @statusCode statusCode: 200;
    @body paymentPlan: PaymentPlan;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a PaymentPlan.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchPaymentPlan")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body paymentPlan: PaymentPlan;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a PaymentPlan by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deletePaymentPlan")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for PaymentPlan resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchPaymentPlans")
  @route("/search")
  search(
    ...PaymentPlanSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PaymentPlan>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for PromissoryNote resources.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface PromissoryNoteManagement {
  @doc("Create a new PromissoryNote.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @post
  @operationId("createPromissoryNote")
  create(
    @body body: PromissoryNote,
  ): {
    @statusCode statusCode: 201;
    @body promissoryNote: PromissoryNote;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single PromissoryNote by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("getPromissoryNote")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body promissoryNote: PromissoryNote;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a PromissoryNote (e.g., status transition).")
  @extension("x-security-required-roles", #["admin", "biller"])
  @patch
  @operationId("patchPromissoryNote")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body promissoryNote: PromissoryNote;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a PromissoryNote by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deletePromissoryNote")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for PromissoryNote resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @get
  @operationId("searchPromissoryNotes")
  @route("/search")
  search(
    ...PromissoryNoteSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PromissoryNote>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD operations for FinancialCounseling session records.")
@tag("Healthcare:Administrative")
@useAuth(bearerAuth)
interface FinancialCounselingManagement {
  @doc("Record a new FinancialCounseling session.")
  @extension("x-security-required-roles", #["admin", "biller", "scheduler"])
  @post
  @operationId("createFinancialCounseling")
  create(
    @body body: FinancialCounseling,
  ): {
    @statusCode statusCode: 201;
    @body financialCounseling: FinancialCounseling;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single FinancialCounseling session by id.")
  @extension("x-security-required-roles", #["admin", "biller", "scheduler"])
  @get
  @operationId("getFinancialCounseling")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body financialCounseling: FinancialCounseling;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing FinancialCounseling session record.")
  @extension("x-security-required-roles", #["admin", "biller", "scheduler"])
  @put
  @operationId("updateFinancialCounseling")
  @route("/{id}")
  update(
    @path id: string,
    @body body: FinancialCounseling,
  ): {
    @statusCode statusCode: 200;
    @body financialCounseling: FinancialCounseling;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a FinancialCounseling session record by id.")
  @extension("x-security-required-roles", #["admin", "biller"])
  @delete
  @operationId("deleteFinancialCounseling")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
