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
 * International Patient Summary (IPS) — generation and retrieval of structured
 * clinical summaries for cross-border and point-of-care use.
 *
 * Implements the HL7 International Patient Summary FHIR Implementation Guide
 * (https://hl7.org/fhir/uv/ips/) and the corresponding $summary operation.
 * The IPS is a minimal, non-exhaustive set of data that is needed to ensure
 * safe and coordinated care of a patient across national boundaries.
 */
namespace Healthcare.Conformance.IPS;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("LOINC section codes for International Patient Summary sections as defined in the IPS FHIR Implementation Guide. Values are LOINC document section codes.")
enum IPSSectionCode {
  @doc("Medication Summary section — current medications (LOINC 10160-0)")
  medicationSummary: "10160-0",

  @doc("Allergies and Intolerances section — documented allergies and adverse reactions (LOINC 48765-2)")
  allergiesAndIntolerances: "48765-2",

  @doc("Problem List section — active clinical problems (LOINC 11450-4)")
  problemList: "11450-4",

  @doc("Immunizations section — vaccination history (LOINC 11369-6)")
  immunizations: "11369-6",

  @doc("History of Procedures section — past surgical and clinical procedures (LOINC 47519-4)")
  historyOfProcedures: "47519-4",

  @doc("Medical Devices section — implanted and external devices (LOINC 46264-8)")
  medicalDevices: "46264-8",

  @doc("Diagnostic Results section — laboratory and imaging results (LOINC 30954-2)")
  diagnosticResults: "30954-2",

  @doc("Vital Signs section — current and recent vital sign observations (LOINC 8716-3)")
  vitalSigns: "8716-3",

  @doc("Pregnancy History section — current and past pregnancies (LOINC 10162-6)")
  pregnancyHistory: "10162-6",

  @doc("Social History section — lifestyle and social factors (LOINC 29762-2)")
  socialHistory: "29762-2",

  @doc("Plan of Care section — planned interventions and goals (LOINC 18776-5)")
  planOfCare: "18776-5",

  @doc("Functional Status section — patient's ability to perform activities (LOINC 47420-5)")
  functionalStatus: "47420-5",

  @doc("Advance Directives section — patient's end-of-life preferences (LOINC 42348-3)")
  advanceDirectives: "42348-3",
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A single section within an International Patient Summary, containing a LOINC-coded clinical topic, a human-readable title, and references to the FHIR resources that constitute the section content.")
model IPSSection {
  @doc("LOINC code identifying the clinical topic of this section")
  code: IPSSectionCode;

  @doc("Human-readable title for this section as it should appear in a rendered summary document")
  title: string;

  @doc("Whether this section is required by the IPS specification. Required sections must be present and must contain clinical content or an explicit absence statement.")
  required: boolean;

  @doc("References to the FHIR resources (Condition, MedicationStatement, AllergyIntolerance, etc.) that constitute the content of this section")
  entries?: Reference[];
}

@doc("An International Patient Summary — a minimal, standardised set of clinical information about a patient that enables safe care coordination across clinical settings and national boundaries. Aligns with HL7 IPS FHIR IG.")
model InternationalPatientSummary {
  @doc("Reference to the Patient resource this summary belongs to")
  patient: Reference;

  @doc("Reference to the Practitioner or Organization that authored this summary")
  author: Reference;

  @doc("The date and time at which this summary was generated or last updated")
  date: utcDateTime;

  @doc("Human-readable title for this summary document (e.g., 'Patient Summary for John Smith')")
  title: string;

  @doc("The clinical sections comprising this summary. IPS-required sections must always be present; optional sections are included when data is available or when explicitly requested.")
  sections: IPSSection[];
}

@doc("Request parameters for generating an International Patient Summary for a patient.")
model GenerateIPSRequest {
  @doc("Logical ID of the Patient resource for whom the summary should be generated. Must match the path parameter.")
  patientId: string;

  @doc("When true, the generated summary includes optional IPS sections (Vital Signs, Social History, Pregnancy History, etc.) in addition to the required sections. Defaults to false.")
  includeOptional?: boolean;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("Generate and retrieve International Patient Summary (IPS) documents. The IPS provides a standardised, cross-border clinical snapshot for emergency and continuity-of-care scenarios.")
@tag("Healthcare:Conformance")
@useAuth(bearerAuth)
@route("/fhir/Patient")
interface IPSService {
  @doc("Generate a new International Patient Summary for the specified patient. The server assembles the most current clinical data from all connected sources, structures it according to the IPS FHIR IG, and returns the completed summary. This is a computationally intensive operation; for repeated access, use the GET endpoint to retrieve a cached summary.")
  @operationId("generatePatientSummary")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{patientId}/$summary")
  generatePatientSummary(
    @path @doc("Patient resource logical ID") patientId: string,
    @body body: GenerateIPSRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: InternationalPatientSummary;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve the most recently generated and cached International Patient Summary for the specified patient. Returns a previously computed summary without regenerating it, providing fast access for display and exchange. If no cached summary exists, the server may generate one on demand or return 404.")
  @operationId("getPatientSummary")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{patientId}/$summary")
  getPatientSummary(
    @path @doc("Patient resource logical ID") patientId: string,
  ): {
    @statusCode statusCode: 200;
    @body result: InternationalPatientSummary;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
