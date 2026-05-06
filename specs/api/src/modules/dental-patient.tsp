/**
 * Dental Patient Module
 *
 * Manages the dental-specific patient registry:
 * - Patient CRUD (create, read, update, archive, restore)
 * - Bulk operations (bulk-archive, import, export)
 * - Follow-up notes (list, add)
 * - Safety floor (allergies, medications, conditions)
 * - Itemized statement (visits, invoices, payments)
 * - Dentition initialization
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

namespace DentalPatientModule {

  // ==========================================================================
  // Enums
  // ==========================================================================

  @doc("Dental patient status")
  enum DentalPatientStatus {
    active: "active",
    archived: "archived",
  }

  // ==========================================================================
  // Models
  // ==========================================================================

  @doc("Embedded person details on a dental patient response")
  model DentalPatientPerson {
    id: UUID;
    firstName: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
  }

  @doc("Dental patient record")
  model DentalPatient {
    id: UUID;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
    status: DentalPatientStatus;
    needsFollowUp: boolean;
    hasActivePaymentPlan: boolean;
    preferredBranchId?: UUID;
    dentalHistorySummary?: string;
    recallDate?: string;
    recallNote?: string;
    emergencyContact?: Record<unknown>;
    communicationPreferences?: Record<unknown>;
    person?: DentalPatientPerson;
    displayName?: string;
  }

  @doc("Duplicate warning on patient creation")
  model DuplicateWarning {
    hasDuplicates: boolean;
    count: int32;
    duplicateIds: UUID[];
  }

  @doc("Response after creating a dental patient")
  model CreateDentalPatientResponse extends DentalPatient {
    warning?: DuplicateWarning;
  }

  @doc("Create dental patient request")
  model CreateDentalPatientRequest {
    @minLength(1)
    displayName: string;

    dateOfBirth?: string;
    gender?: string;

    @doc("Patient consent must be true")
    consentGiven?: boolean;

    branchId?: UUID;
  }

  @doc("Update dental patient request — all fields optional")
  model UpdateDentalPatientRequest {
    needsFollowUp?: boolean;
    dentalHistorySummary?: string;
    preferredBranchId?: UUID;
    status?: DentalPatientStatus;
    emergencyContact?: Record<unknown>;
    communicationPreferences?: Record<unknown>;
    recallDate?: string;
    recallNote?: string;
  }

  @doc("List dental patients response")
  model ListDentalPatientsResponse {
    patients: DentalPatient[];
    total: int32;
    limit: int32;
    offset: int32;
  }

  @doc("Follow-up note")
  model FollowUpNote {
    id: UUID;
    text: string;
    createdAt: string;
    createdBy: string;
  }

  @doc("List follow-up notes response")
  model ListFollowUpNotesResponse {
    notes: FollowUpNote[];
    total: int32;
  }

  @doc("Add follow-up note request")
  model AddFollowUpNoteRequest {
    @minLength(1)
    text: string;
  }

  @doc("Add follow-up note response")
  model AddFollowUpNoteResponse {
    note: FollowUpNote;
    total: int32;
  }

  @doc("Safety-critical medical entry (allergy, medication, or condition)")
  model SafetyEntry {
    id: UUID;
    displayName: string;
    code?: string;
    codeSystem?: string;
    notes?: string;
    onsetDate?: string;
  }

  @doc("Patient safety floor — minimum safety data required before any procedure")
  model DentalPatientSafetyFloor {
    patientId: UUID;
    hasAlerts: boolean;
    allergies: SafetyEntry[];
    medications: SafetyEntry[];
    conditions: SafetyEntry[];
    retrievedAt: string;
  }

  @doc("Visit summary in statement")
  model StatementVisit {
    id: UUID;
    status: string;
    chiefComplaint?: string;
    completedAt?: utcDateTime;
    createdAt: utcDateTime;
  }

  @doc("Invoice summary in statement")
  model StatementInvoice {
    id: UUID;
    invoiceNumber?: string;
    status: string;
    totalCents: int32;
    paidCents: int32;
    balanceCents: int32;
    issuedAt?: utcDateTime;
    lineItems: Record<unknown>[];
  }

  @doc("Payment summary in statement")
  model StatementPayment {
    id: UUID;
    amountCents: int32;
    method: string;
    isVoid: boolean;
    receiptNumber?: string;
    recordedAt: utcDateTime;
  }

  @doc("Statement summary totals")
  model StatementSummary {
    totalVisits: int32;
    totalInvoices: int32;
    totalPayments: int32;
    totalBilledCents: int32;
    totalPaidCents: int32;
    outstandingBalanceCents: int32;
  }

  @doc("Itemized patient statement")
  model DentalPatientStatement {
    patientId: UUID;
    patientName: string;
    generatedAt: string;
    summary: StatementSummary;
    visits: StatementVisit[];
    invoices: StatementInvoice[];
    payments: StatementPayment[];
  }

  @doc("Single patient row in import body")
  model ImportPatientRow {
    firstName: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    phone?: string;
    email?: string;
    branchId: string;
  }

  @doc("Imported patient record")
  model ImportedPatientRecord {
    id: UUID;
    personId: UUID;
    firstName: string;
    lastName?: string;
    branchId: string;
  }

  @doc("Import patients request — JSON array of patient rows")
  model ImportPatientsRequest {
    patients: ImportPatientRow[];
  }

  @doc("Import patients response")
  model ImportPatientsResponse {
    success: boolean;
    imported: int32;
    total: int32;
    patients: ImportedPatientRecord[];
  }

  @doc("Export patients response (JSON format)")
  model ExportDentalPatientsResponse {
    patients: DentalPatient[];
    exportedAt: string;
    total: int32;
  }

  @doc("Bulk archive request")
  model BulkArchiveDentalPatientsRequest {
    @minItems(1)
    patientIds: UUID[];
  }

  @doc("Per-patient bulk archive result")
  model BulkArchiveResult {
    id: UUID;
    success: boolean;
    reason?: string;
  }

  @doc("Bulk archive response")
  model BulkArchiveDentalPatientsResponse {
    results: BulkArchiveResult[];
    successCount: int32;
    failCount: int32;
  }

  @doc("Tooth state for dentition initialization")
  model InitDentitionTooth {
    toothNumber: int32;
    state: string;
    note?: string;
  }

  @doc("Initialize dentition request")
  model InitializeDentitionRequest {
    @doc("ISO date — used to determine deciduous vs permanent dentition")
    dateOfBirth: string;

    @doc("Dental visit ID to associate the generated chart")
    visitId: UUID;
  }

  @doc("Initialize dentition response")
  model InitializeDentitionResponse {
    chartId: UUID;
    patientId: UUID;
    dentitionType: string;
    toothCount: int32;
    teeth: InitDentitionTooth[];
  }

  // ==========================================================================
  // Interfaces
  // ==========================================================================

  @route("/dental/patients")
  interface DentalPatientManagement {

    @doc("Create a new dental patient")
    @post
    @operationId("createDentalPatient")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    createDentalPatient(@body body: CreateDentalPatientRequest): {
      @statusCode statusCode: 201;
      @body patient: CreateDentalPatientResponse;
    } | ApiUnauthorizedResponse;

    @doc("List dental patients with optional search and filters")
    @get
    @operationId("listDentalPatients")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    listDentalPatients(
      @query q?: string,
      @query needsFollowUp?: boolean,
      @query status?: string,
      @query branchId?: UUID,
      @query limit?: int32,
      @query offset?: int32,
    ): {
      @statusCode statusCode: 200;
      @body response: ListDentalPatientsResponse;
    } | ApiUnauthorizedResponse;

    @doc("Import patients from a JSON array")
    @post
    @route("/import")
    @operationId("importPatients")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    importPatients(@body body: ImportPatientsRequest): {
      @statusCode statusCode: 201;
      @body response: ImportPatientsResponse;
    } | ApiUnauthorizedResponse;

    @doc("Export dental patients as JSON")
    @get
    @route("/export")
    @operationId("exportDentalPatients")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    exportDentalPatients(
      @query branchId?: UUID,
      @query format?: string,
      @query status?: string,
    ): {
      @statusCode statusCode: 200;
      @body response: ExportDentalPatientsResponse;
    } | ApiUnauthorizedResponse;

    @doc("Bulk archive multiple dental patients")
    @post
    @route("/bulk-archive")
    @operationId("bulkArchiveDentalPatients")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    bulkArchiveDentalPatients(@body body: BulkArchiveDentalPatientsRequest): {
      @statusCode statusCode: 200;
      @body response: BulkArchiveDentalPatientsResponse;
    } | ApiUnauthorizedResponse;

    @doc("Get a dental patient by ID")
    @get
    @route("/{id}")
    @operationId("getDentalPatient")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    getDentalPatient(@path id: UUID): {
      @statusCode statusCode: 200;
      @body patient: DentalPatient;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;

    @doc("Update dental patient fields")
    @patch
    @route("/{id}")
    @operationId("updateDentalPatient")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    updateDentalPatient(@path id: UUID, @body body: UpdateDentalPatientRequest): {
      @statusCode statusCode: 200;
      @body patient: DentalPatient;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;

    @doc("Archive a dental patient")
    @post
    @route("/{id}/archive")
    @operationId("archiveDentalPatient")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    archiveDentalPatient(@path id: UUID): {
      @statusCode statusCode: 200;
      @body patient: DentalPatient;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;

    @doc("Restore an archived dental patient")
    @post
    @route("/{id}/restore")
    @operationId("restoreDentalPatient")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    restoreDentalPatient(@path id: UUID): {
      @statusCode statusCode: 200;
      @body patient: DentalPatient;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;

    @doc("List follow-up notes for a patient")
    @get
    @route("/{id}/follow-up-notes")
    @operationId("listFollowUpNotes")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    listFollowUpNotes(@path id: UUID): {
      @statusCode statusCode: 200;
      @body response: ListFollowUpNotesResponse;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;

    @doc("Add a follow-up note to a patient")
    @post
    @route("/{id}/follow-up-notes")
    @operationId("addFollowUpNote")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    addFollowUpNote(@path id: UUID, @body body: AddFollowUpNoteRequest): {
      @statusCode statusCode: 201;
      @body response: AddFollowUpNoteResponse;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;

    @doc("Get the safety floor for a patient — allergies, medications, conditions")
    @get
    @route("/{id}/safety-floor")
    @operationId("getDentalPatientSafetyFloor")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    getDentalPatientSafetyFloor(@path id: UUID): {
      @statusCode statusCode: 200;
      @body response: DentalPatientSafetyFloor;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;

    @doc("Get the itemized statement for a patient")
    @get
    @route("/{id}/statement")
    @operationId("getDentalPatientStatement")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    getDentalPatientStatement(@path id: UUID): {
      @statusCode statusCode: 200;
      @body response: DentalPatientStatement;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;

    @doc("Initialize dentition chart for a patient")
    @post
    @route("/{patientId}/dentition")
    @operationId("initializeDentition")
    @extension("x-security-required-roles", #["user"])
    @useAuth(BearerAuth)
    initializeDentition(@path patientId: UUID, @body body: InitializeDentitionRequest): {
      @statusCode statusCode: 201;
      @body response: InitializeDentitionResponse;
    } | ApiUnauthorizedResponse | ApiNotFoundResponse;
  }
}
