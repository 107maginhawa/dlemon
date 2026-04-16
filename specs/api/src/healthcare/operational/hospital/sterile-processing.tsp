import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../common/models.tsp";
import "../../../common/errors.tsp";
import "../../../common/pagination.tsp";
import "../../../common/security.tsp";
import "../../core/primitives.tsp";
import "../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Sterile Processing Department (SPD) module.
 *
 * Provides models and operations for managing surgical instrument reprocessing:
 * instrument set catalogues, sterilization cycle documentation, biological
 * indicator testing, and sterilization log records linking sets to cycles.
 * Supports full CSSD traceability and quality assurance workflows aligned
 * with AAMI/ISO 17665 standards.
 */
namespace Healthcare.Operational.Hospital.SterileProcessing;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Current status of an instrument set.")
enum InstrumentSetStatus {
  @doc("The set has been sterilized, released, and is ready for use in a procedure")
  available,

  @doc("The set is currently checked out for use in a procedure")
  inUse,

  @doc("The set has been returned from use and is undergoing decontamination")
  decontamination,

  @doc("The set has completed decontamination and is undergoing sterilization")
  sterilization,

  @doc("The set has been quarantined pending investigation (e.g., sterilization failure, recall)")
  quarantine,

  @doc("The set has been permanently decommissioned")
  retired,
}

@doc("Lifecycle status of a sterilization cycle run on an autoclave.")
enum CycleStatus {
  @doc("The sterilization cycle is currently in progress")
  running,

  @doc("The sterilization cycle completed successfully and loads are released pending BI results")
  completed,

  @doc("The sterilization cycle failed (e.g., temperature or pressure not maintained, door seal failure)")
  failed,
}

@doc("Type of biological or chemical indicator used to verify sterilization efficacy.")
enum BiologicalIndicatorType {
  @doc("Spore test using Geobacillus stearothermophilus or Bacillus atrophaeus spores")
  sporeTest,

  @doc("Chemical indicator strip or integrator that changes colour when sterilization conditions are met")
  chemicalIndicator,
}

@doc("Result of a biological indicator incubation or chemical indicator reading.")
enum BiologicalIndicatorResult {
  @doc("The indicator result confirms sterilization conditions were achieved")
  pass,

  @doc("The indicator result indicates sterilization conditions were NOT achieved — recall required")
  fail,

  @doc("The indicator is still in the incubation period and results are not yet available")
  pending,
}

@doc("Sterilization status recorded in the sterilization log for an instrument set.")
enum SterilizationLogStatus {
  @doc("The instrument set has been confirmed sterilized and released for use")
  sterilized,

  @doc("The sterilization cycle associated with this set failed")
  failed,

