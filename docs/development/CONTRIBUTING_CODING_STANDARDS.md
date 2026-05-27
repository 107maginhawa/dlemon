# Coding Standards & Module Structure Patterns

This document covers TypeScript, React, API, and database coding standards, plus the backend module structure pattern.

## Coding Standards

### TypeScript

- Use TypeScript 5.9+ features
- Enable strict mode
- Prefer `interface` over `type` for object shapes
- Use `const` assertions where appropriate
- Avoid `any` - use `unknown` or proper types

**Good**:
```typescript
interface PersonData {
  firstName: string;
  lastName: string;
  email: string;
}

function processPerson(data: PersonData): void {
  // Implementation
}
```

**Avoid**:
```typescript
function processPerson(data: any) {
  // No type safety
}
```

### React Components

- Use functional components with hooks
- Prefer named exports for components
- Use TypeScript for prop types
- Extract complex logic into custom hooks
- Keep components focused and small

```typescript
// Good component structure
interface PersonCardProps {
  person: Person;
  onSelect: (id: string) => void;
}

export function PersonCard({ person, onSelect }: PersonCardProps) {
  return (
    <div onClick={() => onSelect(person.id)}>
      <h3>{person.firstName} {person.lastName}</h3>
    </div>
  );
}
```

### API Handlers

- Use Zod for request validation
- Return consistent error responses
- Include audit logging for sensitive operations
- Handle errors gracefully
- Use middleware for cross-cutting concerns

```typescript
// Good handler pattern
personRouter.post('/', authMiddleware, async (c) => {
  try {
    // Validate request
    const schema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().email(),
    });
    const body = schema.parse(await c.req.json());

    // Audit log
    logger.info({ user_id: c.get('user').id, action: 'create_person' });

    // Implementation
    const person = await createPerson(body);

    return c.json(person, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    logger.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
```

### Database Queries

- Use Drizzle ORM for type-safe queries
- Avoid raw SQL unless necessary
- Use transactions for multi-step operations
- Index frequently queried fields
- Include proper error handling

```typescript
// Good database pattern
import { db } from '../db';
import { persons } from '../db/schema';
import { eq } from 'drizzle-orm';

async function getPersonByEmail(email: string) {
  return await db
    .select()
    .from(persons)
    .where(eq(persons.email, email))
    .limit(1);
}
```

### Logging

The Monobase platform uses different logging approaches for backend and frontend applications.

#### Backend Logging (API Services)

**Technology**: [Pino](https://getpino.io/) for structured, high-performance logging

**Location**: `/services/api-ts/src/core/logger.ts`

**Usage**:
```typescript
import { logger } from '@/core/logger'

// Log levels
logger.debug('Detailed diagnostic information')
logger.info('General informational message')
logger.warn('Warning condition')
logger.error('Error condition', { error })
logger.fatal('Critical system failure')

// Structured logging with context
logger.info('User action', {
  correlationId: req.correlationId,
  userId: user.id,
  action: 'profile_update',
  module: 'person'
})
```

**Best Practices**:

✅ **DO:**
- Include correlation IDs for request tracing
- Use appropriate log levels
- Add structured context (objects, not strings)
- Log errors with full error objects
- Sanitize PII before logging (e.g. phone numbers, emails, free-text)

❌ **DON'T:**
- Use console.* methods in backend code
- Log sensitive personal information (PII)
- Log passwords, tokens, or credentials
- Use string concatenation for structured data

**Enterprise Compliance**:

The API handles Personally Identifiable Information (PII) and sensitive business data. Follow these rules:

1. **Never log PII directly** - Use sanitization functions
2. **Include correlation IDs** - Required for audit trails
3. **Log access events** - WHO accessed WHAT and WHEN
4. **Use appropriate levels** - Errors must be captured for compliance

```typescript
// ❌ WRONG - Logs PII
logger.info('Person record accessed', { person })

// ✅ CORRECT - Logs event without PII
logger.info('Person record accessed', {
  correlationId: req.correlationId,
  userId: user.id,
  personId: person.id,  // ID only, not full record
  action: 'read',
  resource: 'person_record'
})
```

#### Frontend Logging (Account App)

**Technology**: Native console methods with automatic production stripping

**Configuration**:

*Vite Apps (Account)*:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    esbuild: {
      // Automatically removes console.log in production
      // Keeps console.error and console.warn for debugging
      drop: ['console.log'],
    },
  },
})
```


**Usage**:
```typescript
// Development debugging - auto-removed in production
console.log('User navigated to dashboard')

