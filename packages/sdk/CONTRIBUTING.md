# Contributing to `@monobase/sdk`

This guide covers development patterns specific to the SDK package. For general contribution guidelines, see the [main CONTRIBUTING.md](../../CONTRIBUTING.md).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Adding Services](#adding-services)
- [Adding React Hooks](#adding-react-hooks)
- [Type Mapping Pattern](#type-mapping-pattern)
- [Exporting New Code](#exporting-new-code)
- [Testing](#testing)

## Architecture Overview

The SDK follows a **layered architecture**:

### Layer 1: Core API Client

Low-level fetch wrapper with authentication (Better-Auth cookie management):

```typescript
// src/api.ts
export const apiGet = <T>(url: string, params?: Record<string, any>) => { ... }
export const apiPost = <T>(url: string, data?: any) => { ... }
export const apiPatch = <T>(url: string, data?: any) => { ... }
export const apiDelete = <T>(url: string) => { ... }
```

**Key Features**:
- Automatic credential handling (`credentials: 'include'`)
- Type-safe responses
- Consistent error handling via `ApiError`
- Global base URL configuration

### Layer 2: Services

Business logic functions that call the API client:

```typescript
// src/services/person.ts
export async function getMyProfile(): Promise<Person | null> {
  const apiPerson = await apiGet<ApiPerson>('/persons/me')
  return mapApiPersonToFrontend(apiPerson)
}
```

**Responsibilities**:
- Import OpenAPI types from `@monobase/api-spec`
- Map API responses to frontend-friendly types
- Handle service-specific errors
- Provide type-safe function signatures

### Layer 3: React Hooks

TanStack Query hooks that wrap service functions:

```typescript
// src/react/hooks/use-person.ts
export function useMyPerson() {
  return useQuery({
    queryKey: queryKeys.personProfile('me'),
    queryFn: getMyProfile,
  })
}
```

**Responsibilities**:
- Integrate with TanStack Query for caching/refetching
- Provide optimistic updates where appropriate
- Show toast notifications on success/error
- Invalidate related queries after mutations

## Adding Services

### Service Types

There are two types of service files:

1. **Type-Only Services** - Re-export types from external libraries
2. **Implementation Services** - Implement API calls with type mapping

### Type-Only Services (e.g., `services/auth.ts`)

For services that only need to re-export types from external libraries:

```typescript
// src/services/auth.ts
/**
 * Auth Service - Type re-exports from better-auth
 * Provides User and Session types for authentication context
 */
export type { User, Session } from 'better-auth'
```

**When to use**:
- When types come from an external package (Better-Auth, etc.)
- When no API calls are needed (auth is handled by Better-Auth client)
- When you want to provide a consistent import path for types

### Implementation Services (e.g., `services/person.ts`)

For services that make API calls, follow the **three-type pattern**:

```typescript
// src/services/booking.ts
import type { components } from '@monobase/api-spec/types'

// 1. API Type Aliases (from OpenAPI spec)
type ApiBooking = components["schemas"]["Booking"]
type ApiBookingCreate = components["schemas"]["BookingCreateRequest"]

// 2. Frontend Types (with Date objects, cleaner interfaces)
export interface Booking {
  id: string
  startTime: Date        // API uses ISO string, we use Date
  endTime: Date
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

export interface CreateBookingData {
  startTime: Date
  endTime: Date
  // ... other fields
}

// 3. Mapper Functions (API → Frontend)
export function mapApiBookingToFrontend(api: ApiBooking): Booking {
  return {
    id: api.id,
    startTime: new Date(api.startTime),
    endTime: new Date(api.endTime),
    status: api.status,
    createdAt: new Date(api.createdAt),
    updatedAt: new Date(api.updatedAt),
  }
}
```

**Why this pattern?**
- API types come from OpenAPI spec (single source of truth)
- Frontend types use JavaScript Date objects for easier manipulation
- Mapper functions handle conversion between layers
- TypeScript ensures type safety across the boundary

### Step 2: Implement Service Functions

```typescript
// src/services/booking.ts
import { apiGet, apiPost, ApiError } from '../api'
import { sanitizeObject } from '../utils/api'
import { formatDate } from '@monobase/ui/lib/format-date'

/**
 * Get user's bookings
 */
export async function getMyBookings(): Promise<Booking[]> {
  const apiBookings = await apiGet<ApiBooking[]>('/bookings/me')
  return apiBookings.map(mapApiBookingToFrontend)
}

/**
 * Create a new booking
 */
export async function createBooking(data: CreateBookingData): Promise<Booking> {
  const apiRequest = sanitizeObject({
    startTime: formatDate(data.startTime, { format: 'iso' }),
    endTime: formatDate(data.endTime, { format: 'iso' }),
    // ... other fields
  }, {
    nullable: ['optionalField1', 'optionalField2']
  }) as ApiBookingCreate

  const apiBooking = await apiPost<ApiBooking>('/bookings', apiRequest)
  return mapApiBookingToFrontend(apiBooking)
}
```

**Best Practices**:
- Use `sanitizeObject` to clean form data (see [Type Mapping Pattern](#type-mapping-pattern))
- Use `formatDate` from `@monobase/ui` for date formatting
- Handle 404s gracefully (return `null` instead of throwing)
- Add JSDoc comments for better IDE autocomplete

### Step 3: Reference Existing Patterns

The SDK already has three complete service examples:

- **`services/person.ts`** - Full CRUD with nested objects, mapper pattern
- **`services/notifications.ts`** - Pagination, enums, list filtering
- **`services/storage.ts`** - Multi-step workflows, file handling

Study these before creating new services.

## Adding React Hooks

### Step 1: Add Query Keys

```typescript
// src/react/query-keys.ts
export const queryKeys = {
  // ... existing keys

  // Bookings
  bookings: () => [...queryKeys.all, 'bookings'] as const,
  bookingsList: (params?: any) => [...queryKeys.bookings(), 'list', params] as const,
  booking: (id: string) => [...queryKeys.bookings(), id] as const,
} as const
```

**Why?**
- Centralized key management prevents typos
- Type-safe query key generation
- Easier invalidation of related queries

### Step 2: Create Query Hooks

```typescript
// src/react/hooks/use-booking.ts
import { useQuery } from '@tanstack/react-query'
import { getMyBookings } from '../../services/booking'
import { queryKeys } from '../query-keys'

export function useMyBookings() {
  return useQuery({
    queryKey: queryKeys.bookingsList(),
    queryFn: getMyBookings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
```

### Step 3: Create Mutation Hooks

```typescript
// src/react/hooks/use-booking.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createBooking } from '../../services/booking'
import { queryKeys } from '../query-keys'
import { ApiError } from '../../api'

export function useCreateBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings() })
      toast.success('Booking created successfully!')
    },
    onError: (err) => {
      console.error('Failed to create booking:', err)
      if (err instanceof ApiError) {
        toast.error(err.message || 'Failed to create booking')
      } else {
        toast.error('Failed to create booking. Please try again.')
      }
    },
  })
}
```

**Best Practices**:
- Always invalidate related queries on mutation success
- Show toast notifications for user feedback
- Handle `ApiError` separately for better error messages
- Log errors to console for debugging

### Optimistic Updates (Advanced)

For instant UI feedback, use optimistic updates:

```typescript
export function useMarkBookingAsConfirmed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (bookingId: string) => confirmBooking(bookingId),
    onMutate: async (bookingId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.bookings() })

      // Snapshot previous value
      const previousBooking = queryClient.getQueryData<Booking>(
        queryKeys.booking(bookingId)
      )

      // Optimistically update
      if (previousBooking) {
        queryClient.setQueryData<Booking>(
          queryKeys.booking(bookingId),
          { ...previousBooking, status: 'confirmed' }
        )
      }

      return { previousBooking }
    },
    onError: (error, bookingId, context) => {
      // Rollback on error
      if (context?.previousBooking) {
        queryClient.setQueryData(
          queryKeys.booking(bookingId),
          context.previousBooking
        )
      }
      toast.error('Failed to confirm booking')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings() })
    },
  })
}
```

**Reference**: See `use-notifications.ts:48` for a complete optimistic update example.

## Type Mapping Pattern

### The Problem

API responses use ISO date strings, optional fields, and API-specific structures. Frontend code prefers Date objects and cleaner interfaces.

### The Solution

Use the **mapper pattern** with three types:

```typescript
// 1. API Type (from OpenAPI spec)
type ApiPerson = components["schemas"]["Person"]

// 2. Frontend Type (what React components use)
export interface Person {
  id: string
  firstName: string
  dateOfBirth?: Date  // API has ISO string, we use Date
  createdAt: Date
}

// 3. Mapper Function
export function mapApiPersonToFrontend(api: ApiPerson): Person {
  return {
    id: api.id,
    firstName: api.firstName,
    dateOfBirth: api.dateOfBirth ? new Date(api.dateOfBirth) : undefined,
    createdAt: new Date(api.createdAt),
  }
}
```

### Handling Nullable Fields

Use `sanitizeObject` to clean form data before API submission:

```typescript
import { sanitizeObject } from '../utils/api'
import { formatDate } from '@monobase/ui/lib/format-date'

const apiRequest = sanitizeObject({
  firstName: data.firstName,
  lastName: data.lastName,
  dateOfBirth: data.dateOfBirth ? formatDate(data.dateOfBirth, { format: 'date' }) : undefined,
  primaryAddress: data.primaryAddress,
}, {
  nullable: ['lastName', 'dateOfBirth', 'primaryAddress']
}) as ApiPersonCreate
```

**Rules**:
- Fields in `nullable` array: Send `null` if empty (explicit reset)
- Fields NOT in `nullable` array: Omit if empty (keep existing value)
- Supports nested fields: `'primaryAddress.street2'`

**Reference**: See `utils/api.ts:74` for full documentation.

### Paginated Responses

Use the `mapPaginatedResponse` helper:

```typescript
import { PaginatedResponse, mapPaginatedResponse } from '../utils/api'

export async function listBookings(): Promise<PaginatedResponse<Booking>> {
  const response = await apiGet<PaginatedResponse<ApiBooking>>('/bookings')
  return mapPaginatedResponse(response, mapApiBookingToFrontend)
}
```

## Exporting New Code

All exports are defined in `package.json`. When you add new code, update the exports:

```json
{
  "exports": {
    "./services/booking": "./src/services/booking.ts",
    "./react/hooks/use-booking": "./src/react/hooks/use-booking.ts"
  }
}
```

### Export Guidelines

- **Services**: Export as `./services/{module}`
- **Hooks**: Export as `./react/hooks/use-{module}`
- **Utilities**: Export as `./utils/{name}`
- **Types**: Export types from service files, not separately

## Testing

### Type Checking

```bash
# Run TypeScript compiler
bun run typecheck
```

### Manual Testing

Test your services and hooks in the frontend apps:

```typescript
// In apps/account/src/routes/test.tsx
import { useMyBookings, useCreateBooking } from '@monobase/sdk/react/hooks/use-booking'

function TestPage() {
  const { data: bookings } = useMyBookings()
  const createBooking = useCreateBooking()

  return (
    <div>
      <pre>{JSON.stringify(bookings, null, 2)}</pre>
      <button onClick={() => createBooking.mutate({ ... })}>
        Create Booking
      </button>
    </div>
  )
}
```

### Integration Testing

For API integration tests, see [main CONTRIBUTING.md](../../CONTRIBUTING.md#testing-requirements).

## Utility Organization

### Nested Utilities

The SDK supports nested utility directories via wildcard exports in `package.json`:

```json
{
  "exports": {
    "./utils/*": "./src/utils/*.ts"
  }
}
```

This allows imports from nested paths:

```typescript
// Nested utilities work automatically
import { SignalingClient } from "@monobase/sdk/utils/webrtc/signaling-client"
import { VideoPeerConnection } from "@monobase/sdk/utils/webrtc/peer-connection"

// Top-level utilities
import { formatDate } from "@monobase/sdk/utils/format"
import { sanitizeObject } from "@monobase/sdk/utils/api"
```

**When to nest utilities**:
- Group related utilities by domain (e.g., `webrtc/`, `validation/`)
- Keep top-level utils for common cross-cutting concerns
- Maintain flat structure for simple utilities

## Common Patterns

### Date Handling

```typescript
import { formatDate } from "@monobase/sdk/utils/format"

// Frontend Date → API ISO string
const isoString = formatDate(new Date(), { format: 'iso' })
const dateOnly = formatDate(new Date(), { format: 'date' })

// API ISO string → Frontend Date
const date = new Date(apiResponse.createdAt)
```

### Error Handling

```typescript
import { ApiError } from '../api'

try {
  const data = await apiGet('/endpoint')
} catch (error) {
  if (error instanceof ApiError && error.status === 404) {
    return null  // Not found is okay
  }
  throw error  // Re-throw other errors
}
```

### Form Data Sanitization

```typescript
import { sanitizeObject } from '../utils/api'

// Simple nullable fields
const clean = sanitizeObject(formData, {
  nullable: ['lastName', 'middleName']
})

// Nested nullable fields
const clean = sanitizeObject(formData, {
  nullable: ['primaryAddress', 'primaryAddress.street2']
})
```

## File Upload Pattern

For file uploads, use the 4-step process:

```typescript
// 1. Request presigned URL
const upload = await requestFileUpload({ filename, size, mimeType })

// 2. Upload to S3
await uploadToPresignedUrl(upload.uploadUrl, file)

// 3. Complete upload
await completeFileUpload(upload.file)

// 4. Get download URL
const download = await getFileDownload(upload.file)
```

**In React**: Use the `useFileUpload` hook which handles all steps internally.

Reference: `services/storage.ts` and `react/hooks/use-storage.ts`

## Questions?

For SDK-specific questions:
- Check existing services: `person.ts`, `notifications.ts`, `storage.ts`
- Check existing hooks: `use-person.ts`, `use-notifications.ts`, `use-storage.ts`

For general contribution questions, see [main CONTRIBUTING.md](../../CONTRIBUTING.md).
