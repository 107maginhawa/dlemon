# Frontend Development Patterns

This document covers patterns for frontend applications built with TanStack Router, React 19, and the Bun runtime — including the reference `apps/account` and any new app you scaffold.

**Note**: For app-specific details (domain modules, routes, features), see each app's individual CONTRIBUTING.md file.

## Critical Frontend Rules

### 1. Always Check OpenAPI Spec First

**Before implementing ANY API feature, check the OpenAPI specification.**

**Location**: `specs/api/dist/openapi/openapi.json`

**Essential Commands**:
```bash
# View schema
cat specs/api/dist/openapi/openapi.json | jq '.components.schemas.PersonUpdateRequest'

# Find nullable fields
cat specs/api/dist/openapi/openapi.json | jq '.components.schemas.PersonUpdateRequest.properties | to_entries[] | select(.value.nullable == true) | .key'
```

### 2. shadcn/ui Components - CLI ONLY

**NEVER manually create or edit files in `src/components/ui/`**

**Always use the CLI**:
```bash
cd apps/[app-name]
bunx shadcn@latest add button form input textarea select
```

**Custom components** go in domain directories (NOT in `src/components/ui/`).

### 3. Data Sanitization for Updates

**All UPDATE operations must use `sanitizeObject()` utility.** Check OpenAPI spec for nullable fields, then configure sanitization accordingly.

## Module Architecture (4-File Pattern)

Each domain module follows this structure:

**1. Schema** (`components/[module]/schema.ts`) - Zod schemas and TypeScript types

**2. Forms** (`components/[module]/*-form.tsx`) - Reusable form components
- Standard Props: `defaultValues`, `onSubmit`, `mode`, `showButtons`, `onCancel`
- Use React Hook Form + Zod resolver
- Add useEffect to update when defaultValues change

**3. API Functions** (`api/[module].ts`) - API client functions with sanitization
- Use `sanitizeObject()` for updates
- Check OpenAPI spec for nullable fields

**4. Query Hooks** (`hooks/use-[module].ts`) - TanStack Query hooks
- Query hooks for data fetching
- Mutation hooks for create/update/delete
- Invalidate queries on success
- Show toasts for feedback

## API Integration

**Base HTTP Client** (`src/api/client.ts`):
```typescript
apiGet<T>(url: string, params?: Record<string, any>): Promise<T>
apiPost<T>(url: string, data?: any): Promise<T>
apiPatch<T>(url: string, data?: any): Promise<T>
apiDelete<T>(url: string): Promise<T>
```

**Data Sanitization** (`src/utils/api.ts`):
- Fields in `nullable` array: empty string/null → send `null`
- Fields NOT in `nullable` array: empty string/null → omit from payload

**Query Keys Pattern** (`src/api/query.ts`):
```typescript
export const queryKeys = {
  person: () => ['person'] as const,
  personProfile: (id: string) => [...queryKeys.person(), 'profile', id] as const,
}
```

## Routing (TanStack Router)

**File Naming Conventions**:
- `filename.tsx` - Regular route
- `_filename.tsx` - Layout route
- `$param.tsx` - Dynamic parameter
- `index.tsx` - Index route
- `__root.tsx` - Root layout

**Route Guards** (`src/services/guards.ts`):
- `requireAuth()` - Authentication required
- `requireAuthWithProfile()` - Authentication + complete profile
- `requireAuthWithoutProfile()` - Onboarding only
- `requireGuest()` - Guest only

## Type Safety Rules

1. Never use `any` - use proper types
2. Import types from schemas
3. Separate API and frontend types

## Development Workflow

**Commands**:
```bash
cd apps/[app-name]
bun install          # Install dependencies
bun dev             # Start dev server
bun run build       # Build for production
bun run typecheck   # TypeScript checking
```

**Before Implementation**:
1. Check OpenAPI spec for schema/endpoints
2. Identify nullable fields
3. Verify request/response structures

**Common Patterns**:
```typescript
// Loading states
const { data, isLoading, error } = useQuery(...)
if (isLoading) return <Skeleton />
if (error) return <ErrorAlert />
if (!data) return <EmptyState />

// Path aliases - always use @/
import { Button } from '@/components/ui/button'
```

