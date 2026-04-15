import "@typespec/http";
import "@typespec/rest";
import "../../common/models.tsp";

using TypeSpec.Http;

/**
 * FHIR-aligned healthcare primitives used across all healthcare modules.
 *
 * These models follow the HL7 FHIR R4 specification for core data types
 * and are the foundational building blocks for the entire healthcare API surface.
 */
namespace Healthcare.Core;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Identifies the purpose of an identifier. Aligns with FHIR IdentifierUse.")
enum IdentifierUse {
  @doc("The preferred identifier for the purpose")
  usual,

  @doc("The identifier considered to be most trusted for this resource")
  official,

  @doc("A temporary identifier")
  temp,

  @doc("An identifier that was assigned in secondary use")
  secondary,

  @doc("The identifier is no longer considered valid, though it may be in use")
  old,
}

@doc("Indicates the purpose of a human name. Aligns with FHIR NameUse.")
enum NameUse {
  @doc("Known as or commonly used")
  usual,

  @doc("The official name as recorded on an official register")
  official,

  @doc("A temporary name; use period should be specified")
  temp,

  @doc("A name used informally")
  nickname,

  @doc("Anonymous assigned name used to protect the person's real name")
  anonymous,

  @doc("This name is no longer in use")
  old,

  @doc("A name used prior to changing name because of marriage")
  maiden,
}

@doc("The type of telecommunication system for a contact point. Aligns with FHIR ContactPointSystem.")
enum ContactSystem {
  @doc("A telephone number reachable by voice calls")
  phone,

  @doc("A fax machine")
  fax,

  @doc("An email address")
  email,

  @doc("A paging device")
  pager,

  @doc("A URL - typically a website or application endpoint")
  url,

  @doc("An SMS-capable phone number")
  sms,

  @doc("A contact point using a system not covered by the other enumerations")
  other,
}

@doc("The intended use of a contact point. Aligns with FHIR ContactPointUse.")
enum ContactUse {
  @doc("A communication contact at a home; use is permissive")
  home,

  @doc("An office contact; first choice for business related contacts")
  work,

  @doc("A temporary contact")
  temp,

  @doc("This contact point is no longer in use")
  old,

  @doc("A telecommunication device that moves and stays with its owner")
  mobile,
}

// ---------------------------------------------------------------------------
// Primitive Models
// ---------------------------------------------------------------------------

@doc("A reference to a code defined by a terminology system. Aligns with FHIR Coding.")
model Coding {
  @doc("The URI for the coding system (e.g., http://loinc.org)")
  @format("uri")
  system: string;

  @doc("The symbol in the syntax defined by the terminology system")
  code: string;

  @doc("A human language representation of the concept as defined by the coding system")
  display?: string;

  @doc("The version of the coding system that defines the code")
  version?: string;

  @doc("Indicates that this coding was chosen by a user directly, not a rule or system")
  userSelected?: boolean;
}

@doc("A concept that may be defined by a formal reference to a terminology or ontology. Aligns with FHIR CodeableConcept.")
model CodeableConcept {
  @doc("One or more codings representing this concept, potentially from multiple coding systems")
  coding: Coding[];

  @doc("A human language representation of the concept as seen or selected by the user")
  text?: string;
}

@doc("A typed pointer to another resource. Aligns with FHIR Reference.")
model Reference {
  @doc("The type of the resource being referenced (e.g., Patient, Practitioner)")
  resourceType: string;

  @doc("The logical id of the referenced resource")
  id: UUID;

  @doc("Plain text narrative that identifies the resource in addition to the resource reference")
  display?: string;
}

@doc("A time period defined by a start and an optional end date/time. Aligns with FHIR Period.")
model Period {
  @doc("The start of the period (inclusive)")
  start: utcDateTime;

  @doc("The end of the period (inclusive). If not present, the period is ongoing.")
  end?: utcDateTime;
}

@doc("A measured or measurable amount with a Unified Code for Units of Measure (UCUM) unit. Aligns with FHIR Quantity.")
model Quantity {
  @doc("The numerical value of the quantity")
  value: float64;

  @doc("The human-readable unit representation (e.g., mg, mL)")
  unit: string;

  @doc("The system that provides the coded form of the unit (typically http://unitsofmeasure.org for UCUM)")
  @format("uri")
  system?: string;

  @doc("The coded form of the unit as defined by the system")
  code?: string;
}

