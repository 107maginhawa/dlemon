import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/**
 * Email Module - Template-based email service with queue management
 * 
 * Provides email template management and asynchronous email delivery
 * with support for variables, scheduling, and retry logic.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Template lifecycle status
 */
@doc("Template lifecycle status")
enum TemplateStatus {
  @doc("Template is being edited")
  draft: "draft",
  
  @doc("Template is active and can be used")
  active: "active",
  
  @doc("Template is archived and cannot be used")
  archived: "archived",
}

/**
 * Email processing status in queue
 */
@doc("Email processing status in queue")
enum EmailQueueStatus {
  @doc("Email is waiting to be processed")
  pending: "pending",
  
  @doc("Email is currently being processed")
  processing: "processing",
  
  @doc("Email was successfully sent")
  sent: "sent",
  
  @doc("Email delivery failed")
  failed: "failed",
  
  @doc("Email was cancelled by admin")
  cancelled: "cancelled",
}

/**
 * Supported email service providers
 */
@doc("Supported email service providers")
enum EmailProvider {
  @doc("SMTP protocol (development/self-hosted)")
  smtp: "smtp",
  
  @doc("Postmark service (production)")
  postmark: "postmark",
}

/**
 * Variable data types for templates
 */
@doc("Variable data types for email templates")
enum VariableType {
  @doc("Text string value")
  string: "string",
  
  @doc("Numeric value")
  number: "number",
  
  @doc("Boolean true/false value")
  boolean: "boolean",
  
  @doc("Date value (YYYY-MM-DD)")
  date: "date",
  
  @doc("Date and time value")
  datetime: "datetime",
  
  @doc("URL/link value")
  url: "url",
  
  @doc("Email address value")
  email: "email",
  
  @doc("Array of values")
  array: "array",
}

// ============================================================================
// MODELS
// ============================================================================

/**
 * Template variable definition
 */
@doc("Variable definition for email templates")
model TemplateVariable {
  @doc("Variable name used in template (e.g., 'patientName')")
  @maxLength(100)
  id: string;
  
  @doc("Variable data type")
  type: VariableType;
  
  @doc("Human-readable label for the variable")
  @maxLength(255)
  label?: string;
  
  @doc("Whether this variable is required")
  required?: boolean;
  
  @doc("Default value if not provided")
  defaultValue?: string;
  
  @doc("Minimum length for string values")
  @minValue(0)
  minLength?: int32;
  
  @doc("Maximum length for string values")
  @maxValue(10000)
  maxLength?: int32;
  
  @doc("Minimum value for numeric types")
  min?: float64;
  
  @doc("Maximum value for numeric types")
  max?: float64;
  
  @doc("Regex pattern for validation")
  @maxLength(500)
  pattern?: string;
  
  @doc("Allowed values for enum/select types")
  options?: string[];
}

/**
 * Email template model
 */
@doc("Email template with variable support")
model EmailTemplate extends BaseEntity {
  @doc("Optional tags for categorization and search")
  tags?: string[];
  
  @doc("Human-readable template name")
  @maxLength(255)
  name: string;
  
  @doc("Template description for admin reference")
  @maxLength(500)
  description?: string;
  
  @doc("Email subject line template (supports Handlebars)")
  @maxLength(500)
  subject: string;
  
  @doc("HTML body template (supports Handlebars)")
  bodyHtml: string;
  
  @doc("Plain text body template (supports Handlebars)")
  bodyText?: string;
  
  @doc("Variable definitions for this template")
  variables?: TemplateVariable[];
  
  @doc("Override default sender name")
  @maxLength(255)
  fromName?: string;
  
  @doc("Override default sender email")
  fromEmail?: Email;
  
  @doc("Reply-to email address")
  replyToEmail?: Email;
  
  @doc("Reply-to name")
  @maxLength(255)
  replyToName?: string;
  
  @doc("Template status")
  status: TemplateStatus;
  
  @doc("Template version number")
  @minValue(1)
  version: int32 = 1;
}


/**
 * Email queue item model
 */
