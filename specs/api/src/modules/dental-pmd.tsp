/**
 * Dental PMD (Patient Medical Data) Module
 *
 * Covers FR12.x:
 * - PMDDocument: immutable record generated from a completed visit, digitally signed
 * - ImportedPMD: read-only PMD imported from an external/source facility
 *
 * PMDs are generated once from completed visits, signed, and never mutated.
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
  signed,
  superseded,
}

// ---------------------------------------------------------------------------
// Models — PMD Document
// ---------------------------------------------------------------------------

@example(#{
  id: "pmd-1a2b3c4d-0000-4000-8000-000000000001",
  createdAt: utcDateTime.fromISO("2026-03-15T12:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-03-15T12:05:00Z"),
  version: 1,
  visitId: "v1a2b3c4-0000-4000-8000-000000000001",
  patientId: "d1a2b3c4-0000-4000-8000-000000000001",
  authorMemberId: "m1a2b3c4-0000-4000-8000-000000000001",
  branchId: "b1a2b3c4-0000-4000-8000-000000000001",
  status: PMDDocumentStatus.signed,
  content: "{\"treatments\":[{\"cdtCode\":\"D2392\",\"toothNumber\":36,\"status\":\"performed\"}],\"allergies\":[],\"diagnoses\":[{\"code\":\"K02.1\",\"display\":\"Dental caries\"}]}",
  signature: "MEYCIQDsX3...",
  signedAt: utcDateTime.fromISO("2026-03-15T12:05:00Z"),
  checksum: "sha256:a1b2c3d4e5f6...",
}, #{ title: "Signed PMD for completed visit" })
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
  /** JSON snapshot of visit data: ICD-10/CDT/RxNorm coded */
  content: string;
  /** Base64-encoded digital signature */
  signature?: string;
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
  content: string;
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
  }
}