@doc("A set of ordered quantities defined by a low and high limit. Aligns with FHIR Range.")
model Range {
  @doc("The low limit of the range; inclusive if specified")
  low?: Quantity;

  @doc("The high limit of the range; inclusive if specified")
  high?: Quantity;
}

@doc("A relationship between two quantities expressed as a numerator and denominator. Aligns with FHIR Ratio.")
model Ratio {
  @doc("The value of the numerator")
  numerator?: Quantity;

  @doc("The value of the denominator")
  denominator?: Quantity;
}

@doc("A numeric or alphanumeric string that is associated with a single object or entity within a given system. Aligns with FHIR Identifier.")
model Identifier {
  @doc("The purpose of this identifier")
  use?: IdentifierUse;

  @doc("A coded type for the identifier that can be used to determine which identifier to use for a specific purpose")
  type?: CodeableConcept;

  @doc("The namespace for the identifier value (URI)")
  @format("uri")
  system?: string;

  @doc("The identifier value; unique within the context of the system")
  value: string;

  @doc("Time period during which the identifier is or was valid for use")
  period?: Period;

  @doc("Organization that issued or manages the identifier")
  assigner?: Reference;
}

@doc("A human's name with the ability to identify parts and usage. Aligns with FHIR HumanName.")
model HumanName {
  @doc("Identifies the purpose for which this name is being used")
  use?: NameUse;

  @doc("A full text representation of the name")
  text?: string;

  @doc("Family name (often called 'Last name' in Western societies)")
  family?: string;

  @doc("Given names (not always 'First'). Includes middle names.")
  given?: string[];

  @doc("Parts that come before the name (e.g., Mr., Dr.)")
  prefix?: string[];

  @doc("Parts that come after the name (e.g., Jr., MD)")
  suffix?: string[];

  @doc("Time period when name was or is in use")
  period?: Period;
}

@doc("Details for all kinds of technology-mediated contact points for a person or organization. Aligns with FHIR ContactPoint.")
model ContactPoint {
  @doc("The type of communication technology for this contact point")
  system: ContactSystem;

  @doc("The actual contact point details (number, email address, URL, etc.)")
  value: string;

  @doc("Identifies the purpose for the contact point")
  use?: ContactUse;

  @doc("Specifies a preferred order when a patient has multiple contacts; lower rank = higher priority")
  @minValue(1)
  rank?: int32;

  @doc("Time period when the contact point was or is in use")
  period?: Period;
}

@doc("A text note which may also contain information about who made the statement and when. Aligns with FHIR Annotation.")
model Annotation {
  @doc("The individual responsible for making the annotation (as a reference to a resource)")
  authorReference?: Reference;

  @doc("The individual responsible for making the annotation (as a plain text string)")
  authorString?: string;

  @doc("Indicates when this particular annotation was made")
  time?: utcDateTime;

  @doc("The text of the annotation in markdown format")
  text: string;
}

@doc("For referring to data content defined in other formats. Aligns with FHIR Attachment.")
model Attachment {
  @doc("Identifies the type of the data in the attachment and allows a method to be chosen to interpret or render the data (MIME type)")
  contentType?: string;

  @doc("The human language of the content (BCP 47 language tag, e.g., en-US)")
  language?: string;

  @doc("A URL where the data can be retrieved; must be a direct URL to the content")
  @format("uri")
  url?: string;

  @doc("Internal storage key or path for the attachment data within the platform's storage system")
  storageKey?: string;

  @doc("A human-readable label for the attachment")
  title?: string;

  @doc("The number of bytes of data that make up this attachment")
  @minValue(0)
  size?: int64;

  @doc("The calculated hash of the data using SHA-1; encoded as a base64 string for integrity verification")
  hash?: string;

  @doc("The date the attachment was first created")
  creation?: utcDateTime;
}

