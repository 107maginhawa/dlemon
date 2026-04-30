# Healthcare Standards - Code Implementation Examples

Ready-to-use TypeScript code snippets for standards implementation.

---

## 1. CapabilityStatement Generation

### TypeSpec Definition

```typespec
// specs/api/src/healthcare/foundation/capability-statement.tsp
import "@typespec/http";
import "@typespec/rest";
import "../../common/models.tsp";
import "../core/primitives.tsp";

using TypeSpec.Http;

namespace Healthcare.Foundation;

@doc("FHIR Capability Statement declaring supported resources and operations")
model CapabilityStatement extends HealthcareBaseEntity {
  @doc("The canonical URL for this capability statement")
  url?: string;

  @doc("Human-friendly name")
  name?: string;

  @doc("Human-friendly title")
  title?: string;

  @doc("Status (draft | active | retired | unknown)")
  status: "draft" | "active" | "retired" | "unknown";

  @doc("Software implementation details")
  software: {
    name: string;
    version?: string;
    releaseDate?: utcDateTime;
  };

  @doc("FHIR version (e.g., 4.0.1)")
  fhirVersion: string;

  @doc("Kind of capability statement (instance | capability | requirements)")
  kind: "instance" | "capability" | "requirements";

  @doc("Implementation details")
  implementation?: {
    description: string;
    url?: string;
  };

  @doc("Security implementation details")
  security?: {
    service?: CodeableConcept[];
    cors?: boolean;
    description?: string;
  };

  @doc("Supported resources and operations")
  rest?: CapabilityStatementRest[];
}

@doc("FHIR server or client implementation")
model CapabilityStatementRest {
  @doc("Identify if the rest config is a server (true) or a client (false)")
  mode: "server" | "client";

  @doc("General description of implementation")
  documentation?: string;

  @doc("Supported resources")
  resource?: CapabilityStatementRestResource[];

  @doc("Supported interactions")
  interaction?: CapabilityStatementRestInteraction[];

  @doc("Search parameters")
  searchParam?: CapabilityStatementSearchParam[];
}

@doc("Information about a resource type")
model CapabilityStatementRestResource {
  @doc("A resource type that is supported")
  type: string;

  @doc("Base System profile")
  profile?: string;

  @doc("Describes the kind of operation")
  interaction?: CapabilityStatementResourceInteraction[];

  @doc("Search parameters supported")
  searchParam?: CapabilityStatementSearchParam[];
}

@doc("Resource interaction")
model CapabilityStatementResourceInteraction {
  @doc("Kind of interaction (create, read, update, delete, history, search-type, vread)")
  code: string;

  @doc("Anything special about operation behavior")
  documentation?: string;
}

@doc("REST interaction")
model CapabilityStatementRestInteraction {
  @doc("Kind of interaction (transaction, batch, search-system, history-system)")
  code: string;

  @doc("Anything special about operation behavior")
  documentation?: string;
}

@doc("Search parameter")
model CapabilityStatementSearchParam {
  @doc("Name of search parameter")
  name: string;

  @doc("Source of definition for parameter")
  definition?: string;

  @doc("number | date | string | token | reference | composite | quantity | uri")
  type: string;

  @doc("Server and client friendly description")
  documentation?: string;
}

@useAuth(bearerAuth)
interface CapabilityStatementInterface {
  @doc("Get the server's FHIR capability statement")
  @get
  @operationId("getCapabilityStatement")
  @route("/.well-known/metadata")
  getCapability(): {
    @statusCode statusCode: 200;
    @body statement: CapabilityStatement;
  };
}
```

### Handler Implementation

