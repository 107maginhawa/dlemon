import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "../core/primitives.tsp";
import "../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Infection Control and Prevention — healthcare-associated infection (HAI)
 * surveillance and antibiogram management.
 *
 * Designed to align with CDC/NHSN surveillance definitions for HAI reporting,
 * CLSI antimicrobial susceptibility testing standards, and public health
 * notifiable disease reporting requirements.
 */
namespace Healthcare.Support.InfectionControl;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The classification of healthcare-associated infection type according to CDC/NHSN surveillance definitions.")
enum InfectionType {
  @doc("Surgical site infection (SSI) — infection occurring within 30–90 days of a surgical procedure at the incision site or in the organ/space manipulated during the procedure")
  surgicalSiteInfection,

  @doc("Catheter-associated urinary tract infection (CAUTI) — UTI in a patient who had an indwelling urinary catheter in place within the 48 hours before onset")
  catheterAssociatedUTI,

  @doc("Central line-associated bloodstream infection (CLABSI) — primary BSI in a patient who had a central venous catheter in place within the 48 hours before development of the BSI")
  centralLineAssociatedBSI,

  @doc("Ventilator-associated pneumonia (VAP) — pneumonia in a patient who was on mechanical ventilation for at least 48 hours")
  ventilatorAssociatedPneumonia,

  @doc("Clostridioides difficile infection — CDI occurring in a healthcare setting, defined as a positive toxin assay in a patient with ≥3 unformed stools in 24 hours")
  cDifficile,

  @doc("Methicillin-resistant Staphylococcus aureus (MRSA) infection or colonisation")
  mrsa,

  @doc("Vancomycin-resistant Enterococcus (VRE) infection or colonisation")
  vre,

  @doc("Multi-drug resistant organism (MDRO) infection not captured by a specific category above")
  multiDrugResistant,

  @doc("Other healthcare-associated infection type")
  other,
}

@doc("Antimicrobial susceptibility testing result category according to CLSI/EUCAST breakpoints.")
enum SensitivityResult {
  @doc("Susceptible — the organism is inhibited by achievable concentrations of the antimicrobial agent")
  sensitive,

  @doc("Intermediate — the organism has a reduced susceptibility; higher doses or a different route of administration may be required")
  intermediate,

  @doc("Resistant — the organism is not inhibited by achievable concentrations of the antimicrobial agent and is expected to be treatment-refractory")
  resistant,

  @doc("Not tested — susceptibility to this antimicrobial was not assessed for this isolate")
  notTested,
}

@doc("Isolation precautions required to prevent transmission of the identified organism. Based on CDC Healthcare Infection Control Practices Advisory Committee (HICPAC) guidelines.")
enum IsolationPrecaution {
  @doc("Standard precautions — applied to all patients regardless of diagnosis; includes hand hygiene, PPE when appropriate, and safe injection practices")
  standard,

  @doc("Contact precautions — for organisms transmitted by direct or indirect contact (e.g., MRSA, VRE, C. difficile, scabies)")
  contact,

  @doc("Droplet precautions — for organisms transmitted by respiratory droplets (e.g., influenza, COVID-19, pertussis)")
  droplet,

  @doc("Airborne precautions — for organisms transmitted by airborne particles (e.g., Mycobacterium tuberculosis, measles, varicella)")
  airborne,