// Error logging - KEPT in production for debugging
console.error('Failed to load user data', error)

// Warnings - KEPT in production
console.warn('API response time exceeded threshold')

// Info - KEPT in production
console.info('Feature flag enabled:', featureName)
```

**Best Practices**:

✅ **DO:**
- Use `console.log` freely during development
- Use `console.error` for errors (kept in production)
- Use `console.warn` for warnings (kept in production)
- Log user-friendly messages
- Avoid logging full API responses

❌ **DON'T:**
- Log sensitive user data (PHI, credentials, tokens)
- Log full API responses that might contain PHI
- Manually remove console statements from code
- Use console methods for production analytics

**Data Privacy Considerations**:

Even though frontend logs are stripped in production, follow these rules during development:

```typescript
// ❌ WRONG - Logs full person data
console.log('Profile updated:', personData)

// ✅ CORRECT - Logs confirmation without PII
console.log('Profile updated successfully')

// ❌ WRONG - Logs API response with PII
console.log('Video call joined:', response)

// ✅ CORRECT - Logs event without sensitive data
console.log('Video call joined successfully')
```

#### Production Monitoring

**Backend**:
- Pino logs to stdout/files
- Can integrate with log aggregation services (Datadog, LogRocket)
- Logs are structured JSON, easily searchable
- Set up alerts on error/fatal log levels

**Frontend**:
- Console logs stripped in production builds
- Consider error tracking services (Sentry, LogRocket)
- Use proper analytics tools for user monitoring

**Recommended Tools**:
- [Sentry](https://sentry.io/) - Error tracking and performance monitoring
- [LogRocket](https://logrocket.com/) - Session replay and error tracking
- [Datadog RUM](https://www.datadoghq.com/product/real-user-monitoring/) - Real user monitoring

#### Migration Path

**Backend (API)**:
- Replace all `console.*` with `logger.*` methods
- Add correlation IDs and structured context
- Ensure PHI sanitization

**Frontend (Account)**:
- Keep existing `console.*` statements
- Build configuration handles production stripping
- Review logs that might expose PHI

### Naming Conventions

#### General Rules

- **Files**: `kebab-case.ts` (e.g., `client-card.tsx`)
- **Components**: `PascalCase` (e.g., `ClientCard`)
- **Functions**: `camelCase` (e.g., `createClient`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
- **Types/Interfaces**: `PascalCase` (e.g., `ClientData`)
- **Database Tables**: `snake_case` (e.g., `client_records`)

#### Component File Naming (Critical)

**⚠️ All component files MUST use kebab-case naming.**

This is a strict requirement across all apps. Inconsistent file naming causes confusion and maintenance issues.

**Correct** ✅:
```
src/components/booking/booking-flow-layout.tsx
src/components/services/service-card.tsx
src/components/documents/document-list.tsx
src/components/metrics/metrics-display.tsx
```

**Incorrect** ❌:
```
src/components/booking/BookingFlowLayout.tsx        // PascalCase - wrong
src/components/services/ServiceCard.tsx            // PascalCase - wrong
src/components/documents/DocumentList.tsx          // PascalCase - wrong
```

**Component Names vs. File Names**:
- **File name**: `service-card.tsx` (kebab-case)
- **Component name**: `ServiceCard` (PascalCase)
- **Export**: `export function ServiceCard() { ... }`
- **Import**: `import { ServiceCard } from './service-card'`

**Test Files** (see [Test File Organization](./CONTRIBUTING_TESTING.md)):
- Unit tests: Match source file name with `.test.ts` suffix
  - `service-card.tsx` → `service-card.test.tsx`
- E2E tests: Use `.spec.ts` suffix in `tests/e2e/`
  - `booking.spec.ts`, `services.spec.ts`

**Rationale**:
- **Consistency**: Matches modern JavaScript/TypeScript conventions (React, Next.js, Remix)
- **Cross-platform**: Avoids case-sensitivity issues across operating systems
- **Git safety**: Prevents issues with case-insensitive filesystems (macOS, Windows)
- **Predictability**: Alphabetical sorting is consistent and easy to navigate
- **Industry standard**: Aligns with community best practices

### Date and Time Handling

**All date/time operations MUST follow the two-utility pattern for consistency across the codebase.**

#### The Two-Utility Pattern

1. **Formatting** → Use `@/lib/format-date`
2. **Manipulation/Logic** → Use `date-fns` directly

#### Formatting Dates

Always use the centralized `formatDate()` and `formatRelativeDate()` utilities:

```typescript
import { formatDate, formatRelativeDate } from '@/lib/format-date'

