/**
 * Dental Periodontal Charting Module
 *
 * Covers FR-PERIO-001 to FR-PERIO-007:
 * - Full perio chart: probing depths (6 sites/tooth, FDI notation)
 * - Bleeding on probing (BOP per site)
 * - Recession measurements (mm per tooth)
 * - Mobility (grade 0–3) and Furcation involvement (F0–F3)
 * - One chart per visit; immutable after visit locked
 * - Summary statistics on completion (BOP%, mean depth, deep-pocket count)
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

enum PerioChartStatus {
  draft,
  completed,
  locked,
}

// ---------------------------------------------------------------------------
// Models — PerioToothReading
// ---------------------------------------------------------------------------

@example(#{
  id: "pr-1a2b3c4d-0000-4000-8000-000000000001",
  chartId: "pc-1a2b3c4d-0000-4000-8000-000000000001",
  toothNumber: 16,
  depthBM: 4, depthBC: 3, depthBD: 5,
  depthLM: 3, depthLC: 3, depthLD: 4,
  bopBM: true, bopBC: false, bopBD: true,
  bopLM: false, bopLC: false, bopLD: false,
  recession: 1,
  mobility: 0,
  furcation: 1,
  plaque: true,
  suppuration: false,
  notes: "Class II furcation on DB root",
  createdAt: utcDateTime.fromISO("2026-05-24T10:05:00Z"),
  updatedAt: utcDateTime.fromISO("2026-05-24T10:20:00Z"),
}, #{ title: "Tooth 16 perio reading — moderate disease" })
model PerioToothReading {
  id: UUID;
  chartId: UUID;
  toothNumber: int32;
  depthBM?: int32;
  depthBC?: int32;
  depthBD?: int32;
  depthLM?: int32;
  depthLC?: int32;
  depthLD?: int32;
  bopBM?: boolean;
  bopBC?: boolean;
  bopBD?: boolean;
  bopLM?: boolean;
  bopLC?: boolean;
  bopLD?: boolean;
  recession?: int32;
  mobility: int32;
  furcation: int32;
  plaque: boolean;
  suppuration: boolean;
  notes?: string;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model UpsertToothReadingRequest {
  depthBM?: int32;
  depthBC?: int32;
  depthBD?: int32;
  depthLM?: int32;
  depthLC?: int32;
  depthLD?: int32;
  bopBM?: boolean;
  bopBC?: boolean;
  bopBD?: boolean;
  bopLM?: boolean;
  bopLC?: boolean;
  bopLD?: boolean;
  recession?: int32;
  mobility?: int32;
  furcation?: int32;
  plaque?: boolean;
  suppuration?: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Models — PerioChart
// ---------------------------------------------------------------------------

@example(#{
  id: "pc-1a2b3c4d-0000-4000-8000-000000000001",
  visitId: "vi-1a2b3c4d-0000-4000-8000-000000000001",
  patientId: "dp-1a2b3c4d-0000-4000-8000-000000000001",
  branchId: "br-1a2b3c4d-0000-4000-8000-000000000001",
  examinerMemberId: "dm-1a2b3c4d-0000-4000-8000-000000000001",
  status: PerioChartStatus.completed,
  notes: "Generalized moderate periodontitis",
  completedAt: utcDateTime.fromISO("2026-05-24T10:30:00Z"),
  summaryBopPercent: 42.5,
  summaryMeanDepth: 3.8,
  summaryDeepPocketCount: 3,
  readings: #[],
  createdAt: utcDateTime.fromISO("2026-05-24T10:00:00Z"),
  updatedAt: utcDateTime.fromISO("2026-05-24T10:30:00Z"),
}, #{ title: "Completed perio chart — moderate periodontitis" })
model PerioChart {
  id: UUID;
  visitId: UUID;
  patientId: UUID;
  branchId: UUID;
  examinerMemberId: UUID;
  status: PerioChartStatus;
  notes?: string;
  completedAt?: utcDateTime;
  summaryBopPercent?: float64;
  summaryMeanDepth?: float64;
  summaryDeepPocketCount?: int32;
  readings: PerioToothReading[];
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model CreatePerioChartRequest {
  visitId: UUID;
  patientId: UUID;
  notes?: string;
}

model CompletePerioChartResponse {
  id: UUID;
  status: PerioChartStatus;
  completedAt: utcDateTime;
  summaryBopPercent: float64;
  summaryMeanDepth: float64;
  summaryDeepPocketCount: int32;
}

// ---------------------------------------------------------------------------
// API Interfaces
// ---------------------------------------------------------------------------

namespace DentalPerioModule {
  interface PerioChartManagement {
    @post
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("createPerioChart")
    create(
      @body body: CreatePerioChartRequest
    ): ApiCreatedResponse<PerioChart>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse;

    @get
    @route("/{chartId}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getPerioChart")
    get(
      @path chartId: UUID
    ): ApiOkResponse<PerioChart>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @put
    @route("/{chartId}/readings/{toothNumber}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("upsertToothReading")
    upsertReading(
      @path chartId: UUID,
      @path toothNumber: int32,
      @body body: UpsertToothReadingRequest
    ): ApiOkResponse<PerioToothReading>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;

    @post
    @route("/{chartId}/complete")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("completePerioChart")
    complete(
      @path chartId: UUID
    ): ApiOkResponse<CompletePerioChartResponse>
      | ApiBadRequestResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }

  interface VisitPerioChart {
    @get
    @route("/{visitId}/perio-chart")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("getVisitPerioChart")
    getForVisit(
      @path visitId: UUID
    ): ApiOkResponse<PerioChart>
      | ApiNoContentResponse
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse;
  }
}
