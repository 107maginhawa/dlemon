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

namespace Healthcare.Support.Signatures;

@doc("Type of electronic signature.")
enum SignatureType {
  @doc("Author's signature — indicates authorship")
  authorSignature: "1.2.840.10065.1.12.1.1",
  @doc("Co-author's signature")
  coauthorSignature: "1.2.840.10065.1.12.1.2",
  @doc("Co-participant's signature")
  coparticipantSignature: "1.2.840.10065.1.12.1.3",
  @doc("Transcriptionist/recorder signature")
  transcriptionistSignature: "1.2.840.10065.1.12.1.4",
  @doc("Verification signature — confirms accuracy")
  verificationSignature: "1.2.840.10065.1.12.1.5",
  @doc("Validation signature — confirms validity")
  validationSignature: "1.2.840.10065.1.12.1.6",
  @doc("Consent signature — patient consent")
  consentSignature: "1.2.840.10065.1.12.1.7",
  @doc("Witness signature")
  witnessSignature: "1.2.840.10065.1.12.1.8",
  @doc("Event witness signature")
  eventWitnessSignature: "1.2.840.10065.1.12.1.9",
  @doc("Identity witness signature")
  identityWitnessSignature: "1.2.840.10065.1.12.1.10",
  @doc("Addendum signature — appends to a document")
  addendumSignature: "1.2.840.10065.1.12.1.14",
  @doc("Administrative signature")
  administrativeSignature: "1.2.840.10065.1.12.1.15",
  @doc("Timestamp signature — proves existence at point in time")
  timestampSignature: "1.2.840.10065.1.12.1.16",
}

@doc("Electronic signature applied to a clinical document or resource. Aligns with FHIR Signature datatype and X.509/ASTM E1762-95 signature types.")
model ElectronicSignature extends HealthcareBaseEntity {
  @doc("Indication of the reason the entity signed the document")
  type: SignatureType[];

  @doc("When the signature was created")
  when: utcDateTime;

  @doc("Reference to the entity that signed (Practitioner, Patient, RelatedPerson)")
  who: Reference;

  @doc("Reference to the entity on whose behalf the signature was made")
  onBehalfOf?: Reference;

  @doc("The technical format of the signed resources (e.g., 'application/fhir+json')")
  targetFormat?: string;

  @doc("The technical format of the signature (e.g., 'application/jose', 'image/png')")
  sigFormat?: string;

  @doc("The base64-encoded signature content (cryptographic signature or image)")
  data?: string;

  @doc("Reference to the resource(s) that were signed")
  target: Reference[];

  @doc("Reason for the signature (e.g., consent, attestation, correction)")
  reason?: CodeableConcept;

  @doc("Whether this signature has been verified")
  verified?: boolean;

  @doc("When verification occurred")
  verifiedAt?: utcDateTime;

  @doc("Who performed the verification")
  verifiedBy?: Reference;
}

@doc("Request to create an electronic signature")
model CreateSignatureRequest {
  @doc("Indication of the reason the entity signed")
  type: SignatureType[];
  @doc("Reference to the entity that signed")
  who: Reference;
  @doc("On behalf of")
  onBehalfOf?: Reference;
  @doc("Format of signed resources")
  targetFormat?: string;
  @doc("Format of signature")
  sigFormat?: string;
  @doc("Base64-encoded signature content")
  data?: string;
  @doc("References to signed resources")
  target: Reference[];
  @doc("Reason for signing")
  reason?: CodeableConcept;
}

// Interface

@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface SignatureManagement {
  @doc("Create an electronic signature for clinical documents or resources.")
  @operationId("createSignature")
  @post
  create(
    @body body: CreateSignatureRequest
  ): {
    @statusCode _: 201;
    @body body: ElectronicSignature;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

  @doc("Get a signature by ID.")
  @operationId("getSignature")
  @get
  @route("/{id}")
  get(
    @path id: UUID
  ): {
    @statusCode _: 200;
    @body body: ElectronicSignature;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

  @doc("Search signatures for a target resource.")
  @operationId("searchSignatures")
  @get
  @route("/search")
  search(
    @query target?: string,
    @query who?: string,
    @query type?: string,
    ...PaginationQuery
  ): {
    @statusCode _: 200;
    @body body: PaginatedResponse<ElectronicSignature>;
  } | ApiUnauthorizedResponse | ApiForbiddenResponse;

  @doc("Verify a signature.")
  @operationId("verifySignature")
  @post
  @route("/{id}/verify")
  verify(
    @path id: UUID
  ): {
    @statusCode _: 200;
    @body body: ElectronicSignature;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;
}
