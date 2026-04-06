# Email Module

## Overview

The Email module provides a template-based email service with queue management for asynchronous delivery. Templates are stored in the database with variable definitions that follow a simple field-based pattern similar to form fields.

## Key Features

- **Template Management**: Create and manage email templates with Handlebars syntax
- **Variable Definitions**: Simple array-based variable configuration with types and validation
- **Tag-Based Organization**: Templates can have multiple tags for categorization
- **Async Queue Processing**: Emails are queued and processed by background jobs
- **Multi-Provider Support**: SMTP for development, Postmark for production
- **Retry Logic**: Automatic retry for failed emails with exponential backoff
- **Admin Control**: Full visibility and control over email queue

## Architecture

### Components

1. **Email Templates**
   - Stored in database with unique IDs
   - Support Handlebars templating syntax
   - Optional variable definitions with types and validation
   - Can have multiple tags for organization

2. **Email Queue**
   - Asynchronous processing with priority levels
   - Scheduled send support
   - Retry mechanism for failures
   - Full audit trail

3. **Email Service**
   - Template loading and caching
   - Variable validation
   - Provider abstraction (SMTP/Postmark)

4. **Job Processor**
   - Processes pending emails every 30 seconds
   - Handles retries and failures
   - Updates queue status

## Template System

### Template Structure

Each template contains:
- `id`: Unique identifier (UUID)
- `tags`: Optional array of strings for categorization
- `name`: Human-readable name
- `subject`: Subject line with Handlebars variables
- `bodyHtml`: HTML content with Handlebars templating
- `bodyText`: Optional plain text version
- `variables`: Optional array of variable definitions
- `status`: draft | active | archived

### Variable Definitions

Templates can define variables using a simple array structure:

```typescript
variables: [
  {
    id: "patientName",           // Variable name in template
    type: "string",               // Data type
    label: "Patient Name",        // Human-readable label
    required: true,               // Whether required
    minLength: 1,                 // Validation rules
    maxLength: 100
  },
  {
    id: "appointmentDate",
    type: "date",
    label: "Appointment Date",
    required: true
  },
  {
    id: "consultationMode",
    type: "string",
    label: "Consultation Mode",
    options: ["video", "phone", "in-person"]  // Enum values
  }
]
```

### Variable Types

Supported variable types:
- `string`: Text values
- `number`: Numeric values
- `boolean`: True/false values
- `date`: Date values (YYYY-MM-DD)
- `datetime`: Date and time values
- `url`: URL/link values
- `email`: Email address values
- `array`: Array of primitive values

### Template Example

```handlebars
Subject: Appointment Confirmation - {{providerName}}

Dear {{patientName}},

Your appointment is confirmed for:
Date: {{appointmentDate}}
Time: {{appointmentTime}}
Provider: {{providerName}}
Mode: {{consultationMode}}

{{#if notes}}
Additional Notes: {{notes}}
{{/if}}

Thank you for choosing our service.
```

## API Usage

### Creating a Template

```typescript
POST /templates
{
  "name": "Booking Confirmation",
  "tags": ["booking", "confirmation"],
  "subject": "Appointment Confirmed - {{providerName}}",
  "bodyHtml": "<html>...</html>",
  "bodyText": "Plain text version...",
  "variables": [
    {
      "id": "patientName",
      "type": "string",
      "label": "Patient Name",
      "required": true
    },
    {
      "id": "providerName",
      "type": "string",
      "label": "Provider Name",
      "required": true
    },
    {
      "id": "appointmentDate",
      "type": "date",
      "required": true
    }
  ],
  "status": "active"
}

// Response 201 Created (ApiCreatedResponse<EmailTemplate>)
```

### Getting a Template

```typescript
GET /templates/{template}

// Response 200 OK (ApiOkResponse<EmailTemplate>)
```

### Updating a Template

```typescript
PATCH /templates/{template}
{
  "status": "archived",
  "variables": [
    // Updated variable definitions
  ]
}

// Response 200 OK (ApiOkResponse<EmailTemplate>)
```

### Testing a Template (Queues Email)

