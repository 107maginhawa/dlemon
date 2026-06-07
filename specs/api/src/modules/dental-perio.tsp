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
  gmBM: 2, gmBC: 0, gmBD: 2,
  gmLM: 1, gmLC: 0, gmLD: 1,
  calBM: 6, calBC: 3, calBD: 7,
  calLM: 4, calLC: 3, calLD: 5,
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

  @doc("Buccal probing depth (mm), 0-20. BR-P03.")
  @minValue(0)
  @maxValue(20)
  depthBM?: int32;

  @minValue(0)
  @maxValue(20)
  depthBC?: int32;

  @minValue(0)
  @maxValue(20)
  depthBD?: int32;

  @minValue(0)
  @maxValue(20)
  depthLM?: int32;

  @minValue(0)
  @maxValue(20)
  depthLC?: int32;

  @minValue(0)
  @maxValue(20)
  depthLD?: int32;

  bopBM?: boolean;
  bopBC?: boolean;
  bopBD?: boolean;
  bopLM?: boolean;
  bopLC?: boolean;
  bopLD?: boolean;

  @doc("Gingival recession (mm). -5..20; negative = coronal overgrowth above CEJ. V-PER-009.")
  @minValue(-5)
  @maxValue(20)
  recession?: int32;

  @doc("P1-5: per-site gingival-margin position vs CEJ (mm). Buccal-mesial. positive = apical/recession, 0 = at CEJ, negative = coronal. -5..20.")
  @minValue(-5)
  @maxValue(20)
  gmBM?: int32;

  @minValue(-5)
  @maxValue(20)
  gmBC?: int32;

  @minValue(-5)
  @maxValue(20)
  gmBD?: int32;

  @minValue(-5)
  @maxValue(20)
  gmLM?: int32;

  @minValue(-5)
  @maxValue(20)
  gmLC?: int32;

  @minValue(-5)
  @maxValue(20)
  gmLD?: int32;

  @doc("P1-5: read-only Clinical Attachment Level (mm) per site, derived as CAL = probing depth + gingival margin. null when either input is missing. Never persisted.")
  calBM?: int32 | null;
  calBC?: int32 | null;
  calBD?: int32 | null;
  calLM?: int32 | null;
  calLC?: int32 | null;
  calLD?: int32 | null;

  @doc("Miller mobility grade 0-3. V-PER-004 (enforced in handler → 422 INVALID_GRADE).")
  mobility: int32;

  @doc("Furcation involvement class F0-F3 (0-3). V-PER-004 (enforced in handler → 422 INVALID_GRADE).")
  furcation: int32;

  plaque: boolean;
  suppuration: boolean;
  notes?: string;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model UpsertToothReadingRequest {
  @minValue(0)
  @maxValue(20)
  depthBM?: int32;

  @minValue(0)
  @maxValue(20)
  depthBC?: int32;

  @minValue(0)
  @maxValue(20)
  depthBD?: int32;

  @minValue(0)
  @maxValue(20)
  depthLM?: int32;

  @minValue(0)
  @maxValue(20)
  depthLC?: int32;

  @minValue(0)
  @maxValue(20)
  depthLD?: int32;

  bopBM?: boolean;
  bopBC?: boolean;
  bopBD?: boolean;
  bopLM?: boolean;
  bopLC?: boolean;
  bopLD?: boolean;

  @doc("Gingival recession (mm). -5..20. V-PER-009.")
  @minValue(-5)
  @maxValue(20)
  recession?: int32;

  @doc("P1-5: per-site gingival-margin position vs CEJ (mm). positive = apical/recession, 0 = at CEJ, negative = coronal. -5..20. Feeds read-only CAL.")
  @minValue(-5)
  @maxValue(20)
  gmBM?: int32;

  @minValue(-5)
  @maxValue(20)
  gmBC?: int32;

  @minValue(-5)
  @maxValue(20)
  gmBD?: int32;

  @minValue(-5)
  @maxValue(20)
  gmLM?: int32;

  @minValue(-5)
  @maxValue(20)
  gmLC?: int32;

  @minValue(-5)
  @maxValue(20)
  gmLD?: int32;

  @doc("Miller mobility grade 0-3. V-PER-004 (enforced in handler → 422 INVALID_GRADE).")
  mobility?: int32;

  @doc("Furcation involvement class 0-3. V-PER-004 (enforced in handler → 422 INVALID_GRADE).")
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

@doc("Longitudinal history: a patient's completed/locked perio charts (most recent first), each with full readings, for multi-exam comparison.")
model PerioChartHistory {
  data: PerioChart[];
}

model CreatePerioChartRequest {
  visitId: UUID;
  patientId: UUID;
  notes?: string;
}

@doc("P1-6: optional 2017 AAP/EFP grading risk factors + staging context that the chart itself does not capture (sourced from medical history). All optional; clinical defaults apply when omitted.")
model CompletePerioChartRequest {
  @doc("Teeth lost due to periodontitis (staging complexity).")
  toothLossCount?: int32;

  @doc("Remaining teeth in the mouth; <20 is a Stage-IV factor. Defaults to charted-tooth count.")
  remainingTeeth?: int32;

  @doc("Masticatory dysfunction / bite collapse (Stage-IV factor).")
  biteCollapse?: boolean;

  @doc("Radiographic %bone-loss at worst site (0-100), for the indirect grading ratio.")
  bonelossPercent?: float64;

  @doc("Patient age in years (denominator of the %bone-loss÷age grading ratio).")
  ageYears?: int32;

  @doc("Direct 5-yr RBL/CAL progression (mm). When present, overrides the indirect ratio.")
  fiveYearProgressionMm?: float64;

  @doc("Cigarettes per day (grading modifier): <10 → ≥B, ≥10 → C.")
  cigarettesPerDay?: int32;

  @doc("Whether the patient has diabetes (grading modifier).")
  hasDiabetes?: boolean;

  @doc("Most recent HbA1c % (grading modifier): <7.0 → ≥B, ≥7.0 → C.")
  hba1cPercent?: float64;

  @doc("Whether involvement follows a molar/incisor pattern (extent descriptor).")
  molarIncisorPattern?: boolean;
}

@doc("2017 AAP/EFP stage (severity/complexity).")
enum PerioStage {
  I: "I",
  II: "II",
  III: "III",
  IV: "IV",
}

@doc("2017 AAP/EFP grade (progression rate).")
enum PerioGrade {
  A: "A",
  B: "B",
  C: "C",
}

@doc("2017 AAP/EFP extent descriptor.")
enum PerioExtent {
  localized,
  generalized,
  molar_incisor,
}

model CompletePerioChartResponse {
  id: UUID;
  status: PerioChartStatus;
  completedAt: utcDateTime;
  summaryBopPercent: float64;
  summaryMeanDepth: float64;
  summaryDeepPocketCount: int32;

  @doc("P1-6: computed 2017 AAP/EFP stage. null when there is no CAL evidence to stage.")
  stage?: PerioStage | null;

  @doc("P1-6: computed 2017 AAP/EFP grade (defaults to B without risk evidence).")
  grade?: PerioGrade;

  @doc("P1-6: computed extent descriptor. null when no teeth were examined.")
  extent?: PerioExtent | null;
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
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["user"])
    @operationId("listPerioChartsForPatient")
    @doc("Multi-exam comparison: list a patient's completed/locked perio charts (most recent first), each with readings.")
    listForPatient(
      @query patientId: UUID
    ): ApiOkResponse<PerioChartHistory>
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
      @doc("FDI tooth number. Outer bound 11-85 enforced here; the handler applies the precise FDI quadrant check (adult 11-18,21-28,31-38,41-48; primary 51-55,61-65,71-75,81-85) — disjoint ranges are not expressible in a single validator. V-PER-010 / BR-P04.")
      @path
      @minValue(11)
      @maxValue(85)
      toothNumber: int32,
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
      @path chartId: UUID,
      @doc("Optional 2017 staging/grading risk factors (P1-6). Omit for measurement-only classification.")
      @body body?: CompletePerioChartRequest
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