  @doc("Protective environment — for severely immunocompromised patients to protect them from environmental organisms (e.g., post-bone marrow transplant)")
  protectiveEnvironment,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A surveillance record for a single healthcare-associated infection event in a patient. Supports CDC/NHSN required data elements and public health notifiable disease reporting.")
model InfectionSurveillance extends HealthcareBaseEntity {
  @doc("Reference to the Patient with the healthcare-associated infection")
  patient: Reference;

  @doc("Reference to the Encounter during which the infection was identified or acquired")
  encounter?: Reference;

  @doc("The type of healthcare-associated infection")
  infectionType: InfectionType;

  @doc("The causative organism identified (SNOMED CT coded, e.g., 'Staphylococcus aureus')")
  organism?: CodeableConcept;

  @doc("The anatomical site of infection (SNOMED CT coded, e.g., 'Urinary tract', 'Blood', 'Sternum')")
  site?: CodeableConcept;

  @doc("Date and time of infection onset as defined by the applicable surveillance protocol")
  onsetDate: utcDateTime;

  @doc("Date and time the diagnostic culture was collected")
  cultureDate?: utcDateTime;

  @doc("Laboratory culture result (e.g., 'Positive — MRSA', 'No growth at 5 days')")
  cultureResult?: CodeableConcept;

  @doc("Isolation precautions implemented to prevent transmission to other patients and healthcare workers")
  isolationPrecautions?: IsolationPrecaution[];

  @doc("Whether this infection meets criteria for mandatory reporting to a public health authority")
  isNotifiable: boolean;

  @doc("Whether this infection has been reported to the relevant public health authority")
  reportedToPublicHealth?: boolean;

  @doc("Date and time the infection was reported to public health")
  reportedDate?: utcDateTime;

  @doc("Reference to the Procedure associated with the infection (e.g., the surgical procedure for SSI)")
  relatedProcedure?: Reference;

  @doc("Reference to the Device associated with the infection (e.g., the central venous catheter for CLABSI)")
  relatedDevice?: Reference;

  @doc("Clinical outcome (e.g., 'recovered', 'transferred to ICU', 'deceased')")
  outcome?: CodeableConcept;

  @doc("Infection control practitioner notes, investigation findings, and follow-up documentation")
  note?: Annotation[];
}

@doc("Antimicrobial susceptibility result for a single antibiotic against a specific organism isolate.")
model AntibioticSensitivity {
  @doc("The antimicrobial agent tested (RxNorm coded, e.g., 'vancomycin', 'ciprofloxacin')")
  antibiotic: CodeableConcept;

  @doc("Susceptibility result category based on CLSI/EUCAST breakpoints")
  result: SensitivityResult;

  @doc("Minimum inhibitory concentration (MIC) value in mg/L")
  mic?: Quantity;

  @doc("Disk diffusion inhibition zone diameter in millimetres")
  zone?: Quantity;
}

@doc("An antibiogram summarising the antimicrobial susceptibility patterns of a specific organism across a patient population during a defined period. Used for empiric therapy guidance and antimicrobial stewardship decision support.")
model Antibiogram extends HealthcareBaseEntity {
  @doc("The organism this antibiogram covers (SNOMED CT coded, e.g., 'Escherichia coli', 'Klebsiella pneumoniae')")
  organism: CodeableConcept;

  @doc("Reference to the healthcare facility for which this antibiogram was generated (Organization resource)")
  facility: Reference;

  @doc("The time period over which susceptibility data was collected (typically a calendar year or rolling 12 months)")
  period: Period;

  @doc("The number of unique patient isolates analysed to generate this antibiogram. CLSI recommends a minimum of 30 isolates per species for reliable cumulative susceptibility reporting.")
  @minValue(1)
  sampleSize: int32;

  @doc("Susceptibility results for each antimicrobial agent tested. Percentage values represent the proportion of isolates categorised as susceptible.")
  sensitivities: AntibioticSensitivity[];

  @doc("Antimicrobial stewardship programme notes (e.g., methodology notes, outlier exclusions, version history)")
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search Parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for infection surveillance queries.")
model InfectionSurveillanceSearchParams {
  @doc("Filter by patient reference ID")
  @query
  patient?: string;

  @doc("Filter by infection type")
  @query
  infectionType?: InfectionType;

  @doc("Filter by causative organism code (SNOMED CT code value)")
  @query
  organism?: string;

  @doc("Filter by isolation precaution type")
  @query
  isolationPrecaution?: IsolationPrecaution;

  @doc("Filter records with onset at or after this date-time")
  @query
  onsetFrom?: utcDateTime;

  @doc("Filter records with onset at or before this date-time")
  @query
  onsetTo?: utcDateTime;

  @doc("Filter to only notifiable disease records")
  @query
  notifiableOnly?: boolean;

  @doc("Filter by encounter reference ID")
  @query
  encounter?: string;

  ...OffsetPaginationParams;
}

@doc("Search parameters for antibiogram queries.")
model AntibiogramSearchParams {
  @doc("Filter by organism code (SNOMED CT code value)")
  @query
  organism?: string;

  @doc("Filter by facility reference ID")
  @query
  facility?: string;

  @doc("Filter antibiograms with a period starting at or after this date-time")
  @query
  periodFrom?: utcDateTime;

  @doc("Filter antibiograms with a period ending at or before this date-time")
  @query
  periodTo?: utcDateTime;

  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Healthcare-associated infection surveillance management — record, investigate, and report infection events to support infection prevention programmes and public health reporting.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/infection-control/surveillance")
interface InfectionSurveillanceManagement {
  @doc("Create a new infection surveillance record. Automatically triggers notification to the infection control practitioner and, if the organism is notifiable, alerts the public health reporting workflow.")
  @operationId("createInfectionSurveillance")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createInfectionSurveillance(
    @body body: InfectionSurveillance,
  ): {
    @statusCode statusCode: 201;
    @body result: InfectionSurveillance;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single infection surveillance record by its logical ID.")
  @operationId("getInfectionSurveillance")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getInfectionSurveillance(
    @path @doc("InfectionSurveillance logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: InfectionSurveillance;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an infection surveillance record with culture results, isolation precaution changes, and outcome documentation.")
  @operationId("updateInfectionSurveillance")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateInfectionSurveillance(
    @path @doc("InfectionSurveillance logical ID") id: UUID,
    @body body: InfectionSurveillance,
  ): {
    @statusCode statusCode: 200;
    @body result: InfectionSurveillance;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an infection surveillance record. Only permitted for records entered in error.")
  @operationId("deleteInfectionSurveillance")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteInfectionSurveillance(
    @path @doc("InfectionSurveillance logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search infection surveillance records by patient, infection type, causative organism, isolation precaution, and date range. Supports notifiable disease reporting queries.")
  @operationId("searchInfectionSurveillance")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchInfectionSurveillance(
    ...InfectionSurveillanceSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<InfectionSurveillance>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Antibiogram management — maintain facility-specific cumulative antimicrobial susceptibility reports to guide empiric therapy and antimicrobial stewardship programmes.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/infection-control/antibiograms")
interface AntibiogramManagement {
  @doc("Create a new antibiogram for a specific organism, facility, and time period.")
  @operationId("createAntibiogram")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createAntibiogram(
    @body body: Antibiogram,
  ): {
    @statusCode statusCode: 201;
    @body result: Antibiogram;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an antibiogram by its logical ID.")
  @operationId("getAntibiogram")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getAntibiogram(
    @path @doc("Antibiogram logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: Antibiogram;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an antibiogram — typically to update susceptibility percentages or add a note.")
  @operationId("updateAntibiogram")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateAntibiogram(
    @path @doc("Antibiogram logical ID") id: UUID,
    @body body: Antibiogram,
  ): {
    @statusCode statusCode: 200;
    @body result: Antibiogram;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an antibiogram.")
  @operationId("deleteAntibiogram")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteAntibiogram(
    @path @doc("Antibiogram logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search antibiograms by organism, facility, and reporting period. Essential for antimicrobial stewardship programme reporting and empiric therapy guideline development.")
  @operationId("searchAntibiograms")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchAntibiograms(
    ...AntibiogramSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Antibiogram>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