@doc("Queued email for asynchronous processing")
model EmailQueueItem extends BaseEntity {
  @doc("Direct template ID reference (use either template or templateTags)")
  template?: UUID;

  @doc("Template tags for dynamic resolution (use either template or templateTags)")
  templateTags?: string[];

  @doc("Recipient email address")
  recipientEmail: Email;

  @doc("Recipient name for personalization")
  @maxLength(255)
  recipientName?: string;

  @doc("Template variables for rendering")
  variables?: Record<unknown>;

  @doc("Metadata for tracking, reference, and rendered content (stores resolvedTemplateId, renderedSubject, renderedHtml, renderedText, templateVersion)")
  metadata?: Record<unknown>;
  
  @doc("Processing status")
  status: EmailQueueStatus;
  
  @doc("Processing priority (1-10, lower is higher priority)")
  @minValue(1)
  @maxValue(10)
  priority: int32 = 5;
  
  @doc("Scheduled send time (null for immediate)")
  scheduledAt?: utcDateTime;
  
  @doc("Number of send attempts")
  @minValue(0)
  attempts: int32 = 0;
  
  @doc("Last attempt timestamp")
  lastAttemptAt?: utcDateTime;
  
  @doc("Next retry timestamp")
  nextRetryAt?: utcDateTime;
  
  @doc("Last error message if failed")
  lastError?: string;
  
  @doc("Timestamp when email was sent")
  sentAt?: utcDateTime;
  
  @doc("Email provider used")
  provider?: EmailProvider;
  
  @doc("Provider's message ID for tracking")
  @maxLength(255)
  providerMessageId?: string;
  
  @doc("Cancellation timestamp")
  cancelledAt?: utcDateTime;
  
  @doc("User who cancelled the email")
  cancelledBy?: UUID;
  
  @doc("Cancellation reason")
  @maxLength(500)
  cancellationReason?: string;
}

// ============================================================================
// REQUEST/RESPONSE MODELS
// ============================================================================

/**
 * Template create request
 */
@doc("Request to create a new email template")
model CreateTemplateRequest {
  @doc("Optional tags for categorization")
  tags?: string[];
  
  @doc("Human-readable template name")
  @maxLength(255)
  name: string;
  
  @doc("Template description")
  @maxLength(500)
  description?: string;
  
  @doc("Email subject line template")
  @maxLength(500)
  subject: string;
  
  @doc("HTML body template")
  bodyHtml: string;
  
  @doc("Plain text body template")
  bodyText?: string;
  
  @doc("Variable definitions")
  variables?: TemplateVariable[];
  
  @doc("Override sender name")
  fromName?: string;
  
  @doc("Override sender email")
  fromEmail?: Email;
  
  @doc("Reply-to email address")
  replyToEmail?: Email;
  
  @doc("Reply-to name")
  replyToName?: string;
  
  @doc("Initial status")
  status?: TemplateStatus = TemplateStatus.draft;
}

/**
 * Template update request
 */
@doc("Request to update an email template")
model UpdateTemplateRequest {
  @doc("Template tags")
  tags?: string[];
  
  @doc("Template name")
  @maxLength(255)
  name?: string;
  
  @doc("Template description")
  @maxLength(500)
  description?: string;
  
  @doc("Email subject template")
  @maxLength(500)
  subject?: string;
  
  @doc("HTML body template")
  bodyHtml?: string;
  
  @doc("Plain text body template")
  bodyText?: string;
  
  @doc("Variable definitions")
  variables?: TemplateVariable[];
  
  @doc("Sender name")
  fromName?: string;
  
  @doc("Sender email")
  fromEmail?: Email;
  
  @doc("Reply-to email address")
  replyToEmail?: Email;
  
  @doc("Reply-to name")
  replyToName?: string;
  
  @doc("Template status")
  status?: TemplateStatus;
}

/**
 * Template test request
 */
@doc("Request to test an email template")
model TestTemplateRequest {
  @doc("Test recipient email address")
  recipientEmail: Email;

  @doc("Test recipient name for personalization")
  @maxLength(255)
  recipientName?: string;

  @doc("Variables to use for testing")
  variables?: Record<unknown>;
}

