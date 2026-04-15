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
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Healthcare AI Output Metadata module.
 *
 * Provides models and operations for capturing, tracking, and reviewing
 * metadata about AI-generated outputs used in clinical workflows. Supports
 * governance, explainability, bias assessment, regulatory status tracking,
 * and human-in-the-loop review workflows for AI clinical decision support.
 */
namespace Healthcare.Analytics.AIMetadata;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The type of output produced by an AI model.")
enum AIOutputType {
  @doc("A probabilistic forecast about a future clinical event or outcome")
  prediction,

  @doc("Assignment of a clinical entity to a category or label (e.g., image classification)")
  classification,

  @doc("A suggested clinical action, treatment, or next step")
  recommendation,

  @doc("A condensed representation of a longer clinical document or set of data")
  summary,

  @doc("Identification and extraction of structured data from unstructured text")
  extraction,

  @doc("Conversion of clinical content from one language to another")
  translation,

  @doc("A numeric score representing the probability or magnitude of a clinical risk")
  riskScore,

  @doc("An AI output type not covered by other enumerations")
  other,
}

@doc("The outcome of a human review of an AI-generated output.")
enum ReviewOutcome {
  @doc("The reviewer accepted the AI output as clinically appropriate without modification")
  accepted,

  @doc("The reviewer modified the AI output before clinical use")
  modified,

  @doc("The reviewer rejected the AI output as clinically inappropriate")
  rejected,

  @doc("A review has been requested but not yet completed")
  pending,
}

@doc("The type of evidence source cited to support an AI output.")
enum EvidenceType {
  @doc("A published clinical practice guideline from a professional body")
  clinicalGuideline,

  @doc("A peer-reviewed study published in a scientific journal")
  peerReviewedStudy,

  @doc("A registered clinical trial")
  clinicalTrial,

  @doc("A consensus statement from a panel of clinical experts")
  expertConsensus,

  @doc("Observational data derived from real-world clinical practice")
  realWorldEvidence,

  @doc("An evidence type not covered by other enumerations")
  other,
}

@doc("The regulatory approval status of the AI model that produced the output.")
enum AIRegulatoryStatus {
  @doc("The model is approved for research use only and must not be used for direct clinical decision making")
  researchOnly,

  @doc("The model is intended as clinical decision support but is not subject to device regulation")
  clinicalDecisionSupport,

  @doc("The model has received 510(k) clearance from the US Food and Drug Administration")
  fdaCleared,

  @doc("The model has received Pre-Market Approval (PMA) from the US Food and Drug Administration")
  fdaApproved,

  @doc("The model has received CE marking for the European Economic Area")
  ceMarked,

