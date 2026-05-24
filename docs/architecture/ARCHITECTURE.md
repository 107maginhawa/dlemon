# Architecture

Core design patterns and cross-cutting decisions for Monobase.

## Key Architectural Patterns

### Person-Centric Design
The Person module is the central PII safeguard for user data.

### Consent Management
Consent is embedded in the Person model as JSONB fields rather than a standalone module:
```typescript
{
  granted: boolean,
  granted_at: timestamp,
  ip_address: string,
  updated_at: timestamp,
  updated_by: string
}
```

Consent types on Person:
- **marketing_consent**: Marketing communications
- **data_sharing_consent**: Data sharing preferences
- **sms_consent**: SMS notifications
- **email_consent**: Email communications

### API-First Development
Always follow this workflow:
1. Define APIs in TypeSpec (`specs/api/src/modules/`)
2. Generate OpenAPI + TypeScript types (`cd specs/api && bun run build`)
3. Generate routes/validators/handlers (`cd services/api-ts && bun run generate`)
4. Implement handler business logic (`services/api-ts/src/handlers/`)
5. Use generated types from `@monobase/api-spec` in frontends

**Why**: Type safety across frontend/backend, single source of truth, auto-generated docs

**⚠️ CRITICAL - Never Edit Generated Files**:
- `services/api-ts/src/generated/openapi/*` - Routes, validators, registry (regenerated every time)
- `services/api-ts/src/generated/better-auth/*` - Auth schema and specs
- `services/api-ts/src/generated/migrations/*` - Database migrations

**✅ Only Edit**:
- TypeSpec files (`specs/api/src/modules/*.tsp`)
- Handler implementations (`services/api-ts/src/handlers/{module}/*.ts`)
- Database schemas (`services/api-ts/src/handlers/{module}/repos/*.schema.ts`)

See [CONTRIBUTING.md](../../CONTRIBUTING.md#code-generation---do-not-edit) for complete details.

### Configuration Approach
Environment variables are parsed into typed configuration objects (see `services/api-ts/src/core/config.ts`). Not file-based configuration.

### OneSignal Multi-App Architecture
OneSignal follows an **app-agnostic pattern** like other services (Storage, Email, Billing):

**Single App ID Approach**:
- Use the **same** `ONESIGNAL_APP_ID` across all frontends
- Frontend apps: Set `VITE_ONESIGNAL_APP_ID` to the same value
- Backend API: Uses same app ID to send notifications

**Optional App Tagging**:
- Set `VITE_ONESIGNAL_APP_TAG=web` (or `mobile`, etc.) in frontend `.env` (optional)
- Apps auto-tag themselves on initialization
- Most notifications ignore tags (app-agnostic)
- Use `targetApp` parameter only for app-specific announcements

**Why This Works**:
- OneSignal uses `external_id` (person ID) to target users across devices/apps
- Users with multiple roles receive notifications in whichever app they're using

**API Pattern**:
```typescript
// Send to user (app-agnostic - default)
notificationRepo.createNotificationForModule({
  recipient: personId,
  type: 'booking.confirmed',
  channel: 'push',
  // No targetApp - reaches user in any app
});

// Send only to a specific app (rare)
notificationRepo.createNotificationForModule({
  recipient: personId,
  type: 'system',
  channel: 'push',
  targetApp: 'web', // Only if VITE_ONESIGNAL_APP_TAG is configured
});
```

### Module Structure Pattern
Backend handlers follow: **Router → Validators → Handlers → Repositories**

Each handler directory contains:
- Handler files (CRUD operations)
- `repos/` - Database repositories + schema
- `jobs/` - Background job definitions
- `utils/` - Module-specific utilities

## Compliance Considerations

When working with regulated data:

### Data Privacy
- **Audit Trails**: All user data access is logged with Pino
- **Consent Validation**: Check JSONB consent fields before processing
- **Role-Based Access**: Verify user roles via Better-Auth
- **Correlation IDs**: Include in all log entries for traceability

### Data Security
- Use Drizzle ORM for type-safe, SQL-injection-proof queries
- Validate all inputs with Zod schemas
- Never log sensitive personal information (PII) in plain text
- Follow secure patterns in existing handlers