/**
 * Template test result
 */
@doc("Result of template test")
model TestTemplateResult {
  @doc("The created email queue item with full details")
  queue: EmailQueueItem;
}

/**
 * Email cancel request
 */
@doc("Request to cancel a pending email")
model CancelEmailRequest {
  @doc("Reason for cancellation")
  @maxLength(500)
  reason: string;
}


// ============================================================================
// API INTERFACES
// ============================================================================

/**
 * Email module namespace
 */
@tag("Email")
namespace EmailModule {
  
  /**
   * Email template management interface (admin only)
   */
  interface EmailTemplateManagement {
    @doc("List email templates with filtering and pagination")
    @operationId("listEmailTemplates")
    @get
    @route("/templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    listEmailTemplates(
      @doc("Filter by template status (draft, active, archived)")
      @query status?: TemplateStatus,
      @doc("Filter by template tags (e.g., ['appointment', 'billing'])")
      @query tags?: string[],
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<EmailTemplate>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
    
    @doc("Get email template by ID")
    @operationId("getEmailTemplate")
    @get
    @route("/templates/{template}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    getEmailTemplate(
      @path template: UUID
    ): ApiOkResponse<EmailTemplate>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
    
    @doc("Create new email template")
    @operationId("createEmailTemplate")
    @post
    @route("/templates")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    createEmailTemplate(
      @body request: CreateTemplateRequest
    ): ApiCreatedResponse<EmailTemplate>
      | ApiConflictResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
    
    @doc("Update email template")
    @operationId("updateEmailTemplate")
    @patch(#{implicitOptionality: true})
    @route("/templates/{template}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    updateEmailTemplate(
      @path template: UUID,
      @body request: UpdateTemplateRequest
    ): ApiOkResponse<EmailTemplate>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
    
    @doc("Test email template with sample data")
    @operationId("testEmailTemplate")
    @post
    @route("/templates/{template}/test")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    testEmailTemplate(
      @path template: UUID,
      @body request: TestTemplateRequest
    ): ApiOkResponse<TestTemplateResult>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
  
  /**
   * Email queue management interface (admin only)
   */
  interface EmailQueueManagement {
    @doc("List email queue with filtering and pagination")
    @operationId("listEmailQueueItems")
    @get
    @route("/queue")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    listEmailQueueItems(
      @doc("Filter by queue status (pending, processing, sent, failed, cancelled). Supports comma-separated values (e.g., 'pending,processing')")
      @query status?: EmailQueueStatus | EmailQueueStatus[],
      @doc("Filter by recipient email address")
      @query recipientEmail?: Email,
      @doc("Start date for filtering queue items (inclusive)")
      @query dateFrom?: utcDateTime,
      @doc("End date for filtering queue items (inclusive)")
      @query dateTo?: utcDateTime,
      @doc("Filter by priority level (1-10, lower is higher priority)")
      @query priority?: int32,
      @doc("Filter to show only scheduled emails")
      @query scheduledOnly?: boolean,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<EmailQueueItem>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
    
    @doc("Get email queue item by ID")
    @operationId("getEmailQueueItem")
    @get
    @route("/queue/{queue}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    getEmailQueueItem(
      @path queue: UUID
    ): ApiOkResponse<EmailQueueItem>
      | ApiNotFoundResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
    
    @doc("Retry failed email")
    @operationId("retryEmailQueueItem")
    @post
    @route("/queue/{queue}/retry")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    retryEmailQueueItem(
      @path queue: UUID
    ): ApiOkResponse<EmailQueueItem>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
    
    @doc("Cancel pending email")
    @operationId("cancelEmailQueueItem")
    @post
    @route("/queue/{queue}/cancel")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin"])
    cancelEmailQueueItem(
      @path queue: UUID,
      @body request: CancelEmailRequest
    ): ApiOkResponse<EmailQueueItem>
      | ApiNotFoundResponse
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}