  @doc("The model is not subject to medical device regulation in any applicable jurisdiction")
  notRegulated,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A citation to a published source that supports or explains an AI-generated
 * output.
 */
model EvidenceSource {
  /** The type of evidence source. */
  type: EvidenceType;

  /** The title of the evidence source (e.g., guideline name, paper title). */
  title: string;

  /** The URL at which the evidence source can be accessed. */
  @format("uri")
  url?: string;

  /** A bibliographic citation for the evidence source. */
  citation?: string;

  /** A score (0.0–1.0) indicating the degree to which this source supports the AI output. */
  @minValue(0.0)
  @maxValue(1.0)
  relevanceScore?: float64;
}

// ---------------------------------------------------------------------------
// Root resource — AIOutputMetadata
// ---------------------------------------------------------------------------

/**
 * Captures the provenance, confidence, and governance metadata for a single
 * output produced by an AI model within a clinical workflow. Enables full
 * traceability from model version through to human review outcome, supporting
 * regulatory compliance and clinical audit requirements.
 */
model AIOutputMetadata extends HealthcareBaseEntity {
  /** The name of the AI model that produced this output. */
  modelName: string;

  /** The version identifier of the AI model that produced this output. */
  modelVersion: string;

  /** The name of the organisation or platform that provides the AI model. */
  modelProvider?: string;

  /** The type of output produced by the AI model. */
  outputType: AIOutputType;

  /** The model's confidence in this output, expressed as a probability between 0.0 and 1.0. */
  @minValue(0.0)
  @maxValue(1.0)
  confidence?: float64;

  /** References to the clinical resources used as input to the AI model (e.g., Observation, DiagnosticReport). */
  inputReferences?: Reference[];

  /** A reference to the clinical resource created or updated as a result of this AI output. */
  outputReference?: Reference;

  /** The date and time at which the AI model was executed. */
  executedAt: utcDateTime;

  /** The model inference latency in milliseconds. */
  latencyMs?: int32;

  /** Published evidence sources cited to support this AI output. */
  evidenceSources?: EvidenceSource[];

  /** Indicates whether a qualified clinician has reviewed this AI output. */
  humanReviewed?: boolean;

  /** The clinician who reviewed this AI output. */
  reviewedBy?: Reference;

  /** The date and time at which the review was completed. */
  reviewedAt?: utcDateTime;

  /** The outcome of the human review. */
  reviewOutcome?: ReviewOutcome;

  /** A human-readable explanation of how the AI model arrived at this output. */
  explanation?: string;

  /** An assessment of potential bias in the AI output, including any known limitations relating to protected characteristics. */
  biasAssessment?: string;

  /** The regulatory approval status of the AI model. */
  regulatoryStatus?: AIRegulatoryStatus;

  /** Mandatory disclaimers or caveats associated with the use of this AI output in clinical practice. */
  disclaimers?: string[];
}

// ---------------------------------------------------------------------------
// Operation models
// ---------------------------------------------------------------------------

/** Request body for submitting a human review decision for an AI output. */
model AIOutputReviewRequest {
  /** The outcome of the human review. */
  reviewOutcome: ReviewOutcome;

  /** The clinician submitting the review. */
  reviewedBy: Reference;

  /** Optional notes from the reviewer about the clinical appropriateness of the output. */
  reviewNote?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching AIOutputMetadata resources. */
model AIOutputSearchParams {
  /** Filter by model name (exact match). */
  @query modelName?: string;

  /** Filter by output type. */
  @query outputType?: string;

  /** Filter by patient reference id (via inputReferences or outputReference). */
  @query patient?: string;

  /** Filter by executed date (ISO 8601 date; inclusive start). */
  @query executedFrom?: string;

  /** Filter by executed date (ISO 8601 date; inclusive end). */
  @query executedTo?: string;

  /** Filter by human review status (true = reviewed, false = not reviewed). */
  @query humanReviewed?: boolean;

  /** Filter by review outcome. */
  @query reviewOutcome?: string;

  /** Filter by regulatory status. */
  @query regulatoryStatus?: string;

  /** Page number (1-based). */
  @query page?: int32;

  /** Number of results per page. */
  @query pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Create, retrieve, search, and review operations for AIOutputMetadata resources.
 */
@tag("Healthcare:Analytics")
@useAuth(bearerAuth)
interface AIOutputManagement {
  /** Record metadata for a new AI model output. */
  @post
  @operationId("createAIOutputMetadata")
  create(
    @body body: AIOutputMetadata,
  ): {
    @statusCode statusCode: 201;
    @body aiOutputMetadata: AIOutputMetadata;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single AIOutputMetadata record by id. */
  @get
  @operationId("getAIOutputMetadata")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body aiOutputMetadata: AIOutputMetadata;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for AIOutputMetadata records using filter parameters. */
  @get
  @operationId("searchAIOutputMetadata")
  @route("/search")
  search(
    ...AIOutputSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<AIOutputMetadata>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Submit a human review decision for an AI output. */
  @post
  @operationId("reviewAIOutput")
  @route("/{id}/review")
  review(
    @path id: string,
    @body body: AIOutputReviewRequest,
  ): {
    @statusCode statusCode: 200;
    @body aiOutputMetadata: AIOutputMetadata;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;
}