```typescript
// services/api-ts/src/handlers/healthcare/foundation/capability-statement.handler.ts
import { Hono } from "hono";
import { logger } from "@/core/logger";

export const capabilityStatementRouter = new Hono();

interface CapabilityStatement {
  resourceType: "CapabilityStatement";
  url: string;
  version: string;
  name: string;
  title: string;
  status: "active";
  date: string;
  publisher: string;
  contact: {
    name: string;
    telecom: { system: string; value: string }[];
  }[];
  description: string;
  kind: "instance";
  software: {
    name: string;
    version: string;
    releaseDate: string;
  };
  implementation: {
    description: string;
    url: string;
  };
  fhirVersion: string;
  format: string[];
  patchFormat: string[];
  implementationGuide: string[];
  rest: [
    {
      mode: "server";
      documentation: string;
      security: {
        cors: boolean;
        service: Array<{
          system: string;
          code: string;
          display: string;
        }>;
        description: string;
      };
      resource: Array<{
        type: string;
        profile: string;
        documentation: string;
        interaction: Array<{
          code: "read" | "vread" | "update" | "patch" | "delete" | "history" | "create" | "search-type";
          documentation: string;
        }>;
        searchParam: Array<{
          name: string;
          type: "number" | "date" | "string" | "token" | "reference" | "composite" | "quantity" | "uri";
          documentation: string;
        }>;
      }>;
      interaction: Array<{
        code: "transaction" | "batch" | "search-system" | "history-system";
      }>;
      operation: Array<{
        name: string;
        definition: string;
        documentation: string;
      }>;
    }
  ];
}

// Generate capability statement
function buildCapabilityStatement(): CapabilityStatement {
  const timestamp = new Date().toISOString();

  return {
    resourceType: "CapabilityStatement",
    url: "https://api.monobase.io/fhir/metadata",
    version: "1.0.0",
    name: "MonobaseHealthcareAPI",
    title: "Monobase Healthcare API - FHIR R4",
    status: "active",
    date: timestamp,
    publisher: "Monobase Labs",
    contact: [
      {
        name: "Monobase Support",
        telecom: [
          {
            system: "email",
            value: "support@monobase.io",
          },
        ],
      },
    ],
    description:
      "FHIR R4 compliant healthcare API providing patient, clinical, administrative, and operational data access.",
    kind: "instance",
    software: {
      name: "Monobase Healthcare Platform",
      version: process.env.API_VERSION || "1.0.0",
      releaseDate: "2026-04-01",
    },
    implementation: {
      description: "Monobase Healthcare API Production Server",
      url: "https://api.monobase.io/fhir",
    },
    fhirVersion: "4.0.1",
    format: ["application/fhir+json", "application/fhir+xml"],
    patchFormat: ["application/json-patch+json"],
    implementationGuide: [
      "https://monobase.io/healthcare-api-ig/",
    ],
    rest: [
      {
        mode: "server",
        documentation:
          "The Monobase Healthcare API implements the FHIR R4 specification with custom profiles for healthcare data exchange.",
        security: {
          cors: true,
          service: [
            {
              system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
              code: "OAuth",
              display: "OAuth2 using SMART Application Launch",
            },
            {
              system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
              code: "SAML",
              display: "SAML",
            },
          ],
          description:
            "Servers MAY authenticate users using SMART on FHIR OAuth 2.0, SAML, or mutual TLS. Clients SHOULD support OAuth 2.0 Bearer tokens.",
        },
        resource: [
          // Patient resource
          {
            type: "Patient",
            profile: "http://monobase.io/StructureDefinition/MonobasePatient",
            documentation: "Patient demographics and contact information.",
            interaction: [
              {
                code: "read",
                documentation: "Read a Patient resource by ID.",
              },
              {
                code: "create",
                documentation: "Create a new Patient resource.",
              },
              {
                code: "update",
                documentation: "Update an existing Patient resource.",
              },
              {
                code: "delete",
                documentation: "Delete a Patient resource.",
              },
              {
                code: "search-type",
                documentation: "Search for Patient resources.",
              },
              {
                code: "vread",
                documentation: "Read a specific version of a Patient.",
              },
              {
                code: "history",
                documentation: "Get version history of a Patient.",
              },
            ],
            searchParam: [
              {
                name: "identifier",
                type: "token",
                documentation: "A patient identifier",
              },
              {
                name: "name",
                type: "string",
                documentation: "A portion of either family or given name",
              },
              {
                name: "birthdate",
                type: "date",
                documentation: "The patient's date of birth",
              },
              {
                name: "gender",
                type: "token",
                documentation: "Gender of the patient",
              },
              {
                name: "email",
                type: "token",
                documentation: "A value in an email contact",
              },
              {
                name: "phone",
                type: "token",
                documentation: "A value in a phone contact",
              },
            ],
          },
          // Encounter resource
          {
            type: "Encounter",
            profile: "http://monobase.io/StructureDefinition/MonobaseEncounter",
            documentation: "Encounter details and clinical visit information.",
            interaction: [
              { code: "read", documentation: "Read an Encounter." },
              { code: "create", documentation: "Create a new Encounter." },
              { code: "update", documentation: "Update an Encounter." },
              { code: "search-type", documentation: "Search Encounters." },
            ],
            searchParam: [
              {
                name: "patient",
                type: "reference",
                documentation: "The patient present at the encounter",
              },
              {
                name: "type",
                type: "token",
                documentation: "Specific type of encounter",
              },
              {
                name: "date",
                type: "date",
                documentation: "A date within the period the encounter took place",
              },
              {
                name: "status",
                type: "token",
                documentation: "planned | arrived | triaged | in-progress | onleave | finished | cancelled",
              },
            ],
          },
          // Consent resource
          {
            type: "Consent",
            profile: "http://monobase.io/StructureDefinition/MonobaseConsent",
            documentation: "Patient consent for treatment, research, and data sharing.",
            interaction: [
              { code: "read", documentation: "Read a Consent." },
              { code: "create", documentation: "Create a new Consent." },
              { code: "update", documentation: "Update a Consent." },
              { code: "search-type", documentation: "Search Consents." },
            ],
            searchParam: [
              {
                name: "patient",
                type: "reference",
                documentation: "Who the consent applies to",
              },
              {
                name: "status",
                type: "token",
                documentation: "draft | proposed | active | rejected | inactive | entered-in-error",
              },
              {
                name: "scope",
                type: "token",
                documentation: "Which of the four areas this applies to",
              },
            ],
          },
          // Observation resource
          {
            type: "Observation",
            profile: "http://monobase.io/StructureDefinition/MonobaseObservation",
            documentation: "Measurements and simple assertions.",
            interaction: [
              { code: "read", documentation: "Read an Observation." },
              { code: "create", documentation: "Create a new Observation." },
              { code: "search-type", documentation: "Search Observations." },
            ],
            searchParam: [
              {
                name: "subject",
                type: "reference",
                documentation: "The subject that the observation is about",
              },
              {
                name: "code",
                type: "token",
                documentation: "The code of the observation type",
              },
              {
                name: "date",
                type: "date",
                documentation: "Obtained date/time",
              },
              {
                name: "status",
                type: "token",
                documentation: "The status of the observation",
              },
            ],
          },
          // AuditEvent resource
          {
            type: "AuditEvent",
            profile: "http://monobase.io/StructureDefinition/MonobaseAuditEvent",
            documentation: "FHIR Audit Event for compliance logging.",
            interaction: [
              { code: "read", documentation: "Read an AuditEvent." },
              { code: "search-type", documentation: "Search AuditEvents." },
            ],
            searchParam: [
              {
                name: "entity",
                type: "reference",
                documentation: "Specific instance of resource (e.g. versioned)",
              },
              {
                name: "date",
                type: "date",
                documentation: "Time when the event was recorded",
              },
              {
                name: "outcome",
                type: "token",
                documentation: "Whether the event succeeded or failed",
              },
            ],
          },
          // ... Add more resources as implemented
        ],
        interaction: [
          {
            code: "transaction",
            // documentation: "Supports full batch mode for multiple operations"
          },
        ],
        operation: [
          {
            name: "validate",
            definition:
              "http://hl7.org/fhir/OperationDefinition/Resource-validate",
            documentation:
              "Validate a resource against its profile and invariants.",
          },
          {
            name: "expand",
            definition:
              "http://hl7.org/fhir/OperationDefinition/ValueSet-expand",
            documentation: "Expand a value set to get all codes.",
          },
          {
            name: "validate-code",
            definition:
              "http://hl7.org/fhir/OperationDefinition/ValueSet-validate-code",
            documentation: "Validate that a code is in a value set.",
          },
          {
            name: "lookup",
            definition:
              "http://hl7.org/fhir/OperationDefinition/CodeSystem-lookup",
            documentation: "Get details of a specific code.",
          },
        ],
      },
    ],
  };
}

capabilityStatementRouter.get("/.well-known/metadata", async (c) => {
  try {
    const capabilityStatement = buildCapabilityStatement();
    return c.json(capabilityStatement, 200);
  } catch (error) {
    logger.error("Error building capability statement", { error });
    return c.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "processing",
            diagnostics: "Error building capability statement",
          },
        ],
      },
      500
    );
  }
});

export default capabilityStatementRouter;
```

