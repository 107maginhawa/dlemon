/**
 * Dental Clinical Extras Module
 *
 * Covers FR1.12-1.25:
 * - Prescription (RxNorm coded)
 * - Consent Form (template + signature, immutable after signing)
 * - Attachment (x-ray/photo, tooth-tagged)
 * - Lab Order (state machine: ordered → in_fabrication → delivered → fitted)
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
  in_fabrication,
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
  family_history,
}

// ---------------------------------------------------------------------------
// Models — Prescription
// ---------------------------------------------------------------------------

@example(#{
  id: "rx-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-15T09:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-15T09:00:00Z"),
  version: 1,
  visitId: "vi-1a2b3c4d-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  prescriberMemberId: "m1a2b3c4-0000-4000-8000-000000000001",
  rxNormCode: "313782",
  drugName: "Amoxicillin",
  dosage: "500mg",
  frequency: "3x daily",
  duration: "7 days",
  quantity: "21 capsules",
  instructions: "Take with food. Complete the full course.",
  dispenseAsWritten: true,
}, #{ title: "Amoxicillin prescription post-extraction" })
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

@example(#{
  id: "cf-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-15T08:45:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-15T08:52:00Z"),
  version: 2,
  visitId: "vi-1a2b3c4d-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  templateId: "tmpl-extraction-general",
  templateName: "General Tooth Extraction Consent",
  signedAt: utcDateTime.fromISO("2026-03-15T08:52:00Z"),
  signatureData: "data:image/png;base64,iVBORw0KGgoAAAANS...",
  signed: true,
}, #{ title: "Signed extraction consent form" })
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

@example(#{
  id: "lo-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-10T11:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-18T14:30:00Z"),
  version: 3,
  visitId: "vi-1a2b3c4d-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  labName: "Metro Dental Laboratory",
  description: "PFM crown for tooth #36 — shade A2",
  status: LabOrderStatus.delivered,
  orderedAt: utcDateTime.fromISO("2026-03-10T11:00:00Z"),
  expectedDeliveryDate: utcDateTime.fromISO("2026-03-18T09:00:00Z"),
  deliveredAt: utcDateTime.fromISO("2026-03-18T14:30:00Z"),
  isDefective: false,
}, #{ title: "PFM crown lab order — delivered" })
model LabOrder {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  visitId: UUID;
  patientId: UUID;
  /** FDI tooth notation the lab order is for (spec §7 / WF-017). */
  toothFdi?: string;
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
  /** FDI tooth notation the lab order is for (spec §7 / WF-017). */
  toothFdi?: string;
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

@example(#{
  id: "mh-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2025-06-01T10:00:00Z"),
  updatedAt: utcDateTime.fromISO("2025-06-01T10:00:00Z"),
  version: 1,
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  entryType: MedicalHistoryEntryType.condition,
  codeSystem: "ICD-10",
  code: "K05.1",
  displayName: "Chronic periodontitis",
  notes: "Generalised, moderate severity. Under active management.",
  onsetDate: "2023-01",
  active: true,
}, #{ title: "Chronic periodontitis — active condition" })
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

    // V-CLI-001 / TR-P1-05 / BR-019: supervisor-approval endpoint is
    // contract-present but deferred — handler returns 501 NOT_IMPLEMENTED until
    // the dental_clinical_amendment_approval feature flag is lifted (spec §5/§13/§15).
    @post
    @route("/{visitId}/amendments/{amendmentId}/approve")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("approveAmendment")
    approve(
      @path visitId: UUID,
      @path amendmentId: UUID
    ): ApiOkResponse<Amendment>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;
  }
}
