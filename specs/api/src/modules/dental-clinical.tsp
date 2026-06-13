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

/**
 * DEA controlled-substance schedule for a prescription.
 * `none` is the default for non-controlled drugs. II–V follow the US DEA
 * classification (21 CFR 1308). Additive/optional — does not affect the
 * non-controlled ₱/PH prescribing flow.
 */
enum ControlledSubstanceSchedule {
  none,
  ii: "II",
  iii: "III",
  iv: "IV",
  v: "V",
}

/**
 * Prescription lifecycle status (EM-CLI-012).
 * FSM: `pending` → `dispensed` | `cancelled` (both terminal). New
 * prescriptions default to `pending`; the transition is externally driven
 * (pharmacy dispense/cancel) so it stays allowed even on a locked/completed
 * visit — the same carve-out as lab orders (§13).
 */
enum PrescriptionStatus {
  pending,
  dispensed,
  cancelled,
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
  status: PrescriptionStatus.pending,
  controlledSubstanceSchedule: ControlledSubstanceSchedule.none,
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

  /**
   * Lifecycle status (EM-CLI-012). Always present on every response; the row
   * defaults to `pending` and transitions to `dispensed`/`cancelled` via PATCH.
   * Read-only on this response model — clients change it through
   * `UpdatePrescriptionRequest.status`.
   */
  status: PrescriptionStatus;

  /**
   * P2-13: US-context legal Rx fields (record-only; EPCS/Surescripts
   * transmission is out of scope). All optional + additive so the ₱/PH
   * non-controlled flow is unaffected.
   */
  controlledSubstanceSchedule?: ControlledSubstanceSchedule;
  /** Prescriber DEA registration number (controlled substances). */
  prescriberDea?: string;
  /** Prescriber National Provider Identifier (10-digit NPI). */
  prescriberNpi?: string;

  /**
   * QW-1 / P1-2: post-create safety warnings — allergy conflicts (drug name vs
   * the patient's recorded active allergies) and curated drug-drug interactions
   * against active medications. Populated only on the createPrescription
   * response; absent on list/get/update. The clinician must acknowledge these
   * before dismissing the prescription sheet (rx-sheet.tsx).
   */
  warnings?: {
    /** Active-allergy display names that match the prescribed drug. */
    allergyConflicts?: string[];
    drugInteractions?: {
      interactingDrug: string;
      severity: "major" | "moderate" | "minor";
      description: string;
    }[];
  };
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

  // P2-13 legal fields (optional, US-context)
  controlledSubstanceSchedule?: ControlledSubstanceSchedule;
  prescriberDea?: string;
  prescriberNpi?: string;
}

model UpdatePrescriptionRequest {
  rxNormCode?: string;
  drugName?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  instructions?: string;

  /**
   * Lifecycle transition (EM-CLI-012). When present, the handler routes to the
   * FSM guard (`pending` → `dispensed` | `cancelled`); an invalid transition
   * returns 422 `INVALID_PRESCRIPTION_TRANSITION`. Status progression is the one
   * field permitted on a locked/completed visit (external pharmacy dispense).
   */
  status?: PrescriptionStatus;

  // P2-13 legal fields (optional, US-context)
  controlledSubstanceSchedule?: ControlledSubstanceSchedule;
  prescriberDea?: string;
  prescriberNpi?: string;
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
  revoked: false,
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
  /** ADA: nature of the proposed procedure (P1-3 structured consent) */
  procedureNature?: string;
  /** ADA: expected benefits of the procedure */
  benefits?: string;
  /** ADA: material risks of the procedure */
  risks?: string;
  /** ADA: reasonable alternatives to the procedure */
  alternatives?: string;
  /** ADA: risks of not receiving treatment */
  risksOfNonTreatment?: string;
  signedAt?: utcDateTime;
  signatureData?: string;
  signed: boolean;
  /**
   * DE-013 / EM-CLI-001 (WF-035): true once an unsigned consent form has been
   * revoked. Returned by the handler/repo (full-row read) — declared here so the
   * consent-history UI can distinguish a revoked form from a still-pending one.
   */
  revoked: boolean;
  /** Timestamp the form was revoked, if revoked. */
  revokedAt?: utcDateTime;
  /** Member/user who revoked the form, if revoked. */
  revokedBy?: UUID;
}

model CreateConsentFormRequest {
  visitId: UUID;
  patientId: UUID;
  templateId: string;
  templateName: string;
  /** ADA: nature of the proposed procedure */
  procedureNature?: string;
  /** ADA: expected benefits of the procedure */
  benefits?: string;
  /** ADA: material risks of the procedure */
  risks?: string;
  /** ADA: reasonable alternatives */
  alternatives?: string;
  /** ADA: risks of not receiving treatment */
  risksOfNonTreatment?: string;
}

model SignConsentFormRequest {
  signatureData: string;
}

// ---------------------------------------------------------------------------
// Models — Informed Refusal (P1-3)
// ---------------------------------------------------------------------------

/**
 * InformedRefusal — records a patient's explicit refusal of recommended treatment.
 * Distinct from consent (which is granted); immutable once recorded.
 * Required by ADA guidelines and medico-legal best practice.
 */