---

## 2. FHIR Validation Pipeline

### CI/CD Integration

```typescript
// scripts/validate-fhir.ts
// Run during build to validate all FHIR resources
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const VALIDATOR_JAR = "./fhir-validator.jar";
const RESOURCES_DIR = "./dist/fhir-resources";

interface ValidationResult {
  valid: boolean;
  file: string;
  issues: string[];
}

async function validateFHIRResources(): Promise<void> {
  console.log("🔍 Validating FHIR Resources...");

  // Get all FHIR resource files
  const resourceFiles = fs
    .readdirSync(RESOURCES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(RESOURCES_DIR, f));

  let totalValid = 0;
  let totalInvalid = 0;
  const results: ValidationResult[] = [];

  for (const file of resourceFiles) {
    try {
      const output = execSync(
        `java -jar ${VALIDATOR_JAR} ${file} -profile http://hl7.org/fhir/StructureDefinition/Patient`,
        { encoding: "utf-8" }
      );

      if (output.includes("errors")) {
        console.error(`❌ ${path.basename(file)}`);
        totalInvalid++;
        results.push({
          valid: false,
          file,
          issues: output.split("\n"),
        });
      } else {
        console.log(`✓ ${path.basename(file)}`);
        totalValid++;
        results.push({
          valid: true,
          file,
          issues: [],
        });
      }
    } catch (error: any) {
      console.error(`❌ ${path.basename(file)}: ${error.message}`);
      totalInvalid++;
      results.push({
        valid: false,
        file,
        issues: [error.message],
      });
    }
  }

  console.log(`\n📊 Validation Results:`);
  console.log(`   Valid: ${totalValid}`);
  console.log(`   Invalid: ${totalInvalid}`);
  console.log(`   Total: ${totalValid + totalInvalid}`);

  if (totalInvalid > 0) {
    console.error("\n❌ Validation failed!");
    results.filter((r) => !r.valid).forEach((r) => {
      console.error(`\n${r.file}:`);
      r.issues.forEach((issue) => console.error(`  - ${issue}`));
    });
    process.exit(1);
  }

  console.log("\n✓ All resources valid!");
}