@doc("Specifies how many/few of the days/weeks/months/years of the repetition period are to take place. Aligns with FHIR TimingRepeat.")
model TimingRepeat {
  @doc("A total count of the desired number of repetitions across the duration of the entire timing specification")
  @minValue(0)
  count?: int32;

  @doc("The duration of each occurrence (amount of time to repeat)")
  @minValue(0)
  duration?: float64;

  @doc("The units of time for the duration (UCUM unit code: s, min, h, d, wk, mo, a)")
  durationUnit?: string;

  @doc("The number of times to repeat the action within the specified period")
  @minValue(1)
  frequency?: int32;

  @doc("Indicates the duration of time over which repetitions are to occur")
  @minValue(0)
  period?: float64;

  @doc("The units of time for the period in UCUM units (s, min, h, d, wk, mo, a)")
  periodUnit?: string;

  @doc("If one or more days of week is provided, the action should happen only on the specified day(s). Values: mon, tue, wed, thu, fri, sat, sun")
  dayOfWeek?: string[];

  @doc("Specified time of day for action to take place (hh:mm:ss format)")
  timeOfDay?: string[];
}

@doc("Specifies an event that may occur multiple times with a code or timing. Aligns with FHIR Timing.")
model Timing {
  @doc("Identifies specific time instances when the event occurs")
  event?: utcDateTime[];

  @doc("A set of rules that describe when the event is scheduled")
  repeat?: TimingRepeat;

  @doc("A code for the timing schedule (e.g., BID, TID, QD)")
  code?: CodeableConcept;
}

@doc("The amount of medication administered, to be administered, or typical amount to be administered. Aligns with FHIR DosageDoseAndRate.")
model DoseAndRate {
  @doc("The kind of dose or rate specified (e.g., ordered, calculated, administered)")
  type?: CodeableConcept;

  @doc("Amount of medication per dose as a simple quantity")
  doseQuantity?: Quantity;

  @doc("Amount of medication per dose as a range")
  doseRange?: Range;

  @doc("Amount of medication per unit of time as a simple quantity")
  rateQuantity?: Quantity;

  @doc("Amount of medication per unit of time as a range")
  rateRange?: Range;

  @doc("Amount of medication per unit of time expressed as a ratio")
  rateRatio?: Ratio;
}

@doc("Indicates how the medication is or should be administered or taken. Aligns with FHIR Dosage.")
model Dosage {
  @doc("Indicates the order in which the dosage instructions should be applied or interpreted when multiple exist")
  sequence?: int32;

  @doc("Free text dosage instructions (e.g., 'Take one tablet twice daily with food')")
  text?: string;

  @doc("Patient or consumer oriented instructions for taking the medication")
  patientInstruction?: string;

  @doc("When medication should be administered")
  timing?: Timing;

  @doc("Body site to administer to")
  site?: CodeableConcept;

  @doc("How drug should enter body (e.g., oral, intravenous, topical)")
  route?: CodeableConcept;

  @doc("Technique for administering medication (e.g., swallow, inject, inhale)")
  method?: CodeableConcept;

  @doc("The amount of medication administered per dose and the rate at which it is given")
  doseAndRate?: DoseAndRate[];
}

@doc("An amount of economic utility in some recognized currency. Aligns with FHIR Money using ISO 4217 currency codes.")
model Money {
  @doc("Numerical value (with implicit precision) as defined in ISO 31-8; amount must be non-negative")
  @minValue(0)
  value: float64;

  @doc("ISO 4217 currency code (e.g., USD, EUR, GBP)")
  @pattern("^[A-Z]{3}$")
  currency: string;
}

@doc("Optional extension element providing additional information not captured in the base resource definition. Aligns with FHIR Extension.")
model ResourceExtension {
  @doc("Source of the definition for the extension code; a logical name or a URL")
  @format("uri")
  url: string;

  @doc("Extension value as a string")
  valueString?: string;

  @doc("Extension value as an integer")
  valueInteger?: int32;

  @doc("Extension value as a decimal number")
  valueDecimal?: float64;

  @doc("Extension value as a boolean")
  valueBoolean?: boolean;

  @doc("Extension value as a date and time")
  valueDateTime?: utcDateTime;

  @doc("Extension value as a coded concept")
  valueCode?: CodeableConcept;

  @doc("Extension value as a reference to another resource")
  valueReference?: Reference;

  @doc("Extension value as a measured quantity with units")
  valueQuantity?: Quantity;
}