**For complete details and code examples**, see individual app documentation:
- Account App: `apps/account/CONTRIBUTING.md`

## Hook Architecture Patterns

### Domain-Based Hook Organization

**When to Use**: This pattern applies specifically to **domain/business logic hooks** that interact with APIs and manage domain-specific state.

**Pattern**: `use-[domain].ts` exports multiple related domain functions

Organize domain-related hooks by **business context** rather than individual operations. This groups related functionality together and provides a clean API.

**Domain Hooks** (Group Together) ✅:
```typescript
// File: src/hooks/use-storage.ts
export function useFileUpload() { ... }
export function useFileDownload() { ... }
export function useFileDelete() { ... }

// File: src/hooks/use-billing.ts
export function usePay() { ... }
export function useRefund() { ... }
export function useInvoice() { ... }

// File: src/hooks/use-client.ts
export function useClientProfile() { ... }
export function useUpdateClient() { ... }
export function useClientHistory() { ... }
```

**Utility Hooks** (Keep Individual) ✅:
```typescript
// File: src/hooks/use-debounce.ts
export function useDebounce() { ... }

// File: src/hooks/use-media-query.ts
export function useMediaQuery() { ... }

// File: src/hooks/use-local-storage.ts
export function useLocalStorage() { ... }

// File: src/hooks/use-click-outside.ts
export function useClickOutside() { ... }
```

**Key Distinction**:
- **Domain hooks** (API/business logic) → Group by business domain
- **Utility hooks** (UI helpers, general utilities) → Keep as individual files
- Don't force hooks into domains where it doesn't make sense

**Benefits**:
- Related domain functionality grouped together
- Single import for all domain operations
- Clear file organization by business context
- Encapsulates domain API integration

**Usage**:
```typescript
// Domain hooks - single import for related operations
import { useFileUpload, useFileDownload } from '@/hooks/use-storage'

// Utility hooks - individual imports
import { useDebounce } from '@/hooks/use-debounce'
import { useMediaQuery } from '@/hooks/use-media-query'

function MyComponent() {
  const { upload } = useFileUpload()
  const { download } = useFileDownload()
  const debouncedValue = useDebounce(value, 500)
  const isMobile = useMediaQuery('(max-width: 768px)')
  // ...
}
```

### API-Agnostic Routes Pattern

**Core Principle**: Routes should NEVER import API clients directly. Routes are UI layer, hooks are data layer.

**Architecture**:
```
┌─────────────┐
│   Routes    │  UI Layer (components, pages)
│  (UI Only)  │
└─────┬───────┘
      │ uses hooks
      ▼
┌─────────────┐
│    Hooks    │  Data Layer (queries, mutations)
│ (Data Logic)│
└─────┬───────┘
      │ uses API
      ▼
┌─────────────┐
│     API     │  HTTP Layer (fetch, axios)
│ (HTTP Client)│
└─────────────┘
```

**Rules**:
1. Routes only import from `@/hooks/*`
2. Hooks encapsulate API integration internally
3. API clients (`@/api/*`) only imported by hooks
4. No API imports in route components

**Good Pattern** ✅:
```typescript
// src/routes/_dashboard/settings/account.tsx
import { useFileUpload } from '@/hooks/use-storage'

function AccountSettingsPage() {
  const { upload } = useFileUpload()  // Clean API, no implementation details
  // ...
}
```

**Bad Pattern** ❌:
```typescript
// src/routes/_dashboard/settings/account.tsx
import { useFileUpload } from '@/hooks/use-storage'
import * as storageApi from '@/api/storage'  // ❌ Route shouldn't know about API

function AccountSettingsPage() {
  // ❌ Route exposes API implementation details
  const { upload } = useFileUpload({
    apiHandlers: {
      requestFileUpload: storageApi.requestFileUpload,
      uploadToPresignedUrl: storageApi.uploadToPresignedUrl,
      // ...
    }
  })
}
```