validateFHIRResources().catch((error) => {
  console.error("Validation error:", error);
  process.exit(1);
});
```

### Validation Endpoint

```typescript
// services/api-ts/src/handlers/healthcare/fhir/validate.handler.ts
import { Hono } from "hono";
import { logger } from "@/core/logger";
import * as Ajv from "ajv";

const app = new Hono();

interface ValidateRequest {
  resource: any;
  profile?: string;
}

interface OperationOutcome {
  resourceType: "OperationOutcome";
  issue: {
    severity: "fatal" | "error" | "warning" | "information";
    code: string;
    details?: {
      coding?: { code: string; display: string }[];
      text?: string;
    };
    diagnostics?: string;
    location?: string[];
  }[];
}

// Simplified validator using AJV (Ajv for JSON schema validation)
// In production, use FHIR Validator library
class FHIRValidator {
  private ajv: Ajv.Ajv;

  constructor() {
    this.ajv = new Ajv();
  }

  validate(resource: any): { valid: boolean; issues: OperationOutcome["issue"][] } {
    const issues: OperationOutcome["issue"][] = [];

    // Basic validation
    if (!resource.resourceType) {
      issues.push({
        severity: "error",
        code: "required",
        diagnostics: "Missing required field: resourceType",
        location: ["resourceType"],
      });
    }

    if (!resource.id) {
      issues.push({
        severity: "error",
        code: "required",
        diagnostics: "Missing required field: id",
        location: ["id"],
      });
    }

    // Resource-specific validation
    switch (resource.resourceType) {
      case "Patient":
        this.validatePatient(resource, issues);
        break;
      case "Encounter":
        this.validateEncounter(resource, issues);
        break;
      case "Consent":
        this.validateConsent(resource, issues);
        break;
      // ... etc for other resources
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  private validatePatient(resource: any, issues: OperationOutcome["issue"][]): void {
    // At least one name should be present
    if (!resource.name || resource.name.length === 0) {
      issues.push({
        severity: "warning",
        code: "required",
        diagnostics: "Patient should have at least one name",
        location: ["name"],
      });
    }

    // Contact method validation
    if (resource.telecom) {
      resource.telecom.forEach((contact: any, idx: number) => {
        if (!contact.system || !contact.value) {
          issues.push({
            severity: "error",
            code: "required",
            diagnostics: "Telecom must have system and value",
            location: [`telecom[${idx}]`],
          });
        }
      });
    }
  }

  private validateEncounter(resource: any, issues: OperationOutcome["issue"][]): void {
    const validStatus = ["planned", "arrived", "triaged", "in-progress", "onleave", "finished", "cancelled", "entered-in-error", "unknown"];

    if (!validStatus.includes(resource.status)) {
      issues.push({
        severity: "error",
        code: "invalid",
        diagnostics: `Invalid status: ${resource.status}. Must be one of: ${validStatus.join(", ")}`,
        location: ["status"],
      });
    }

    if (!resource.subject || !resource.subject.reference) {
      issues.push({
        severity: "error",
        code: "required",
        diagnostics: "Encounter must reference a subject (patient)",
        location: ["subject"],
      });
    }
  }

  private validateConsent(resource: any, issues: OperationOutcome["issue"][]): void {
    const validStatus = ["draft", "proposed", "active", "rejected", "inactive", "entered-in-error"];

    if (!validStatus.includes(resource.status)) {
      issues.push({
        severity: "error",
        code: "invalid",
        diagnostics: `Invalid status: ${resource.status}`,
        location: ["status"],
      });
    }

    if (!resource.scope) {
      issues.push({
        severity: "error",
        code: "required",
        diagnostics: "Consent must have a scope",
        location: ["scope"],
      });
    }
  }
}

const validator = new FHIRValidator();

app.post("/fhir/$validate", async (c) => {
  try {
    const body = await c.req.json() as ValidateRequest;

    const { valid, issues } = validator.validate(body.resource);

    const outcome: OperationOutcome = {
      resourceType: "OperationOutcome",
      issue: issues.length > 0 ? issues : [
        {
          severity: "information",
          code: "processing",
          diagnostics: valid ? "Resource is valid" : "Validation completed",
        },
      ],
    };

    return c.json(outcome, valid ? 200 : 400);
  } catch (error: any) {
    logger.error("Validation error", { error });
    return c.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: error.message,
          },
        ],
      },
      500
    );
  }
});

export default app;
```

---

## 3. Consent Enforcement

```typescript
// services/api-ts/src/handlers/healthcare/support/consent-enforcer.ts
import { logger } from "@/core/logger";

export enum ConsentAction {
  READ = "read",
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
}

export enum PurposeOfUse {
  TREATMENT = "TREAT",
  PAYMENT = "HPAYMT",
  OPERATIONS = "HOPERAT",
  RESEARCH = "HRESCH",
}

export class ConsentEnforcer {
  constructor(private consentRepo: any) {}