// ---------------------------------------------------------------------------
// Healthcare Base Entity
// ---------------------------------------------------------------------------

@doc("Extended base entity for all healthcare resources. Adds multi-tenancy, standard identifiers, and FHIR extensions to the common BaseEntity.")
model HealthcareBaseEntity extends BaseEntity {
  @doc("The tenant this resource belongs to; used for multi-tenant data isolation")
  tenantId: string;

  @doc("Business identifiers assigned to this resource (e.g., MRN, NPI, accession number)")
  identifiers?: Identifier[];

  @doc("Additional content defined by implementations that extends the base resource definition")
  extensions?: ResourceExtension[];
}

// ---------------------------------------------------------------------------
// Data Quality and Privacy Enumerations
// ---------------------------------------------------------------------------

@doc("Reason why a data element value is absent. Aligns with FHIR DataAbsentReason value set.")
enum DataAbsentReason {
  @doc("The value is expected to exist but is not known")
  `unknown`: "unknown",
  @doc("The source was asked but does not know the value")
  askedUnknown: "asked-unknown",
  @doc("There is reason to expect that the value may become known")
  tempUnknown: "temp-unknown",
  @doc("The workflow did not lead to this value being known")
  notAsked: "not-asked",
  @doc("The source was asked but declined to answer")
  askedDeclined: "asked-declined",
  @doc("The information is not available due to security, privacy, or related reasons")
  masked: "masked",
  @doc("There is no proper value for this element (e.g., last menstrual period for a male)")
  notApplicable: "not-applicable",
  @doc("The source system was not capable of supporting this element")
  unsupported: "unsupported",
  @doc("The content of the data is represented in the resource narrative")
  asText: "as-text",
  @doc("Some system or workflow process error means that the information is not available")
  error: "error",
  @doc("The numeric value is undefined or unrepresentable (NaN)")
  notANumber: "not-a-number",
  @doc("The numeric value is excessively low and unrepresentable")
  negativeInfinity: "negative-infinity",
  @doc("The numeric value is excessively high and unrepresentable")
  positiveInfinity: "positive-infinity",
  @doc("The value is not available because the measurement was not started or completed")
  notPerformed: "not-performed",
  @doc("The value is not permitted in this context")
  notPermitted: "not-permitted",
}

@doc("Confidentiality classification for clinical data access control. Aligns with HL7 Confidentiality code system.")
enum ConfidentialityClassification {
  @doc("No restrictions on access")
  unrestricted: "U",
  @doc("Low confidentiality — minimal restrictions")
  low: "L",
  @doc("Moderate confidentiality")
  moderate: "M",
  @doc("Normal confidentiality — standard clinical data protection")
  normal: "N",
  @doc("Restricted — additional access controls required (e.g., mental health, substance use, HIV)")
  restricted: "R",
  @doc("Very restricted — break-glass access only (e.g., VIP, celebrity, employee records)")
  veryRestricted: "V",
}

@doc("Purpose for which data is being accessed or used. Aligns with FHIR PurposeOfUse value set.")
enum PurposeOfUse {
  @doc("Treatment — provision of healthcare")
  treatment: "TREAT",
  @doc("Payment — billing, claims, and revenue cycle")
  payment: "HPAYMT",
  @doc("Healthcare operations — quality, safety, compliance")
  operations: "HOPERAT",
  @doc("System administration — technical operations")
  sysadmin: "SYSADMIN",
  @doc("Fraud detection and prevention")
  fraud: "FRAUD",
  @doc("Psychotherapy notes — special HIPAA protections")
  psychotherapy: "PSYCHOTHERAPY",
  @doc("Training and education purposes")
  training: "TRAIN",
  @doc("Legal proceedings")
  legal: "HLEGAL",
  @doc("Marketing communications (requires explicit consent)")
  marketing: "HMARKT",
  @doc("Provider or facility directory")
  directory: "HDIR",
  @doc("Required disclosure (public health, law enforcement)")
  disclosure: "HDISCL",
  @doc("Emergency treatment access")
  emergency: "ETREAT",
  @doc("Research purposes (requires IRB approval or consent)")
  research: "HRESCH",
}
