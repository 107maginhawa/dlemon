/**
 * Dental PMD (Portable Medical Document) Module
 *
 * Covers FR12.x:
 * - PMDDocument: immutable, checksum-sealed record generated from a completed visit
 * - ImportedPMD: read-only PMD imported from an external/source facility
 *
 * PMDs are generated once from completed visits and never mutated; their content
 * integrity is sealed with a SHA-256 checksum (tamper-evidence, NOT non-repudiation).
 * Digital signing (FR12.4) is honestly deferred to Phase-2: the `signature`/`signedAt`
 * fields and the `signed` status are reserved in the model but are NOT produced in V1.
 * Imported PMDs are parsed and linked to a patient; Safety Floor merge is add-only.
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

enum PMDDocumentStatus {
  generated,
  /** Phase-2 (FR12.4) reserved: digital signing is not implemented in V1, so no
   *  PMD reaches this state. Kept for forward compatibility. */
  signed,
  superseded,
}

// ---------------------------------------------------------------------------
// Models — PMD Document
// ---------------------------------------------------------------------------

@example(#{
  id: "pmd-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-15T12:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-15T12:00:00Z"),
  version: 1,
  visitId: "v1a2b3c4-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  authorMemberId: "m1a2b3c4-0000-4000-8000-000000000001",
  branchId: "b1a2b3c4-0000-4000-8000-000000000001",
  status: PMDDocumentStatus.generated,
  content: "{\"visitId\":\"v1a2b3c4-0000-4000-8000-000000000001\",\"patientId\":\"d1a2b3c4-0000-4000-8000-000000000001\",\"authorMemberId\":\"m1a2b3c4-0000-4000-8000-000000000001\",\"visitDate\":\"2026-03-15T12:00:00Z\",\"demographics\":{\"firstName\":\"Maria\",\"lastName\":\"Santos\",\"dateOfBirth\":\"1990-04-02\",\"gender\":\"female\"},\"safetyFloor\":{\"allergies\":[{\"displayName\":\"Penicillin\",\"code\":null,\"codeSystem\":null,\"notes\":null,\"onsetDate\":null}],\"medications\":[],\"conditions\":[]},\"treatments\":[{\"id\":\"t1a2b3c4-0000-4000-8000-000000000001\",\"cdtCode\":\"D2392\",\"description\":\"Resin composite, one surface, posterior\",\"toothNumber\":36,\"surfaces\":[\"O\"],\"conditionCode\":null,\"status\":\"performed\",\"priceCents\":150000}],\"prescriptions\":[]}",
  checksum: "sha256-a1b2c3d4e5f6...",
}, #{ title: "Generated PMD for a completed visit (V1: unsigned, checksum-sealed)" })
model PMDDocument {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  visitId: UUID;
  patientId: UUID;
  authorMemberId: UUID;
  branchId: UUID;
  status: PMDDocumentStatus;
  /** JSON snapshot of the completed visit (V1 narrowed set, decision #6): narrowed
   *  demographics (name/DOB/sex) + safety floor (allergies/medications/conditions) +
   *  CDT-coded treatments + RxNorm-coded prescriptions. Structured ICD-10 diagnoses and
   *  free-text clinical notes are Phase-2 (not present in V1). */
  content: string;
  /** Phase-2 (FR12.4): reserved for the facility digital signature; NOT populated in V1. */
  signature?: string;
  /** Phase-2 (FR12.4): reserved signing timestamp; NOT populated in V1. */
  signedAt?: utcDateTime;
  /** If this document supersedes an older one */
  supersedesId?: UUID;
  checksum: string;
}

model GeneratePMDRequest {
  visitId: UUID;
  patientId: UUID;
}

// ---------------------------------------------------------------------------
// Models — Imported PMD
// ---------------------------------------------------------------------------

model ImportedPMD {
  id: UUID;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  version: int32;
  patientId: UUID;
  sourceFacility: string;
  sourceReference?: string;
  /** EF-PMD-005: Originating software system (e.g. "Open Dental v21.1", "Dentrix G7").
   *  Required for audit trail data provenance per MODULE_SPEC §7.2 item 5.
   *  V-PMD-010: capped at 200 chars (API_CONTRACTS §import). */
  @maxLength(200)
  sourceDescription: string;
  /** Raw JSON content of the imported PMD */
  content: string;
  importedAt: utcDateTime;
  /** Whether the Safety Floor merge has been applied */
  safetyFloorMerged: boolean;
}

model ImportPMDRequest {
  patientId: UUID;
  sourceFacility: string;
  sourceReference?: string;
  /** EF-PMD-005: Originating software system (e.g. "Open Dental v21.1", "Dentrix G7").
   *  Required for audit trail data provenance per MODULE_SPEC §7.2 item 5.
   *  V-PMD-010: capped at 200 chars (API_CONTRACTS §import). */
  @maxLength(200)
  sourceDescription: string;
  content: string;
  /** Optional SHA-256 checksum (format: sha256-<hex>). When provided the server
   *  verifies the digest of `content` matches before persisting. Mismatch → 422. */
  checksum?: string;
}