  async checkConsent(params: {
    patientId: string;
    action: ConsentAction;
    dataType: string; // "Encounter", "Observation", "MedicationRequest"
    requesterUserId: string;
    purposeOfUse: PurposeOfUse;
  }): Promise<{ allowed: boolean; reason?: string }> {
    logger.info("Checking consent", params);

    // 1. Find active consent for patient
    const consent = await this.consentRepo.findActiveConsentForPatient(params.patientId);

    if (!consent) {
      logger.warn("No active consent found", { patientId: params.patientId });
      return { allowed: false, reason: "No active consent found" };
    }

    // 2. Check status
    if (consent.status !== "active") {
      return { allowed: false, reason: `Consent status is ${consent.status}` };
    }

    // 3. Check period validity
    const now = new Date();
    if (consent.provision?.period) {
      if (consent.provision.period.start && consent.provision.period.start > now) {
        return { allowed: false, reason: "Consent period not yet started" };
      }
      if (consent.provision.period.end && consent.provision.period.end < now) {
        return { allowed: false, reason: "Consent period has ended" };
      }
    }

    // 4. Check provision type (permit vs deny)
    const provision = consent.provision;
    if (!provision) {
      return { allowed: false, reason: "No provisions in consent" };
    }

    // Determine if this is a permit or deny
    const isPermitType = provision.type === "permit";
    const isDenyType = provision.type === "deny";

    // 5. Check action
    if (provision.action && provision.action.length > 0) {
      const allowedActions = provision.action.map((a: any) => a.code);

      if (isPermitType && !allowedActions.includes(params.action)) {
        return {
          allowed: false,
          reason: `Consent does not permit ${params.action} action`,
        };
      }

      if (isDenyType && allowedActions.includes(params.action)) {
        return {
          allowed: false,
          reason: `Consent denies ${params.action} action`,
        };
      }
    }

    // 6. Check data type/class
    if (provision.class && provision.class.length > 0) {
      const allowedClasses = provision.class.map((c: any) => c.code);

      if (isPermitType && !allowedClasses.includes(params.dataType)) {
        return {
          allowed: false,
          reason: `Consent does not permit access to ${params.dataType}`,
        };
      }

      if (isDenyType && allowedClasses.includes(params.dataType)) {
        return {
          allowed: false,
          reason: `Consent denies access to ${params.dataType}`,
        };
      }
    }

    // 7. Check actor (is requester authorized?)
    if (provision.actor && provision.actor.length > 0) {
      const authorizedActors = provision.actor
        .filter((a: any) =>
          a.role?.code === "performer" || a.role?.code === "author"
        )
        .map((a: any) => a.reference?.id);

      if (!authorizedActors.includes(params.requesterUserId)) {
        return {
          allowed: false,
          reason: `User ${params.requesterUserId} is not authorized actor in consent`,
        };
      }
    }

    // 8. Check purpose
    if (provision.purpose && provision.purpose.length > 0) {
      const allowedPurposes = provision.purpose.map((p: any) => p.code);

      if (!allowedPurposes.includes(params.purposeOfUse)) {
        return {
          allowed: false,
          reason: `Consent does not permit ${params.purposeOfUse} purpose`,
        };
      }
    }

    logger.info("Consent check passed", params);
    return { allowed: true };
  }
}

// Usage in handler
export async function requireConsent(params: {
  patientId: string;
  action: ConsentAction;
  dataType: string;
  requesterUserId: string;
  purposeOfUse: PurposeOfUse;
}) {
  const enforcer = new ConsentEnforcer(consentRepository);
  const { allowed, reason } = await enforcer.checkConsent(params);

  if (!allowed) {
    logger.warn("Consent check failed", { params, reason });
    throw new ForbiddenError(`Access denied: ${reason}`);
  }
}
```

---

## 4. SMART on FHIR OAuth Configuration

```typescript
// services/api/src/core/smart-config.ts
interface SMARTConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string;
  introspection_endpoint: string;
  userinfo_endpoint: string;
  grant_types_supported: string[];
  response_types_supported: string[];
  scopes_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}

export function getSMARTConfiguration(): SMARTConfiguration {
  const baseUrl = process.env.API_BASE_URL || "https://api.monobase.io";

  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    introspection_endpoint: `${baseUrl}/oauth/introspect`,
    userinfo_endpoint: `${baseUrl}/oauth/userinfo`,

    grant_types_supported: [
      "authorization_code",
      "implicit",
      "refresh_token",
      "client_credentials",
    ],

    response_types_supported: [
      "code",
      "token",
      "id_token",
      "id_token token",
      "code id_token",
      "code token",
      "code id_token token",
    ],

    // FHIR-specific scopes
    scopes_supported: [
      // Patient access
      "patient/Patient.read",
      "patient/Patient.write",
      "patient/Encounter.read",
      "patient/Observation.read",
      "patient/MedicationRequest.read",
      "patient/Condition.read",
      "patient/Procedure.read",
      "patient/Immunization.read",
      "patient/AllergyIntolerance.read",
      "patient/DocumentReference.read",

      // User (clinician) access
      "user/Patient.read",
      "user/Patient.write",
      "user/Encounter.read",
      "user/Encounter.write",
      "user/Observation.read",
      "user/Observation.write",

      // System access (app-to-app)
      "system/Patient.read",
      "system/Patient.write",
      "system/Encounter.read",
      "system/Encounter.write",
      "system/Observation.read",
      "system/Observation.write",

      // Standard OpenID Connect
      "openid",
      "profile",
      "email",

      // Launch context
      "launch",
      "launch/patient",
      "launch/encounter",

      // Offline access
      "offline_access",

      // Bulk data
      "system/$export",
      "patient/$export",
    ],

    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "private_key_jwt",
    ],
  };
}