// Date formatting
formatDate(new Date(), { format: 'short' })      // "10/5/23"
formatDate(new Date(), { format: 'medium' })     // "Oct 5, 2023"
formatDate(new Date(), { format: 'long' })       // "October 5, 2023"
formatDate(new Date(), { format: 'full' })       // "Thursday, October 5, 2023"
formatDate(new Date(), { format: 'time' })       // "3:30 PM"
formatDate(new Date(), { format: 'datetime' })   // "Oct 5, 2023, 3:30 PM"
formatDate(new Date(), { format: 'iso' })        // "2023-10-05T15:30:00.000Z"

// Relative time formatting
formatRelativeDate(pastDate)                      // "3 hours ago"
formatRelativeDate(futureDate)                    // "in 2 days"
formatRelativeDate(date, { style: 'short' })      // "3h ago"
```

**React Components**:
```typescript
import { useFormatDate } from '@/hooks/use-format-date'

function MyComponent({ date }: { date: Date }) {
  const { formatDate, formatRelativeDate } = useFormatDate()

  return (
    <div>
      <p>{formatDate(date, { format: 'long' })}</p>
      <p>{formatRelativeDate(date)}</p>
    </div>
  )
}
```

#### Date Manipulation and Logic

Use `date-fns` directly for all date manipulation, comparisons, and calculations:

```typescript
import { addDays, subDays, differenceInMinutes, isAfter, isBefore, parseISO } from 'date-fns'

// Date arithmetic
const tomorrow = addDays(new Date(), 1)
const lastWeek = subDays(new Date(), 7)

// Time calculations
const minutesUntil = differenceInMinutes(futureDate, new Date())

// Date comparisons
if (isAfter(date1, date2)) { ... }
if (isBefore(date, new Date())) { ... }

// Parsing
const parsedDate = parseISO('2023-10-05T15:30:00.000Z')
```

#### Anti-Patterns (Do NOT Use)

**❌ Never use these patterns:**

```typescript
// ❌ Don't use .toISOString() directly
const isoString = new Date().toISOString()
// ✅ Use formatDate instead
const isoString = formatDate(new Date(), { format: 'iso' })

// ❌ Don't use locale methods
const dateStr = date.toLocaleDateString('en-US', { month: 'long' })
// ✅ Use formatDate instead
const dateStr = formatDate(date, { format: 'long' })

// ❌ Don't use manual date arithmetic
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
// ✅ Use date-fns instead
const tomorrow = addDays(new Date(), 1)