/**
 * Result of merging an imported PMD's safety-floor items into the patient's
 * living medical history (FIX-003 / decision #20). The imported PMD itself is
 * never mutated (BR-022); its safety-critical items are surfaced as NEW,
 * append-only medical-history entries that then appear in the clinical Safety
 * Floor. The merge is idempotent — a second merge of the same imported PMD → 409.
 */
model MergeImportedPMDSafetyFloorResult {
  importedPmdId: UUID;
  /** True once the merge has been applied (idempotency marker). */
  safetyFloorMerged: boolean;
  /** Number of new medical-history entries created by this merge. */
  mergedEntryCount: int32;
  mergedAt: utcDateTime;
}

// ---------------------------------------------------------------------------
// Models — Continuity-of-Care export (P2-18)
// ---------------------------------------------------------------------------

/**
 * Whole-patient continuity-of-care export (P2-18).
 *
 * Unlike `exportPMD` (a single visit's snapshot), this aggregates the patient's
 * full longitudinal record into a portable **FHIR R4 document Bundle** suitable
 * for records-release / care-transition to another provider (HIPAA right-of-access).
 *
 * The response body is a FHIR R4 `Bundle` resource (`resourceType: "Bundle"`,
 * `type: "document"`) whose entries are a `Composition` (CCD header), a `Patient`
 * resource, and per-visit `Encounter` / `Condition` / `Procedure` /
 * `MedicationRequest` resources derived from each sealed per-visit PMD snapshot.
 * Returned as a downloadable `application/fhir+json` attachment.
 *
 * It is modelled here as a free-form object because the wire shape is the FHIR R4
 * Bundle schema (an external standard), not a Monobase-proprietary envelope.
 */
@example(#{
  resourceType: "Bundle",
  type: "document",
}, #{ title: "FHIR R4 continuity-of-care document Bundle" })
model PatientCareRecordBundle {
  /** Always the FHIR literal "Bundle". */
  resourceType: string;

  /** Always "document" for a continuity-of-care document Bundle. */
  type: string;

  ...Record<unknown>;
}

// ---------------------------------------------------------------------------
// API Interfaces
// ---------------------------------------------------------------------------

namespace DentalPMDModule {
  interface PMDDocumentManagement {
    @post
    @route("/{visitId}/pmd")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("generatePMD")
    generate(
      @path visitId: UUID,
      @body body: GeneratePMDRequest
    ): ApiCreatedResponse<PMDDocument>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/pmd")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getPMDForVisit")
    getForVisit(
      @path visitId: UUID
    ): ApiOkResponse<PMDDocument>
      | ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/pmd")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listPMDs")
    list(
      @query patientId: UUID
    ): ApiOkResponse<PaginatedResponse<PMDDocument>>
      | ApiUnauthorizedResponse;

    @get
    @route("/{visitId}/pmd/export")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("exportPMD")
    exportPMD(
      @path visitId: UUID
    ): ApiOkResponse<PMDDocument>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface ImportedPMDManagement {
    @post
    @route("/pmd/import")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("importPMD")
    importPMD(
      @body body: ImportPMDRequest
    ): ApiCreatedResponse<ImportedPMD>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/pmd/imported")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listImportedPMDs")
    listImported(
      @query patientId: UUID
    ): ApiOkResponse<PaginatedResponse<ImportedPMD>>
      | ApiUnauthorizedResponse;

    @get
    @route("/pmd/imported/{id}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getImportedPMD")
    getImportedPMD(
      @path id: UUID
    ): ApiOkResponse<ImportedPMD>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    /**
     * FIX-003 (decision #20): merge an imported PMD's safety-critical items
     * (conditions / medications / allergies) into the patient's living medical
     * history as APPEND-ONLY entries, so imported safety data actually surfaces
     * in the clinical Safety Floor (the import flow's clinical reason to exist).
     * The imported PMD itself stays immutable (BR-022); the merge is recorded as
     * an append-only event and is idempotent — a second merge for the same
     * imported PMD returns 409 SAFETY_FLOOR_ALREADY_MERGED.
     */
    @post
    @route("/pmd/imported/{id}/merge-safety-floor")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("mergeImportedPMDSafetyFloor")
    mergeSafetyFloor(
      @path id: UUID
    ): ApiOkResponse<MergeImportedPMDSafetyFloorResult>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiConflictResponse
      | ApiUnauthorizedResponse;

    /**
     * P2-18: whole-patient continuity-of-care export.
     *
     * Aggregates the patient's full longitudinal record (all per-visit PMD
     * snapshots) into a portable FHIR R4 document Bundle for transfer / care
     * continuity. Returned as a downloadable `application/fhir+json` attachment.
     * The export is itself audit-logged (`pmd.export`), and a patient may export
     * their own record (HIPAA right-of-access) in addition to authorized staff.
     */
    @get
    @route("/pmd/patient/{patientId}/care-record")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("exportPatientCareRecord")
    exportPatientCareRecord(
      @path patientId: UUID
    ): ApiOkResponse<PatientCareRecordBundle>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }
}