// Endpoint
import { Hono } from "hono";

const app = new Hono();

app.get("/.well-known/smart-configuration", async (c) => {
  return c.json(getSMARTConfiguration());
});

app.get("/.well-known/openid-configuration", async (c) => {
  // OpenID Connect Discovery
  const config = getSMARTConfiguration();
  return c.json({
    issuer: config.issuer,
    authorization_endpoint: config.authorization_endpoint,
    token_endpoint: config.token_endpoint,
    userinfo_endpoint: config.userinfo_endpoint,
    revocation_endpoint: config.revocation_endpoint,
    jwks_uri: `${config.issuer}/.well-known/jwks.json`,
    response_types_supported: config.response_types_supported,
    subject_types_supported: ["public"],
    scopes_supported: config.scopes_supported,
    token_endpoint_auth_methods_supported:
      config.token_endpoint_auth_methods_supported,
    claims_supported: [
      "sub",
      "aud",
      "iss",
      "iat",
      "exp",
      "email",
      "email_verified",
      "profile",
      "picture",
      "fhirUser",
      "locale",
    ],
  });
});

export default app;
```

### Scope Enforcement in Handlers

```typescript
// Middleware to enforce OAuth scopes
import { Hono } from "hono";

interface TokenPayload {
  sub: string;
  scope: string;
  aud: string;
}

function requireScope(requiredScopes: string[]) {
  return async (c: any, next: any) => {
    const token = c.get("token") as TokenPayload;

    if (!token) {
      throw new UnauthorizedError("No token provided");
    }

    const grantedScopes = (token.scope || "").split(" ");
    const hasRequiredScope = requiredScopes.some((scope) =>
      grantedScopes.includes(scope)
    );

    if (!hasRequiredScope) {
      throw new ForbiddenError(
        `Missing required scopes: ${requiredScopes.join(", ")}`
      );
    }

    await next();
  };
}

// Usage
app.get(
  "/fhir/Patient/:id",
  requireScope(["patient/Patient.read", "user/Patient.read", "system/Patient.read"]),
  async (c) => {
    const patientId = c.req.param("id");
    const token = c.get("token") as TokenPayload;

    // If patient-scoped, verify patient is requesting own data
    if (token.scope.includes("patient/Patient.read")) {
      if (token.sub !== patientId) {
        throw new ForbiddenError(
          "Patients can only access their own records with patient scope"
        );
      }
    }

    return c.json(await patientRepo.get(patientId));
  }
);
```

---

## 5. Audit Event Logging

```typescript
// services/api-ts/src/handlers/healthcare/support/audit-event.handler.ts
import { logger } from "@/core/logger";

interface AuditEvent {
  id: string;
  recorded: Date;
  outcome: "0" | "4" | "8" | "12"; // 0=success, 4=minor, 8=serious, 12=major
  type: {
    system: string;
    code: string;
    display: string;
  };
  action?: "C" | "R" | "U" | "D" | "E"; // Create, Read, Update, Delete, Execute
  purposeOfUse?: {
    system: string;
    code: string;
    display: string;
  }[];
  agent: {
    type: { text: string };
    who: {
      resourceType: string;
      id: string;
    };
    requestor: boolean;
  }[];
  entity?: {
    what: {
      resourceType: string;
      id: string;
    };
    type: { code: string };
    role?: { code: string };
    description?: string;
  }[];
  source: {
    observer: {
      reference: string;
    };
  };
}

export class AuditEventService {
  constructor(private auditRepo: any, private syslogService?: any) {}