```typescript
POST /templates/{template}/test
{
  "recipientEmail": "test@example.com",
  "recipientName": "Test User",
  "variables": {
    "patientName": "Test Patient",
    "providerName": "Test Provider",
    "appointmentDate": "2024-02-15"
  }
}

// Response 200 OK (ApiOkResponse<TestTemplateResult>):
{
  "queue": "uuid-of-created-queue-item"
}
```

The test endpoint creates a real email queue item that will be sent through the normal email processing pipeline. You can track the test email status using the returned queue ID.

## Queue Management

### Queue Status

Emails in the queue can have the following statuses:
- `pending`: Waiting to be processed
- `processing`: Currently being sent
- `sent`: Successfully delivered
- `failed`: Delivery failed (will retry)
- `cancelled`: Manually cancelled

### Retry Logic

Failed emails are automatically retried with exponential backoff:
- 1st retry: 5 minutes
- 2nd retry: 15 minutes
- 3rd retry: 1 hour
- 4th retry: 4 hours
- 5th retry: 12 hours

### Priority Levels

Emails can be assigned priority levels (1-10):
- 1-3: High priority (processed first)
- 4-6: Normal priority
- 7-10: Low priority

## Admin Operations

### List Templates

```typescript
GET /templates?status=active&tags=booking

// Response 200 OK (ApiOkResponse<PaginatedResponse<EmailTemplate>>)
```

### View Queue

```typescript
GET /queue?status=pending&priority=1

// Response 200 OK (ApiOkResponse<PaginatedResponse<EmailQueueItem>>)
```

### Get Queue Item

```typescript
GET /queue/{queue}

// Response 200 OK (ApiOkResponse<EmailQueueItem>)
```

### Retry Failed Email

```typescript
POST /queue/{queue}/retry

// Response 200 OK (ApiOkResponse<EmailQueueItem>)
```

### Cancel Pending Email

```typescript
POST /queue/{queue}/cancel
{
  "reason": "Duplicate email sent"
}

// Response 200 OK (ApiOkResponse<EmailQueueItem>)
```

## Service Integration

**Note**: There is no direct "send" API endpoint. Emails are queued either:
1. Via the test endpoint (for testing templates)
2. Programmatically through the email service in backend code
3. Through other modules that trigger email events

Services can queue emails programmatically using either direct template ID or template tags:

### Programmatic Email Queueing

```typescript
// Backend service code (not an API endpoint)
await emailService.queueEmail({
  template: "550e8400-e29b-41d4-a716-446655440000",
  recipientEmail: user.email,
  recipientName: user.name,
  variables: {
    userName: user.name,
    resetLink: `https://example.com/reset/${token}`,
    expiryTime: "24 hours"
  },
});
```

### Using Template Tags

```typescript
// Queue with template tags for dynamic resolution
await emailService.queueEmail({
  templateTags: ["auth", "password-reset"],
  recipientEmail: user.email,
  recipientName: user.name,
  variables: {
    userName: user.name,
    resetLink: `https://example.com/reset/${token}`,
    expiryTime: "24 hours"
  },
});
```

### Metadata Storage

When emails are processed, the metadata field stores:
- `resolvedTemplateId`: The template ID that was used
- `resolvedTemplateName`: The template name for reference
- `renderedSubject`: The actual subject sent
- `renderedHtml`: The actual HTML content sent
- `renderedText`: The actual text content sent
- `templateVersion`: The version of template used
- Any custom metadata provided when queueing

## Provider Configuration

### SMTP (Development)

```json
{
  "provider": "smtp",
  "host": "localhost",
  "port": 1025,
  "secure": false
}
```

### Postmark (Production)

```json
{
  "provider": "postmark",
  "serverToken": "xxxx-xxxx-xxxx",
  "fromEmail": "noreply@example.com",
  "fromName": "Example Service"
}
```

## Best Practices

1. **Template Design**
   - Keep templates simple and focused
   - Use meaningful variable names
   - Provide both HTML and text versions
   - Test templates before activating

2. **Variable Management**
   - Define all variables used in templates
   - Set appropriate validation rules
   - Use default values where appropriate
   - Document variable purposes

3. **Queue Management**
   - Set appropriate priority levels
   - Monitor failed emails regularly
   - Clean up old queue items periodically
   - Use scheduling for batch sends

4. **Error Handling**
   - Check for missing required variables
   - Handle template not found errors
   - Monitor provider failures
   - Set up alerts for critical emails