**Hook Implementation** (Internal API Integration):
```typescript
// src/hooks/use-storage.ts
import * as storageApi from '@/api/storage'  // ✅ Hook handles API

export function useFileUpload(options?: { maxFileSize?: number }) {
  // API integration is internal to the hook
  const upload = async (file: File) => {
    const uploadResponse = await storageApi.requestFileUpload({ ... })
    await storageApi.uploadToPresignedUrl(uploadResponse.uploadUrl, file)
    // ...
  }

  return { upload, isUploading, progress, error }
}
```

**Why This Matters**:
- Routes stay focused on UI concerns
- API implementation can change without touching routes
- Easier testing (mock hooks, not API calls)
- Clear separation of concerns
- Better maintainability

---

## Getting Help

### Resources

- **CLAUDE.md**: Comprehensive project guide for AI assistants
- **README.md**: Project overview and quick start
- **Module Docs**: Individual module documentation (in progress)
- **TypeSpec Docs**: https://typespec.io/docs
- **Drizzle ORM Docs**: https://orm.drizzle.team/docs/overview
- **Hono Docs**: https://hono.dev/docs
- **TanStack Docs**: https://tanstack.com/router/latest

### Communication Channels

- **Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Pull Requests**: Code review and collaboration

### Questions?

If you're stuck:
1. Check existing documentation (CLAUDE.md, README.md)
2. Search closed issues for similar problems
3. Ask in discussions
4. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Bun version, etc.)

## Enterprise Development Best Practices

### Enterprise Compliance

**Audit Logging**:
```typescript
// Always log sensitive data access
logger.info({
  user_id: c.get('user').id,
  action: 'view_client_records',
  client_id: clientId,
  timestamp: new Date().toISOString(),
});
```

**Consent Validation**:
```typescript
// Check consent before accessing data
if (!client.data_processing_consent?.granted) {
  return c.json({ error: 'Consent not granted' }, 403);
}
```

**Data Encryption**:
- Use TLS 1.3 for data in transit
- Encrypt sensitive fields at rest (planned)
- Never log sensitive PII (SSN, payment information, credentials)

### Person-Centric Design

Remember: **Person is the PII safeguard**
- Client and ServiceProvider extend Person
- Users can have multiple roles
- Never duplicate PII across tables
- Reference `person_id` for relationships

```typescript
// Good: Reference person_id
const client = await db
  .select()
  .from(clients)
  .innerJoin(persons, eq(clients.person_id, persons.id))
  .where(eq(clients.id, clientId));

// Bad: Duplicating person data in client table
```

---

## Directory Conventions (`apps/dentalemon/src/`)

### `lib/` — Pure computational utilities (no app state, no side effects)

Put here: math functions, date/string formatters, locale detectors, CSS class utilities.
```
lib/ceph-coords.ts       # cephalometric math
lib/ceph-export.ts       # canvas → PNG export
lib/detect-country.ts    # locale detection
lib/detect-language.ts
lib/detect-timezone.ts
lib/format-currency.ts
lib/format-date.ts
lib/utils.ts             # cn() tailwind classname merge
```

**Rule**: Files in `lib/` must have zero imports from `@/utils/`, `@/features/`, `@/stores/`, or any app-specific module.

### `utils/` — Application-domain utilities (app-aware, may access config/state)

Put here: RBAC rules, route guards, auth session helpers, runtime config parsers.
```
utils/config.ts          # API base URL + runtime config access
utils/guards.ts          # route guard functions (requireAuth, requireGuest)
utils/pin-session.ts     # PIN session management
utils/rbac.ts            # DentalRole, DentalModule, canAccess
utils/runtime-config.ts  # runtime config parsing (window.__RUNTIME_CONFIG__)
utils/load-org-context.ts
```

**Rule**: `lib/` and `utils/` serve distinct purposes — do not merge them. When in doubt: if the file could be published as a standalone npm package with no app coupling, it belongs in `lib/`. If it knows about dental roles, API URLs, or app config, it belongs in `utils/`.

### `services/` — Third-party SDK integrations

Currently: `services/onesignal.ts`. Files here initialize and wrap external SDKs. Do not move to a feature until a dedicated feature directory exists for that domain.

### `stores/` — Zustand global state stores

All Zustand stores go here (`org-context.store.ts`, etc.). Feature-specific ephemeral state stays in the feature's component or hook — only shared cross-feature state earns a store.
