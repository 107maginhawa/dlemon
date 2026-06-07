import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Dental Patient Portal Module (E4 — Phase 1: read-only foundation)
 *
 * Self-scoped READ endpoints for the authenticated PATIENT (Better-Auth system
 * role `user`, linked Person + dental_patient record, NO dental_membership).
 *
 * IDOR safety: these endpoints accept NO client-supplied patientId. The patient
 * identity is derived server-side from the session (user.id === person.id →
 * dental_patient.person_id) via `assertSelfPatient`. A patient can therefore
 * only ever read their OWN data; there is no path/query parameter to tamper.
 *
 * RBAC: every op declares `x-security-required-roles: ["user"]` (the Better-Auth
 * role is always `user`); ownership is enforced in-handler, not by membership.
 *
 * operationIds match the exact exported handler function names under
 * services/api-ts/src/handlers/dental-portal/.
 *
 * DEFERRED (next milestone, NOT built here): /me/visits, /me/treatment-plans,
 * /me/imaging reads, and ONLINE PAYMENTS (needs a payments-vendor + PHI-scope
 * product decision).
 */
namespace DentalPortalModule {
  @doc("A patient-appropriate projection of one of the patient's own appointments")
  model MyAppointment {
    @doc("Appointment id")
    id: UUID;

    @doc("Branch the appointment is at")
    branchId: UUID;

    @doc("Appointment start (ISO 8601 UTC)")
    startAt: utcDateTime;

    @doc("Appointment end (ISO 8601 UTC)")
    endAt: utcDateTime;

    @doc("Visit type (checkup / treatment / emergency / recall / hygiene)")
    visitType: string;

    @doc("Lifecycle status (scheduled / confirmed / checked_in / completed / cancelled / no_show)")
    status: string;

    @doc("When the appointment was confirmed, if it has been (ISO 8601 UTC)")
    confirmedAt: utcDateTime | null;
  }

  @doc("A patient-appropriate projection of one of the patient's own invoices")
  model MyInvoice {
    @doc("Invoice id")
    id: UUID;

    @doc("Human-readable invoice number")
    invoiceNumber: string;

    @doc("Lifecycle status (draft / issued / partial / paid / overdue / voided)")
    status: string;

    @doc("Invoice total in cents")
    totalCents: int32;

    @doc("Amount paid so far in cents")
    paidCents: int32;

    @doc("Outstanding balance in cents")
    balanceCents: int32;

    @doc("Due date, if set (ISO 8601 UTC)")
    dueDate: utcDateTime | null;

    @doc("When the invoice was issued, if it has been (ISO 8601 UTC)")
    issuedAt: utcDateTime | null;
  }

  @doc("The authenticated patient's outstanding-balance summary")
  model MyBalance {
    @doc("Sum of all non-voided invoice totals in cents")
    totalBilledCents: int32;

    @doc("Sum of all non-voided invoice payments in cents")
    totalPaidCents: int32;

    @doc("Sum of all non-voided invoice balances in cents")
    outstandingBalanceCents: int32;

    @doc("Sum of overdue invoice balances in cents")
    overdueAmountCents: int32;

    @doc("Count of non-voided invoices")
    invoiceCount: int32;
  }

  @doc("Self-service patient portal reads (E4 Phase 1)")
  interface PortalSelfReads {
    @doc("List the authenticated patient's own appointments (server-derived identity; no patientId param)")
    @operationId("listMyAppointments")
    @get
    @route("/appointments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    // No ApiNotFoundResponse: these reads take no path param and derive identity
    // from the session, so a 404 is unreachable (the only NotFound source,
    // assertSelfPatient, is not called here).
    listMyAppointments():
      | ApiOkResponse<MyAppointment[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List the authenticated patient's own invoices (server-derived identity; no patientId param)")
    @operationId("listMyInvoices")
    @get
    @route("/invoices")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    listMyInvoices():
      | ApiOkResponse<MyInvoice[]>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get the authenticated patient's own outstanding-balance summary (server-derived identity)")
    @operationId("getMyBalance")
    @get
    @route("/balance")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    getMyBalance():
      | ApiOkResponse<MyBalance>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
