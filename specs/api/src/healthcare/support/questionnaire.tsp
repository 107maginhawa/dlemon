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
 * Healthcare Questionnaire and QuestionnaireResponse module.
 *
 * Provides FHIR R4-aligned models and operations for structured data-capture
 * questionnaires and the responses they generate. Supports complex conditional
 * logic, value sets, and nested item hierarchies.
 */
namespace Healthcare.Support.Questionnaires;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The lifecycle status of a questionnaire. Aligns with FHIR PublicationStatus.")
enum QuestionnaireStatus {
  @doc("This resource is still under development and is not yet considered to be ready for normal use")
  draft,

  @doc("This resource is ready for normal use")
  active,

  @doc("This resource has been withdrawn or superseded and should no longer be used")
  retired,

  @doc("The resource was entered in error")
  enteredInError,
}

@doc("The type of a questionnaire item. Aligns with FHIR QuestionnaireItemType.")
enum QuestionnaireItemType {
  @doc("An item with no direct answer but should present a group of child items as a logical unit")
  group,

  @doc("Text for display that will not capture an answer or have child items")
  display,

  @doc("Question with a yes/no answer")
  boolean,

  @doc("Question with a floating-point number answer")
  decimal,

  @doc("Question with an integer answer")
  integer,

  @doc("Question with a date answer")
  date,

  @doc("Question with a date and time answer")
  dateTime,

  @doc("Question with a time of day answer")
  time,

  @doc("Question with a short string answer without line breaks")
  string,

  @doc("Question with a long multiline string answer")
  text,

  @doc("Question with a URL answer")
  url,

  @doc("Question with a Coding drawn from a list of options as its answer")
  choice,

  @doc("Answer is a Coding drawn from a list of options or a free-text entry in a string")
  openChoice,

  @doc("Question with binary content such as an image, PDF or audio recording")
  attachment,

  @doc("Question with a reference to another resource as its answer")
  reference,

  @doc("Question with a combination of a numeric value and a unit, potentially with a comparator")
  quantity,
}

@doc("Controls which items are enabled when multiple enableWhen conditions are present.")
enum EnableBehavior {
  @doc("Enable the question when all the enableWhen criteria are satisfied")
  all,

  @doc("Enable the question when any of the enableWhen criteria are satisfied")
  any,
}

@doc("The operator used to evaluate enableWhen conditions.")
enum EnableWhenOperator {
  @doc("True if whether an answer exists is equal to a boolean value")
  exists,

  @doc("True if whether at least one answer has a value that is equal to the enableWhen answer")
  equals,

  @doc("True if whether at least one answer has a value that is not equal to the enableWhen answer")
  notEquals,

  @doc("True if whether at least one answer has a value that is greater than the enableWhen answer")
  greaterThan,

  @doc("True if whether at least one answer has a value that is less than the enableWhen answer")
  lessThan,

  @doc("True if whether at least one answer has a value that is greater or equal to the enableWhen answer")
  greaterOrEquals,

  @doc("True if whether at least one answer has a value that is less or equal to the enableWhen answer")
  lessOrEquals,
}

@doc("The status of a QuestionnaireResponse. Aligns with FHIR QuestionnaireResponseStatus.")
enum QuestionnaireResponseStatus {
  @doc("This QuestionnaireResponse has been partially filled out with answers but changes or additions are still expected to be made to it")
  inProgress,

  @doc("This QuestionnaireResponse has been filled out with answers and the current content is regarded as definitive")
  completed,

  @doc("This QuestionnaireResponse has been filled out with answers, then marked as complete, yet changes or additions have been made to it afterwards")
  amended,

  @doc("This QuestionnaireResponse was entered in error and voided")
  enteredInError,

  @doc("This QuestionnaireResponse has been partially filled out with answers but has been abandoned; no more changes will be made to it")
  stopped,
}

// ---------------------------------------------------------------------------
// Supporting models — QuestionnaireItem
// ---------------------------------------------------------------------------

/**
 * A possible answer option for a choice or open-choice questionnaire item.
 */
model QuestionnaireAnswerOption {
  /** A potential answer as an integer. */
  valueInteger?: int32;

  /** A potential answer as a date. */
  valueDate?: plainDate;

  /** A potential answer as a string. */
  valueString?: string;

  /** A potential answer as a coded concept. */
  valueCoding?: CodeableConcept;

  /** A potential answer as a reference to another resource. */
  valueReference?: Reference;
}

/**
 * The initial value(s) of a questionnaire item before any answer is provided.
 */
model QuestionnaireInitialValue {
  /** An initial boolean value. */
  valueBoolean?: boolean;

  /** An initial decimal value. */
  valueDecimal?: float64;

  /** An initial integer value. */
  valueInteger?: int32;

  /** An initial date value. */
  valueDate?: plainDate;

  /** An initial date-time value. */
  valueDateTime?: utcDateTime;

  /** An initial string value. */
  valueString?: string;

  /** An initial coded concept value. */
  valueCoding?: CodeableConcept;

  /** An initial quantity value. */
  valueQuantity?: Quantity;

  /** An initial reference to another resource. */
  valueReference?: Reference;
}

