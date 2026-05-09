/**
 * Dental Clinical Extras Module
 *
 * Covers FR1.12-1.25:
 * - Prescription (RxNorm coded)
 * - Consent Form (template + signature, immutable after signing)
 * - Attachment (x-ray/photo, tooth-tagged)
 * - Lab Order (state machine: ordered → inFabrication → delivered → fitted)
 * - Medical History (ICD-10 / SNOMED CT / RxNorm coded entries)
 * - Amendment (additive-only, links to original record)
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

enum LabOrderStatus {
  ordered,
  inFabrication,
  delivered,
  fitted,
  cancelled,
}

enum DentalAttachmentImageType {
  xray,
  photo,
  scan,
  document,
  other,
}

enum MedicalHistoryEntryType {
  condition,
  medication,
  allergy,
  procedure,
  vaccination,
  familyHistory,
}

// ---------------------------------------------------------------------------
// Models — Prescription
// ---------------------------------------------------------------------------

model Prescription {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  visitId: UUID;
  patientId: UUID;
  prescriberMemberId: UUID;
  rxNormCode?: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
  dispenseAsWritten: boolean;
}

model CreatePrescriptionRequest {
  visitId: UUID;
  patientId: UUID;
  prescriberMemberId: UUID;
  rxNormCode?: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
  dispenseAsWritten?: boolean;
}

model UpdatePrescriptionRequest {
  rxNormCode?: string;
  drugName?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
}

// ---------------------------------------------------------------------------
// Models — Consent Form
// ---------------------------------------------------------------------------

model ConsentForm {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  visitId: UUID;
  patientId: UUID;
  templateId: string;
  templateName: string;
  signedAt?: utcDateTime;
  signatureData?: string;
  signed: boolean;
}

model CreateConsentFormRequest {
  visitId: UUID;
  patientId: UUID;
  templateId: string;
  templateName: string;
}

model SignConsentFormRequest {
  signatureData: string;
}

// ---------------------------------------------------------------------------
// Models — Attachment
// ---------------------------------------------------------------------------

model DentalAttachment {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  visitId: UUID;
  patientId: UUID;
  imageType: DentalAttachmentImageType;
  toothNumbers?: int32[];
  fileName: string;
  filePath: string;
  fileSizeBytes: int64;
  mimeType: string;
  note?: string;
}

model CreateDentalAttachmentRequest {
  visitId: UUID;
  patientId: UUID;
  imageType: DentalAttachmentImageType;
  toothNumbers?: int32[];
  fileName: string;
  filePath: string;
  fileSizeBytes: int64;
  mimeType: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Models — Lab Order
// ---------------------------------------------------------------------------

model LabOrder {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  visitId: UUID;
  patientId: UUID;
  labName: string;
  description: string;
  status: LabOrderStatus;
  orderedAt: utcDateTime;
  expectedDeliveryDate?: utcDateTime;
  deliveredAt?: utcDateTime;
  fittedAt?: utcDateTime;
  cancelledAt?: utcDateTime;
  cancelReason?: string;
  isDefective: boolean;
  replacedByOrderId?: UUID;
}

model CreateLabOrderRequest {
  visitId: UUID;
  patientId: UUID;
  labName: string;
  description: string;
  expectedDeliveryDate?: utcDateTime;
}

model UpdateLabOrderRequest {
  status?: LabOrderStatus;
  expectedDeliveryDate?: utcDateTime;
  cancelReason?: string;
  isDefective?: boolean;
}

// ---------------------------------------------------------------------------
// Models — Medical History
// ---------------------------------------------------------------------------

model MedicalHistoryEntry {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  patientId: UUID;
  entryType: MedicalHistoryEntryType;
  /** ICD-10 for conditions, RxNorm for medications/allergies, SNOMED for procedures */
  codeSystem?: string;
  code?: string;
  displayName: string;
  notes?: string;
  onsetDate?: string;
  resolvedDate?: string;
  active: boolean;
}

model CreateMedicalHistoryEntryRequest {
  patientId: UUID;
  entryType: MedicalHistoryEntryType;
  codeSystem?: string;
  code?: string;
  displayName: string;
  notes?: string;
  onsetDate?: string;
  resolvedDate?: string;
}