@example(#{
  id: "ir-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-15T10:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-15T10:00:00Z"),
  version: 1,
  visitId: "vi-1a2b3c4d-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  refusingMemberId: "m1a2b3c4-0000-4000-8000-000000000001",
  procedureDescription: "Extraction of tooth #48 (lower right wisdom tooth)",
  refusalReason: "Patient requests conservative management first",
  patientAcknowledgement: "I understand the risks of declining treatment and choose to do so.",
  refusedAt: utcDateTime.fromISO("2026-03-15T10:00:00Z"),
}, #{ title: "Patient informed refusal of tooth extraction" })
model InformedRefusal {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  visitId: UUID;
  patientId: UUID;
  /** Member (dentist) who presented the treatment and recorded the refusal */
  refusingMemberId: UUID;
  procedureDescription: string;
  refusalReason: string;
  /** Verbatim patient acknowledgement that they understand risks of non-treatment */
  patientAcknowledgement: string;
  refusedAt: utcDateTime;
}

model RecordConsentRefusalRequest {
  visitId: UUID;
  patientId: UUID;
  refusingMemberId: UUID;
  procedureDescription: string;
  refusalReason: string;
  patientAcknowledgement: string;
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
  /** P2-12: restoration shade (e.g. VITA "A2") */
  shade?: string;
  /** P2-12: restoration material (e.g. "Zirconia", "PFM", "E.max") */
  material?: string;
  /** P2-12: date the case is needed chairside (distinct from expectedDeliveryDate). */
  dueDate?: utcDateTime;
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
  /** P2-12: restoration shade (e.g. VITA "A2") */
  shade?: string;
  /** P2-12: restoration material (e.g. "Zirconia", "PFM", "E.max") */
  material?: string;
  /** P2-12: date the case is needed chairside. */
  dueDate?: utcDateTime;
  expectedDeliveryDate?: utcDateTime;
}

model UpdateLabOrderRequest {
  status?: LabOrderStatus;
  shade?: string;
  material?: string;
  dueDate?: utcDateTime;
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
// Models — Medical History Review (P1-4: ASA + periodic re-confirmation)
// ---------------------------------------------------------------------------

/**
 * ASA Physical Status classification (American Society of Anesthesiologists).
 * I–VI plus the "E" emergency modifier is captured separately (asaEmergency).
 */
enum AsaClassification {
  asa_i: "I",
  asa_ii: "II",
  asa_iii: "III",
  asa_iv: "IV",
  asa_v: "V",
  asa_vi: "VI",
}

/**
 * MedicalHistoryReview — patient-level review attestation (P1-4).
 * Captures the ASA Physical Status and the date the history was last reviewed,
 * supporting the periodic (3–6 month) re-confirmation requirement. Latest review
 * per patient is the current one; prior reviews are retained as history.
 */
@example(#{
  id: "mr-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-01T10:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-01T10:00:00Z"),
  version: 1,
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  asaClassification: AsaClassification.asa_ii,
  asaEmergency: false,
  reviewedAt: utcDateTime.fromISO("2026-03-01T10:00:00Z"),
}, #{ title: "ASA II review, no emergency modifier" })
model MedicalHistoryReview {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  patientId: UUID;
  /** ASA Physical Status I–VI; null when not yet classified */
  asaClassification?: AsaClassification;
  /** ASA "E" emergency modifier */
  asaEmergency: boolean;
  /** Timestamp the medical history was last reviewed/re-confirmed */
  reviewedAt: utcDateTime;
}

model RecordMedicalHistoryReviewRequest {
  patientId: UUID;
  asaClassification?: AsaClassification;
  asaEmergency?: boolean;
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

    // EM-CLI-001: revoke an unsigned consent form. A signed form cannot be
    // revoked (422 CONSENT_ALREADY_SIGNED). Path param is `cid` to match the
    // handler's parameter contract. Previously hand-registered in app.ts only.
    @patch
    @route("/{visitId}/consents/{cid}/revoke")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("revokeConsentForm")
    revoke(
      @path visitId: UUID,
      @path cid: UUID
    ): ApiOkResponse<ConsentForm>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  // P1-3: Informed refusal management (distinct from consent — records explicit
  // treatment refusal with patient acknowledgement)
  interface InformedRefusalManagement {
    @post
    @route("/{visitId}/consent-refusals")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("recordConsentRefusal")
    create(
      @path visitId: UUID,
      @body body: RecordConsentRefusalRequest
    ): ApiCreatedResponse<InformedRefusal>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/consent-refusals")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listConsentRefusals")
    list(
      @path visitId: UUID
    ): ApiOkResponse<PaginatedResponse<InformedRefusal>>
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

    // P1-4: ASA classification + periodic re-confirmation
    @post
    @route("/medical-history-review")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("recordMedicalHistoryReview")
    recordReview(
      @body body: RecordMedicalHistoryReviewRequest
    ): ApiCreatedResponse<MedicalHistoryReview>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/medical-history-review")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getMedicalHistoryReview")
    getReview(
      @query patientId: UUID
    ): ApiOkResponse<MedicalHistoryReview>
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