/**
 * A condition that controls when a questionnaire item is shown.
 */
model QuestionnaireEnableWhen {
  /** The linkId of the question that determines whether this item is enabled. */
  question: string;

  /** Operator to use when comparing the answer to the operand. */
  operator: EnableWhenOperator;

  /** A boolean operand for the condition. */
  answerBoolean?: boolean;

  /** A decimal operand for the condition. */
  answerDecimal?: float64;

  /** An integer operand for the condition. */
  answerInteger?: int32;

  /** A date operand for the condition. */
  answerDate?: plainDate;

  /** A string operand for the condition. */
  answerString?: string;

  /** A coded concept operand for the condition. */
  answerCoding?: CodeableConcept;
}

/**
 * A single item within a questionnaire, which may contain nested items.
 */
model QuestionnaireItem {
  /** An identifier that is unique within the questionnaire allowing linkage to the equivalent item in a QuestionnaireResponse resource. */
  linkId: string;

  /** This element is a URI that refers to an ElementDefinition that provides information about this item. */
  @format("uri")
  definition?: string;

  /** A terminology code that corresponds to this group or question. */
  code?: CodeableConcept[];

  /** A short label for a particular group, question or set of display text within the questionnaire used for reference by the individual completing the questionnaire. */
  prefix?: string;

  /** The name of a section, the text of a question or text content for a display item. */
  text: string;

  /** The type of questionnaire item this is — whether text for display, a grouping of other items or a particular type of data to be captured. */
  type: QuestionnaireItemType;

  /** An indication, if true, that the item must be present in a completed QuestionnaireResponse. */
  required?: boolean;

  /** An indication, if true, that the item may occur multiple times in the response, collecting multiple answers for questions or multiple sets of answers for groups. */
  repeats?: boolean;

  /** An indication, when true, that the value cannot be changed by a human respondent to the Questionnaire. */
  readOnly?: boolean;

  /** The maximum number of characters that are permitted in the answer to be considered a valid QuestionnaireResponse. */
  maxLength?: int32;

  /** A reference to a value set containing a list of codes representing permitted answers for a question. */
  answerValueSet?: string;

  /** One of the permitted answers for a question in the questionnaire. */
  answerOption?: QuestionnaireAnswerOption[];

  /** One or more values that should be pre-populated in the answer when initially rendering the questionnaire for user input. */
  initial?: QuestionnaireInitialValue[];

  /** A constraint indicating that this item should only be enabled (displayed/allow answers) when the specified condition is true. */
  enableWhen?: QuestionnaireEnableWhen[];

  /** Controls how multiple enableWhen values are interpreted - whether all or any must be true. */
  enableBehavior?: EnableBehavior;

  /** Text, questions and other groups to be nested beneath a question or group. */
  item?: QuestionnaireItem[];
}

// ---------------------------------------------------------------------------
// Root resource — Questionnaire
// ---------------------------------------------------------------------------

/**
 * A structured set of questions intended to guide the collection of answers
 * from end-users. Mapped to FHIR R4 Questionnaire.
 */
model Questionnaire extends HealthcareBaseEntity {
  /** An absolute URI that is used to identify this questionnaire when it is referenced in a specification, model, design or an instance. */
  @format("uri")
  url?: string;

  /** A natural language name identifying the questionnaire; used as a computer-friendly identifier. */
  name?: string;

  /** A short, descriptive, user-friendly title for the questionnaire. */
  title: string;

  /** The status of this questionnaire. */
  status: QuestionnaireStatus;

  /** A free text natural language description of the questionnaire from a consumer's perspective. */
  description?: string;

  /** Explanation of why this questionnaire is needed and why it has been designed as it has. */
  purpose?: string;

  /** The types of subjects that can be the subject of responses created for the questionnaire (e.g., "Patient", "Encounter"). */
  subjectType?: string[];

  /** An identifier for this question or group of questions in a particular terminology such as LOINC. */
  code?: CodeableConcept[];

  /** A particular question, question grouping or display text that is part of the questionnaire. */
  item: QuestionnaireItem[];
}

// ---------------------------------------------------------------------------
// Supporting models — QuestionnaireResponse
// ---------------------------------------------------------------------------

/**
 * An answer to a specific question within a questionnaire response, which
 * may itself contain nested response items.
 */
model QuestionnaireResponseAnswer {
  /** A boolean answer to a question. */
  valueBoolean?: boolean;

  /** A decimal answer to a question. */
  valueDecimal?: float64;

  /** An integer answer to a question. */
  valueInteger?: int32;

  /** A date answer to a question. */
  valueDate?: plainDate;

  /** A date-time answer to a question. */
  valueDateTime?: utcDateTime;

  /** A string answer to a question. */
  valueString?: string;

  /** A coded concept answer to a question. */
  valueCoding?: CodeableConcept;

  /** A quantity answer to a question. */
  valueQuantity?: Quantity;

  /** A reference answer to a question. */
  valueReference?: Reference;

  /** Nested groups and/or questions found within this particular answer. */
  item?: QuestionnaireResponseItem[];
}