model UpdateMedicalHistoryEntryRequest {
  displayName?: string;
  notes?: string;
  resolvedDate?: string;
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Models — Amendment
// ---------------------------------------------------------------------------

model Amendment {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  visitId: UUID;
  patientId: UUID;
  authorMemberId: UUID;
  originalRecordType: string;
  originalRecordId: UUID;
  reason: string;
  content: string;
}

model CreateAmendmentRequest {
  visitId: UUID;
  patientId: UUID;
  originalRecordType: string;
  originalRecordId: UUID;
  reason: string;
  content: string;
}

// ---------------------------------------------------------------------------
// API Interfaces
// ---------------------------------------------------------------------------

namespace DentalClinicalModule {
  interface PrescriptionManagement {
    @post
    @route("/{visitId}/prescriptions")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createPrescription")
    create(
      @path visitId: UUID,
      @body body: CreatePrescriptionRequest
    ): ApiCreatedResponse<Prescription>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/prescriptions")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listPrescriptions")
    list(
      @path visitId: UUID
    ): ApiOkResponse<PaginatedResponse<Prescription>>
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/{visitId}/prescriptions/{prescriptionId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updatePrescription")
    update(
      @path visitId: UUID,
      @path prescriptionId: UUID,
      @body body: UpdatePrescriptionRequest
    ): ApiOkResponse<Prescription>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface ConsentFormManagement {
    @post
    @route("/{visitId}/consents")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createConsentForm")
    create(
      @path visitId: UUID,
      @body body: CreateConsentFormRequest
    ): ApiCreatedResponse<ConsentForm>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/consents")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listConsentForms")
    list(
      @path visitId: UUID
    ): ApiOkResponse<PaginatedResponse<ConsentForm>>
      | ApiUnauthorizedResponse;

    @post
    @route("/{visitId}/consents/{consentId}/sign")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("signConsentForm")
    sign(
      @path visitId: UUID,
      @path consentId: UUID,
      @body body: SignConsentFormRequest
    ): ApiOkResponse<ConsentForm>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface AttachmentManagement {
    @post
    @route("/{visitId}/attachments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createAttachment")
    create(
      @path visitId: UUID,
      @body body: CreateDentalAttachmentRequest
    ): ApiCreatedResponse<DentalAttachment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/attachments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listAttachments")
    list(
      @path visitId: UUID
    ): ApiOkResponse<PaginatedResponse<DentalAttachment>>
      | ApiUnauthorizedResponse;

    @delete
    @route("/{visitId}/attachments/{attachmentId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("deleteAttachment")
    deleteAttachment(
      @path visitId: UUID,
      @path attachmentId: UUID
    ): ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface LabOrderManagement {
    @post
    @route("/{visitId}/lab-orders")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createLabOrder")
    create(
      @path visitId: UUID,
      @body body: CreateLabOrderRequest
    ): ApiCreatedResponse<LabOrder>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/lab-orders")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listLabOrders")
    list(
      @path visitId: UUID
    ): ApiOkResponse<PaginatedResponse<LabOrder>>
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/{visitId}/lab-orders/{orderId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateLabOrder")
    update(
      @path visitId: UUID,
      @path orderId: UUID,
      @body body: UpdateLabOrderRequest
    ): ApiOkResponse<LabOrder>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface MedicalHistoryManagement {
    @post
    @route("/medical-history")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createMedicalHistoryEntry")
    create(
      @body body: CreateMedicalHistoryEntryRequest
    ): ApiCreatedResponse<MedicalHistoryEntry>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/medical-history")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listMedicalHistory")
    list(
      @query patientId: UUID
    ): ApiOkResponse<PaginatedResponse<MedicalHistoryEntry>>
      | ApiUnauthorizedResponse;

    @patch(#{implicitOptionality: true})
    @route("/medical-history/{entryId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("updateMedicalHistoryEntry")
    update(
      @path entryId: UUID,
      @body body: UpdateMedicalHistoryEntryRequest
    ): ApiOkResponse<MedicalHistoryEntry>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface AmendmentManagement {
    @post
    @route("/{visitId}/amendments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createAmendment")
    create(
      @path visitId: UUID,
      @body body: CreateAmendmentRequest
    ): ApiCreatedResponse<Amendment>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/amendments")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listAmendments")
    list(
      @path visitId: UUID
    ): ApiOkResponse<PaginatedResponse<Amendment>>
      | ApiUnauthorizedResponse;
  }
}