// ❌ Don't mutate dates
const date = new Date()
date.setDate(date.getDate() + 1)
// ✅ Use immutable date-fns functions
const tomorrow = addDays(date, 1)
```

#### Why This Pattern?

- **Consistency**: All formatting goes through one utility
- **Maintainability**: Easy to update date formatting globally
- **Type Safety**: TypeScript support for format options
- **Immutability**: date-fns never mutates dates
- **Clarity**: `addDays(date, 7)` is clearer than `Date.now() + 7*24*60*60*1000`

#### Common Use Cases

**ISO Date Strings (API Requests)**:
```typescript
import { formatDate } from '@/lib/format-date'

const payload = {
  scheduledAt: formatDate(appointmentDate, { format: 'iso' }),
  dateOfBirth: formatDate(dob, { format: 'iso' })
}
```

**Age Calculations**:
```typescript
import { differenceInYears } from 'date-fns'

const age = differenceInYears(new Date(), new Date(dateOfBirth))
```

**Time Windows (e.g., meeting join logic)**:
```typescript
import { differenceInMinutes, isToday } from 'date-fns'

const scheduledDate = parseISO(appointment.scheduledAt)
const minutesUntil = differenceInMinutes(scheduledDate, new Date())
const canJoin = isToday(scheduledDate) && minutesUntil >= -30 && minutesUntil <= 30
```

**Date Ranges**:
```typescript
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns'

const isInRange = isWithinInterval(date, {
  start: startOfDay(new Date()),
  end: endOfDay(new Date())
})
```

### International Data Standards

When working with language, country, and timezone data, strict casing standards MUST be followed for system interoperability.

**Constants Location**: `apps/account/src/constants/`

#### Language Codes (ISO 639-1)

**Standard**: Lowercase two-letter codes

**Examples**:
- ✅ `'en'` (English)
- ✅ `'es'` (Spanish)
- ✅ `'ja'` (Japanese)
- ❌ `'EN'`, `'Es'`, `'JA'`

**Why Lowercase Matters**:
- **BCP 47 Language Tags**: `'en-US'`, `'fr-CA'` (language part is lowercase)
- **HTTP Accept-Language Headers**: `'en-US,fr;q=0.9'`
- **HTML lang Attributes**: `<html lang="en">`
- **i18n Libraries**: Most expect lowercase ISO 639-1 codes

**Reference**: `apps/account/src/constants/languages.ts`

#### Country Codes (ISO 3166-1 alpha-2)

**Standard**: Uppercase two-letter codes

**Examples**:
- ✅ `'US'` (United States)
- ✅ `'GB'` (United Kingdom)
- ✅ `'JP'` (Japan)
- ❌ `'us'`, `'Gb'`, `'jp'`

**Why Uppercase Matters**:
- **BCP 47 Region Subtags**: `'en-US'`, `'fr-CA'` (region part is uppercase)
- **Domain Country Codes**: `.US`, `.UK`, `.JP`
- **Banking Standards**: IBAN, SWIFT use uppercase country codes
- **Geographic APIs**: Most expect uppercase ISO 3166-1 alpha-2

**Reference**: `apps/account/src/constants/countries.ts`

#### Timezone Identifiers (IANA)

**Standard**: Area/Location format (case-sensitive)

**Examples**:
- ✅ `'America/New_York'`
- ✅ `'Europe/London'`
- ✅ `'Asia/Tokyo'`
- ❌ `'america/new_york'`, `'EUROPE/LONDON'`, `'EST'`

**Why IANA Format Matters**:
- **JavaScript Intl API**: `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' })`
- **Database Timezone Columns**: PostgreSQL, MySQL use IANA names
- **Backend Libraries**: dayjs, date-fns, luxon expect IANA format
- **Cross-platform Consistency**: Works across all environments

**Reference**: `apps/account/src/constants/timezones.ts`

#### Validation in Code Reviews

When reviewing code that uses international data:

✅ **Check**:
```typescript
// Correct usage
const locale = 'en-US'  // lowercase language + uppercase country
const timezone = 'America/New_York'  // IANA format
const country = 'US'  // uppercase
const language = 'en'  // lowercase
```