  @doc("The instrument set has been quarantined pending further investigation or BI results")
  quarantined,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A single instrument within an instrument set.")
model InstrumentItem {
  @doc("Common name of the instrument (e.g., 'Metzenbaum scissors', 'Kelly forceps')")
  name: string;

  @doc("Catalogue or manufacturer code for this instrument")
  code?: string;

  @doc("Number of this instrument type included in the set")
  quantity: int32;

  @doc("Manufacturer serial number for trackable items (e.g., powered equipment, implants)")
  serialNumber?: string;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("An instrument set — a defined collection of surgical instruments processed, sterilized, and tracked together as a single unit.")
model InstrumentSet extends HealthcareBaseEntity {
  @doc("Human-readable name for the instrument set (e.g., 'General Surgery Minor Set', 'Laparoscopy Tower Pack')")
  name: string;

  @doc("Internal catalogue or tray code for this set")
  code?: string;

  @doc("List of individual instruments included in this set")
  instruments: InstrumentItem[];

  @doc("Reference to the Department that owns or primarily uses this instrument set")
  department?: Reference;

  @doc("Current status of the instrument set in the reprocessing lifecycle")
  status: InstrumentSetStatus;
}

@doc("A sterilization cycle record documenting a single autoclave run, including all physical parameters and the sets processed.")
model SterilizationCycle extends HealthcareBaseEntity {
  @doc("Autoclave unit identifier (machine name or asset number — e.g., 'Autoclave-3', 'Prevac-A')")
  autoclave: string;

  @doc("Sequential cycle number as reported by the autoclave controller for this run")
  cycleNumber: string;

  @doc("Date and time the sterilization cycle was initiated")
  startTime: utcDateTime;

  @doc("Date and time the sterilization cycle completed")
  endTime?: utcDateTime;

  @doc("Sterilization temperature achieved and maintained during the cycle (Quantity with unit '°C' or '°F')")
  temperature: Quantity;

  @doc("Chamber pressure achieved and maintained during the cycle (Quantity with unit 'kPa' or 'psi')")
  pressure: Quantity;

  @doc("Exposure duration at sterilization temperature and pressure (Quantity with unit 'min')")
  duration: Quantity;

  @doc("References to InstrumentSet resources processed in this cycle")
  instrumentSets: Reference[];

  @doc("Current status of this sterilization cycle")
  status: CycleStatus;

  @doc("Reference to the Practitioner who operated the autoclave for this cycle")
  operatedBy: Reference;

  @doc("Additional cycle parameters recorded by the autoclave (e.g., pre-vacuum pulses, drying time) — key-value pairs")
  parameters?: Record<unknown>;
}

@doc("A biological or chemical indicator record providing quality assurance evidence for a sterilization cycle.")
model BiologicalIndicator extends HealthcareBaseEntity {
  @doc("Reference to the SterilizationCycle this indicator was run with")
  sterilizationCycle: Reference;

  @doc("Type of indicator used")
  type: BiologicalIndicatorType;

  @doc("Manufacturer lot number of the indicator for traceability")
  lotNumber: string;

  @doc("Date and time the incubation period began (for spore tests)")
  incubationStart?: utcDateTime;

  @doc("Date and time the incubation period ended and results were read (for spore tests)")
  incubationEnd?: utcDateTime;

  @doc("Result of the indicator — available after incubation or chemical reading")
  result?: BiologicalIndicatorResult;

  @doc("Reference to the Practitioner who read and recorded the indicator result")
  readBy?: Reference;
}

@doc("A sterilization log entry linking an instrument set to the sterilization cycle that processed it, providing a complete traceability record.")
model SterilizationLog extends HealthcareBaseEntity {
  @doc("Reference to the InstrumentSet that was sterilized")
  instrumentSet: Reference;

  @doc("Reference to the SterilizationCycle in which this set was processed")
  cycle: Reference;

  @doc("Reference to the BiologicalIndicator used to verify this cycle, if applicable")
  biologicalIndicator?: Reference;

  @doc("Sterilization outcome for this instrument set")
  status: SterilizationLogStatus;

  @doc("Date and time sterilization was completed and the set was released")
  sterilizedAt: utcDateTime;

  @doc("Date and time the sterile barrier system of this set expires (e.g., 6 months from sterilization)")
  expiresAt?: utcDateTime;

  @doc("Reference to the Practitioner who released this set for clinical use after quality verification")
  releasedBy?: Reference;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for instrument sets.")
model InstrumentSetSearchParams {
  @doc("Filter by department reference ID") @query department?: string;
  @doc("Filter by instrument set status") @query status?: InstrumentSetStatus;
  @doc("Free-text search on instrument set name") @query name?: string;
  @doc("Filter by instrument set code") @query code?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for sterilization cycles.")
model SterilizationCycleSearchParams {
  @doc("Filter by autoclave identifier") @query autoclave?: string;
  @doc("Filter by cycle status") @query status?: CycleStatus;
  @doc("Filter by operator reference ID") @query operatedBy?: string;
  @doc("Filter cycles started at or after this date-time") @query startedFrom?: utcDateTime;
  @doc("Filter cycles started at or before this date-time") @query startedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for biological indicators.")
model BiologicalIndicatorSearchParams {
  @doc("Filter by sterilization cycle reference ID") @query sterilizationCycle?: string;
  @doc("Filter by indicator type") @query type?: BiologicalIndicatorType;
  @doc("Filter by result") @query result?: BiologicalIndicatorResult;
  @doc("Filter by lot number") @query lotNumber?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for sterilization logs.")
model SterilizationLogSearchParams {
  @doc("Filter by instrument set reference ID") @query instrumentSet?: string;
  @doc("Filter by sterilization cycle reference ID") @query cycle?: string;
  @doc("Filter by log status") @query status?: SterilizationLogStatus;
  @doc("Filter by releasing staff reference ID") @query releasedBy?: string;
  @doc("Filter logs sterilized at or after this date-time") @query sterilizedFrom?: utcDateTime;
  @doc("Filter logs expiring at or before this date-time (for expiry management)") @query expiresTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Instrument set management — maintain the SPD catalogue of instrument sets including contents, department ownership, and reprocessing status.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/sterile-processing/instrument-sets")
interface InstrumentSetManagement {
  @doc("Create a new instrument set in the SPD catalogue.")
  @operationId("createInstrumentSet")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createInstrumentSet(
    @body body: InstrumentSet,
  ): {
    @statusCode statusCode: 201;
    @body result: InstrumentSet;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an instrument set by its logical ID.")
  @operationId("getInstrumentSet")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getInstrumentSet(
    @path @doc("InstrumentSet logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: InstrumentSet;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an instrument set record — contents, department, or status.")
  @operationId("updateInstrumentSet")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateInstrumentSet(
    @path @doc("InstrumentSet logical ID") id: UUID,
    @body body: InstrumentSet,
  ): {
    @statusCode statusCode: 200;
    @body result: InstrumentSet;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an instrument set from the catalogue.")
  @operationId("deleteInstrumentSet")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteInstrumentSet(
    @path @doc("InstrumentSet logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search instrument sets by name, code, department, or status.")
  @operationId("searchInstrumentSets")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchInstrumentSets(
    ...InstrumentSetSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<InstrumentSet>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Sterilization cycle management — document autoclave runs including physical parameters, processed loads, and pass/fail outcomes.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/sterile-processing/cycles")
interface SterilizationCycleManagement {
  @doc("Create a new sterilization cycle record.")
  @operationId("createSterilizationCycle")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createSterilizationCycle(
    @body body: SterilizationCycle,
  ): {
    @statusCode statusCode: 201;
    @body result: SterilizationCycle;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a sterilization cycle by its logical ID.")
  @operationId("getSterilizationCycle")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getSterilizationCycle(
    @path @doc("SterilizationCycle logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: SterilizationCycle;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a sterilization cycle record — record end time, outcome, or additional parameters.")
  @operationId("updateSterilizationCycle")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateSterilizationCycle(
    @path @doc("SterilizationCycle logical ID") id: UUID,
    @body body: SterilizationCycle,
  ): {
    @statusCode statusCode: 200;
    @body result: SterilizationCycle;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a sterilization cycle record.")
  @operationId("deleteSterilizationCycle")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteSterilizationCycle(
    @path @doc("SterilizationCycle logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search sterilization cycles by autoclave, status, operator, or date range.")
  @operationId("searchSterilizationCycles")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchSterilizationCycles(
    ...SterilizationCycleSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SterilizationCycle>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Biological indicator management — track spore tests and chemical indicators to verify sterilization efficacy and support quality assurance.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/sterile-processing/biological-indicators")
interface BiologicalIndicatorManagement {
  @doc("Create a new biological indicator record for a sterilization cycle.")
  @operationId("createBiologicalIndicator")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createBiologicalIndicator(
    @body body: BiologicalIndicator,
  ): {
    @statusCode statusCode: 201;
    @body result: BiologicalIndicator;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a biological indicator record by its logical ID.")
  @operationId("getBiologicalIndicator")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getBiologicalIndicator(
    @path @doc("BiologicalIndicator logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BiologicalIndicator;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a biological indicator record — record incubation end time and result.")
  @operationId("updateBiologicalIndicator")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateBiologicalIndicator(
    @path @doc("BiologicalIndicator logical ID") id: UUID,
    @body body: BiologicalIndicator,
  ): {
    @statusCode statusCode: 200;
    @body result: BiologicalIndicator;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a biological indicator record.")
  @operationId("deleteBiologicalIndicator")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBiologicalIndicator(
    @path @doc("BiologicalIndicator logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search biological indicators by cycle, type, result, or lot number.")
  @operationId("searchBiologicalIndicators")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchBiologicalIndicators(
    ...BiologicalIndicatorSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BiologicalIndicator>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Sterilization log management — maintain traceability records linking each instrument set to the sterilization cycle that processed it.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/sterile-processing/logs")
interface SterilizationLogManagement {
  @doc("Create a new sterilization log entry for an instrument set.")
  @operationId("createSterilizationLog")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createSterilizationLog(
    @body body: SterilizationLog,
  ): {
    @statusCode statusCode: 201;
    @body result: SterilizationLog;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a sterilization log entry by its logical ID.")
  @operationId("getSterilizationLog")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getSterilizationLog(
    @path @doc("SterilizationLog logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: SterilizationLog;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a sterilization log entry — record release, quarantine, or failure.")
  @operationId("updateSterilizationLog")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateSterilizationLog(
    @path @doc("SterilizationLog logical ID") id: UUID,
    @body body: SterilizationLog,
  ): {
    @statusCode statusCode: 200;
    @body result: SterilizationLog;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a sterilization log entry.")
  @operationId("deleteSterilizationLog")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteSterilizationLog(
    @path @doc("SterilizationLog logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search sterilization log entries by instrument set, cycle, status, releasing staff, or sterilization/expiry date range.")
  @operationId("searchSterilizationLogs")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchSterilizationLogs(
    ...SterilizationLogSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SterilizationLog>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