  async logDataAccess(params: {
    patientId: string;
    resourceType: string;
    action: "read" | "create" | "update" | "delete";
    actor: string;
    actorType: "Practitioner" | "Patient" | "Device" | "Organization";
    purpose: "TREAT" | "HPAYMT" | "HOPERAT" | "HRESCH";
    outcome: "success" | "failure";
    details?: any;
  }): Promise<void> {
    const actionMap: Record<string, "R" | "C" | "U" | "D"> = {
      read: "R",
      create: "C",
      update: "U",
      delete: "D",
    };

    const auditEvent: AuditEvent = {
      id: generateUUID(),
      recorded: new Date(),
      outcome: params.outcome === "success" ? "0" : "4",
      type: {
        system: "http://terminology.hl7.org/CodeSystem/audit-event-type",
        code: "rest",
        display: "RESTful Operation",
      },
      action: actionMap[params.action],
      purposeOfUse: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
          code: params.purpose,
          display: this.getPurposeDisplay(params.purpose),
        },
      ],
      agent: [
        {
          type: { text: params.actorType },
          who: {
            resourceType: params.actorType,
            id: params.actor,
          },
          requestor: true,
        },
      ],
      entity: [
        {
          what: {
            resourceType: params.resourceType,
            id: params.patientId,
          },
          type: { code: params.resourceType },
          description: `${params.action} ${params.resourceType}`,
        },
      ],
      source: {
        observer: {
          reference: "Device/api-server-1",
        },
      },
    };

    // Store in database
    await this.auditRepo.create(auditEvent);

    // Send to syslog for ATNA compliance
    if (this.syslogService) {
      const syslogMessage = this.formatAsTNA(auditEvent);
      await this.syslogService.send(syslogMessage);
    }

    logger.info("Audit event recorded", { auditEventId: auditEvent.id });
  }

  async logBreakGlassAccess(params: {
    patientId: string;
    actor: string;
    reason: string;
    authorization?: string;
  }): Promise<void> {
    const emergencyCode = generateEmergencyCode();

    const auditEvent: AuditEvent = {
      id: generateUUID(),
      recorded: new Date(),
      outcome: "0", // Success (access was granted)
      type: {
        system: "http://terminology.hl7.org/CodeSystem/audit-event-type",
        code: "break-glass",
        display: "Break Glass / Emergency Access",
      },
      action: "R",
      purposeOfUse: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
          code: "ETREAT",
          display: "Emergency Treatment",
        },
      ],
      agent: [
        {
          type: { text: "Practitioner" },
          who: {
            resourceType: "Practitioner",
            id: params.actor,
          },
          requestor: true,
        },
      ],
      entity: [
        {
          what: {
            resourceType: "Patient",
            id: params.patientId,
          },
          type: { code: "Patient" },
          description: `Emergency access: ${params.reason}`,
        },
      ],
      source: {
        observer: {
          reference: "Device/api-server-1",
        },
      },
    };

    // Store in separate, more secure audit log
    await this.auditRepo.createBreakGlass(auditEvent, {
      emergencyCode,
      reason: params.reason,
      authorization: params.authorization,
    });

    // Alert security team
    await this.notifySecurityTeam({
      type: "BREAK_GLASS_ACCESS",
      actor: params.actor,
      patient: params.patientId,
      reason: params.reason,
      timestamp: new Date(),
      emergencyCode,
    });

    logger.warn("BREAK GLASS ACCESS", { auditEventId: auditEvent.id, params });
  }

  private getPurposeDisplay(code: string): string {
    const purposes: Record<string, string> = {
      TREAT: "Treatment",
      HPAYMT: "Payment",
      HOPERAT: "Healthcare Operations",
      HRESCH: "Research",
      ETREAT: "Emergency Treatment",
    };
    return purposes[code] || code;
  }

  private formatATNA(event: AuditEvent): string {
    // Format as RFC 3881 Syslog
    const timestamp = event.recorded.toISOString();
    const message = `[${timestamp}] Actor=${event.agent[0].who.id} Action=${event.action} Resource=${event.entity?.[0]?.what.id} Outcome=${event.outcome}`;
    return message;
  }

  private async notifySecurityTeam(alert: any): Promise<void> {
    // Send notification to security team via email/Slack/etc
    logger.error("SECURITY ALERT", alert);
  }
}

// Usage in handler
@get("/fhir/Patient/:id")
async getPatient(@path id: string) {
  const userId = extractUserId();
  const purpose = "TREAT";

  try {
    const patient = await patientRepo.get(id);

    // Log successful access
    await auditEventService.logDataAccess({
      patientId: id,
      resourceType: "Patient",
      action: "read",
      actor: userId,
      actorType: "Practitioner",
      purpose,
      outcome: "success",
    });

    return patient;
  } catch (error) {
    // Log failure
    await auditEventService.logDataAccess({
      patientId: id,
      resourceType: "Patient",
      action: "read",
      actor: userId,
      actorType: "Practitioner",
      purpose,
      outcome: "failure",
      details: { error: error.message },
    });

    throw error;
  }
}
```

---

## 6. IPS (International Patient Summary) Generation

```typescript
// services/api-ts/src/handlers/healthcare/support/ips.handler.ts
import { Hono } from "hono";

interface IPSBundle {
  resourceType: "Bundle";
  type: "document";
  timestamp: string;
  entry: Array<{
    resource: any;
  }>;
}

export class IPSService {
  constructor(
    private patientRepo: any,
    private encounterRepo: any,
    private observationRepo: any,
    private conditionRepo: any,
    private medicationRepo: any,
    private immunizationRepo: any,
    private allergyRepo: any
  ) {}