/**
 * A group or question item in a QuestionnaireResponse, potentially with
 * nested items or multiple answers.
 */
model QuestionnaireResponseItem {
  /** The item from the Questionnaire that corresponds to this item in the QuestionnaireResponse resource. */
  linkId: string;

  /** A reference to an ElementDefinition that provides the details for the item. */
  @format("uri")
  definition?: string;

  /** Text that is displayed above the contents of the group or as the text of the question being answered. */
  text?: string;

  /** The respondent's answer(s) to the question. */
  answer?: QuestionnaireResponseAnswer[];

  /** Questions or sub-groups nested beneath a question or group. */
  item?: QuestionnaireResponseItem[];
}

// ---------------------------------------------------------------------------
// Root resource — QuestionnaireResponse
// ---------------------------------------------------------------------------

/**
 * A structured set of questions and their answers. Mapped to FHIR R4
 * QuestionnaireResponse.
 */
model QuestionnaireResponse extends HealthcareBaseEntity {
  /** The Questionnaire that defines and organizes the questions for which answers are being provided. */
  questionnaire: Reference;

  /** The position of the questionnaire response within its overall lifecycle. */
  status: QuestionnaireResponseStatus;

  /** The subject of the questionnaire response — the patient this is about. */
  subject?: Reference;

  /** The Encounter during which this questionnaire response was created or to which the creation of this record is tightly associated. */
  encounter?: Reference;

  /** The date and/or time that this set of answers were last changed. */
  authored?: utcDateTime;

  /** Person who received the answers to the questions in the QuestionnaireResponse and recorded them in the system. */
  author?: Reference;

  /** The person who answered the questions about the subject. */
  source?: Reference;

  /** A group or question item from the original questionnaire for which answers are provided. */
  item?: QuestionnaireResponseItem[];
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching Questionnaire resources. */
model QuestionnaireSearchParams {
  /** Filter by title text (partial match). */
  @query title?: string;

  /** Filter by publication status. */
  @query status?: string;

  /** Filter by code (system|code). */
  @query code?: string;

  ...PaginationQuery;
}

/** Query parameters for searching QuestionnaireResponse resources. */
model QuestionnaireResponseSearchParams {
  /** Filter by the referenced questionnaire id. */
  @query questionnaire?: string;

  /** Filter by subject (patient) reference id. */
  @query subject?: string;

  /** Filter by author reference id. */
  @query author?: string;

  /** Filter by response status. */
  @query status?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for Questionnaire resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface QuestionnaireManagement {
  /** Create a new Questionnaire. */
  @post
  @operationId("createQuestionnaire")
  create(
    @body body: Questionnaire,
  ): {
    @statusCode statusCode: 201;
    @body questionnaire: Questionnaire;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single Questionnaire by id. */
  @get
  @operationId("getQuestionnaire")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body questionnaire: Questionnaire;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing Questionnaire. */
  @put
  @operationId("updateQuestionnaire")
  @route("/{id}")
  update(
    @path id: string,
    @body body: Questionnaire,
  ): {
    @statusCode statusCode: 200;
    @body questionnaire: Questionnaire;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a Questionnaire. */
  @patch
  @operationId("patchQuestionnaire")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body questionnaire: Questionnaire;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a Questionnaire by id. */
  @delete
  @operationId("deleteQuestionnaire")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for Questionnaires using filter parameters. */
  @get
  @operationId("searchQuestionnaires")
  @route("/search")
  search(
    ...QuestionnaireSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Questionnaire>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for QuestionnaireResponse resources.
 */
@tag("Healthcare:Support")
@useAuth(bearerAuth)
interface QuestionnaireResponseManagement {
  /** Create a new QuestionnaireResponse. */
  @post
  @operationId("createQuestionnaireResponse")
  create(
    @body body: QuestionnaireResponse,
  ): {
    @statusCode statusCode: 201;
    @body questionnaireResponse: QuestionnaireResponse;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single QuestionnaireResponse by id. */
  @get
  @operationId("getQuestionnaireResponse")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body questionnaireResponse: QuestionnaireResponse;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing QuestionnaireResponse. */
  @put
  @operationId("updateQuestionnaireResponse")
  @route("/{id}")
  update(
    @path id: string,
    @body body: QuestionnaireResponse,
  ): {
    @statusCode statusCode: 200;
    @body questionnaireResponse: QuestionnaireResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update a QuestionnaireResponse. */
  @patch
  @operationId("patchQuestionnaireResponse")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body questionnaireResponse: QuestionnaireResponse;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete a QuestionnaireResponse by id. */
  @delete
  @operationId("deleteQuestionnaireResponse")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for QuestionnaireResponses using filter parameters. */
  @get
  @operationId("searchQuestionnaireResponses")
  @route("/search")
  search(
    ...QuestionnaireResponseSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<QuestionnaireResponse>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