❌ **Reject**:
```typescript
// Wrong casing
const locale = 'EN-us'  // ❌ wrong casing
const timezone = 'america/new_york'  // ❌ lowercase IANA
const country = 'us'  // ❌ lowercase country
const language = 'EN'  // ❌ uppercase language
```

#### Enforcement Mechanisms

**TypeSpec Validation** (`specs/api/src/common/models.tsp`):
- `CountryCode`: `@pattern("^[A-Z]{2}$")` enforces uppercase
- `LanguageCode`: `@pattern("^[a-z]{2}$")` enforces lowercase
- `TimezoneId`: `@pattern("^[A-Za-z_]+\/[A-Za-z_]+$")` enforces IANA format

**API Validation** (auto-generated from TypeSpec):
- Zod validators reject invalid formats at runtime
- Returns 400 error for casing violations

**Test Coverage** (`services/api-ts/tests/e2e/person/person.test.ts`):
- "International Data Validation" suite tests casing enforcement
- Validates rejection of incorrect formats
- Ensures acceptance of correct formats

## Module Structure Patterns

Each business module follows a consistent structure for maintainability:

### Backend Module Structure

```
services/api-ts/src/handlers/person/
├── createPerson.ts         # Handler: Create person
├── getPerson.ts            # Handler: Get person by ID
├── updatePerson.ts         # Handler: Update person
├── deletePerson.ts         # Handler: Delete person
├── repos/
│   └── person.repo.ts      # Database repository
└── utils/
    └── validation.ts       # Person-specific validators
```

### Module Implementation Pattern

**Handler Example (createPerson.ts)**:
```typescript
import { Context } from 'hono';
import { PersonRepository } from './repos/person.repo';

export async function createPerson(ctx: Context) {
  const body = ctx.req.valid('json');
  const repo = ctx.get('personRepo') as PersonRepository;

  const person = await repo.create(body);

  return ctx.json(person, 201);
}
```

**Repository Example (repos/person.repo.ts)**:
```typescript
import { db } from '@/core/database';
import { persons } from '@/core/database.schema';
import { eq } from 'drizzle-orm';
import type { Logger } from '@/types/logger';

export class PersonRepository {
  constructor(
    private db: typeof db,
    private logger: Logger
  ) {}

  async create(data: CreatePersonData) {
    this.logger.info({ action: 'create_person' });

    const [person] = await this.db
      .insert(persons)
      .values(data)
      .returning();

    return person;
  }

  async findById(id: string) {
    const [person] = await this.db
      .select()
      .from(persons)
      .where(eq(persons.id, id))
      .limit(1);

    if (!person) {
      throw new Error('Person not found');
    }

    return person;
  }
}
```

**4. Handlers (handlers.ts)**:
```typescript
import { Context } from 'hono';
import { ClientService } from './service';
import { createClientSchema } from './validators';

const service = new ClientService();

export async function createClient(c: Context) {
  const body = createClientSchema.parse(await c.req.json());
  const client = await service.createClient(body);
  return c.json(client, 201);
}

export async function getClient(c: Context) {
  const id = c.req.param('id');
  const client = await service.getClient(id);
  return c.json(client);
}
```

### Consent Management Pattern

All modules with sensitive data include JSONB consent fields:

```typescript
// Database schema
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  person_id: uuid('person_id').references(() => persons.id),
  
  // Consent fields (JSONB)
  data_processing_consent: jsonb('data_processing_consent').$type<{
    granted: boolean;
    granted_at: string;
    ip_address: string;
    updated_at: string;
    updated_by: string;
  }>(),
  
  service_provider_access_consent: jsonb('service_provider_access_consent').$type<{
    granted: boolean;
    granted_at: string;
    ip_address: string;
    updated_at: string;
    updated_by: string;
  }>(),
});
```