  async generateIPS(patientId: string): Promise<IPSBundle> {
    // Gather minimum dataset for IPS
    const patient = await this.patientRepo.get(patientId);
    const encounters = await this.encounterRepo.findByPatient(patientId);
    const conditions = await this.conditionRepo.findByPatient(patientId);
    const medications = await this.medicationRepo.findByPatient(patientId);
    const immunizations = await this.immunizationRepo.findByPatient(patientId);
    const allergies = await this.allergyRepo.findByPatient(patientId);
    const vitals = await this.observationRepo.findVitalSigns(patientId);

    // Create IPS Composition
    const ipsComposition = {
      resourceType: "Composition",
      id: generateUUID(),
      status: "final",
      type: {
        coding: [
          {
            system: "http://loinc.org",
            code: "60591-5",
            display: "International Patient Summary",
          },
        ],
      },
      subject: { reference: `Patient/${patientId}` },
      date: new Date().toISOString(),
      author: [{ reference: "Organization/monobase" }],
      title: "International Patient Summary",
      section: [
        // Allergies & Intolerances
        {
          code: {
            coding: [{ system: "http://loinc.org", code: "48765-2" }],
            text: "Allergies and Intolerances",
          },
          entry: allergies.map((a) => ({ reference: `AllergyIntolerance/${a.id}` })),
        },
        // Active Problems
        {
          code: {
            coding: [{ system: "http://loinc.org", code: "11450-4" }],
            text: "Problem List",
          },
          entry: conditions.map((c) => ({ reference: `Condition/${c.id}` })),
        },
        // Medications
        {
          code: {
            coding: [{ system: "http://loinc.org", code: "10160-0" }],
            text: "Medication Use",
          },
          entry: medications.map((m) => ({
            reference: `MedicationRequest/${m.id}`,
          })),
        },
        // Immunizations
        {
          code: {
            coding: [{ system: "http://loinc.org", code: "11369-6" }],
            text: "Immunizations",
          },
          entry: immunizations.map((i) => ({
            reference: `Immunization/${i.id}`,
          })),
        },
        // Vital Signs
        {
          code: {
            coding: [{ system: "http://loinc.org", code: "8716-3" }],
            text: "Vital Signs",
          },
          entry: vitals.map((v) => ({ reference: `Observation/${v.id}` })),
        },
      ],
    };

    // Wrap in Bundle
    const bundle: IPSBundle = {
      resourceType: "Bundle",
      type: "document",
      timestamp: new Date().toISOString(),
      entry: [
        { resource: ipsComposition },
        { resource: patient },
        ...allergies.map((a) => ({ resource: a })),
        ...conditions.map((c) => ({ resource: c })),
        ...medications.map((m) => ({ resource: m })),
        ...immunizations.map((i) => ({ resource: i })),
        ...vitals.map((v) => ({ resource: v })),
      ],
    };

    return bundle;
  }
}

const app = new Hono();

app.get("/fhir/Patient/:patientId/$IPS", async (c) => {
  const patientId = c.req.param("patientId");

  try {
    const ips = await ipsService.generateIPS(patientId);
    return c.json(ips);
  } catch (error: any) {
    return c.json(
      {
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "processing",
            diagnostics: error.message,
          },
        ],
      },
      500
    );
  }
});

export default app;
```

---

## 7. TypeSpec Profile Definition (FHIR Shorthand Alternative)

```typespec
// specs/api/src/healthcare/clinical/condition-profile.tsp
import "@typespec/http";
import "../core/primitives.tsp";

using TypeSpec.Http;

namespace Healthcare.Clinical.Profiles;

@doc("Monobase Condition Profile - Constraints on FHIR Condition resource")
model MonobaseCondition extends HealthcareBaseEntity {
  @doc("active | recurrence | relapse | remission | resolved | unknown")
  clinicalStatus: string;

  @doc("unconfirmed | provisional | differential | confirmed | refuted | entered-in-error")
  verificationStatus: string;

  @doc("problem-list-item | encounter-diagnosis")
  category: CodeableConcept[];

  @doc("Identification of the condition (ICD-10, SNOMED CT, etc)")
  code: CodeableConcept;

  @doc("The patient who has the condition")
  subject: Reference;

  @doc("Encounter when condition was first asserted")
  encounter?: Reference;

  @doc("Estimated or actual date, date-time, or age when condition started")
  onsetDateTime?: utcDateTime;

  @doc("Estimated or actual date, date-time, or age when condition started")
  onsetAge?: {
    value: integer;
    unit: string;
  };

  @doc("The date or estimated date that the condition resolved or went into remission")
  abatementDateTime?: utcDateTime;

  @doc("Individual who asserted the condition")
  recorder?: Reference;

  @doc("Person who asserts this condition")
  asserter?: Reference;

  @doc("Stage/grade, usually assessed formally")
  stage?: {
    summary?: CodeableConcept;
    assessment?: Reference[];
  }[];

  @doc("Additional information about the Condition")
  note?: Annotation[];
}
```

---

This comprehensive guide should give you solid implementation patterns for standards compliance. Adjust based on your specific technology stack and requirements!

