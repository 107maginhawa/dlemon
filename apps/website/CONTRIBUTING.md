# Website App Development Guide

This guide covers website app-specific development details. **For shared frontend patterns**, see [Root CONTRIBUTING.md > Frontend Development Patterns](../../CONTRIBUTING.md#frontend-development-patterns).

## Table of Contents

1. [App Overview](#app-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Next.js Routing Patterns](#nextjs-routing-patterns)
5. [Server vs Client Components](#server-vs-client-components)
6. [Route Guards (Next.js Pattern)](#route-guards-nextjs-pattern)
7. [SEO and Metadata](#seo-and-metadata)
8. [Routes](#routes)
9. [Quick Reference](#quick-reference)

---

## App Overview

**Purpose**: Marketing Website for Monobase Healthcare Platform

**Features**:
- Provider/pharmacist search and discovery
- Public marketing pages (features, solutions, integrations)
- SEO-optimized static content
- Appointment booking (redirects to patient app)
- Cross-app authentication

**Key Principles**:
- **API-First**: OpenAPI spec at `specs/api/dist/openapi/openapi.json` is source of truth
- **SEO-Optimized**: Static generation where possible for marketing content
- **Read-Focused**: Primarily displays provider data, minimal mutations
- **Type-Safe**: Strict TypeScript with Zod validation

---

## Tech Stack

- **Framework**: Next.js 15 with App Router (not TanStack Start)
- **Runtime**: Bun 1.2.21+
- **State**: TanStack Query v5, React Hook Form
- **UI**: shadcn/ui + Tailwind CSS
- **Auth**: Better-Auth
- **Port**: 3000 (development)

**For detailed tech stack info and patterns**, see [Root Frontend Patterns](../../CONTRIBUTING.md#frontend-development-patterns).

---

## Directory Structure

```
apps/website/
├── api/                      # API client functions
│   ├── client.ts            # Base HTTP client
│   ├── providers.ts         # Provider API functions
│   └── query.ts             # Centralized query keys
│
├── components/               # React components
│   ├── auth/                # Auth components
│   ├── filters/             # Filter components
│   ├── layout/              # Layout components
│   └── ui/                  # shadcn/ui (CLI-managed only)
│
├── hooks/                    # TanStack Query hooks
│   ├── use-auth.ts          # Auth hooks
│   └── use-providers.ts     # Provider query hooks
│
├── app/                      # Next.js App Router (file-based)
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing/home page
│   ├── globals.css          # Global styles
│   └── pharmacists/         # Provider search pages
│       ├── page.tsx         # Search/list page
│       └── [pharmacistId]/  # Dynamic provider detail
│           └── page.tsx
│
├── services/                 # Business logic
│   ├── auth.ts              # Auth client setup
│   └── guards.ts            # Route guards (Server Component helpers)
│
└── utils/                    # Utilities
    ├── api.ts               # Data sanitization
    ├── config.ts            # App configuration
    └── cn.ts                # Tailwind class merging
```

**Note**: Website uses `app/` directory (Next.js App Router), not `routes/` (TanStack Router).

---

## Next.js Routing Patterns

### File Structure Conventions

Next.js App Router uses specific file names for routing:

| File | Purpose | Example |
|------|---------|---------|
| `page.tsx` | Route page component | `app/page.tsx` → `/` |
| `layout.tsx` | Shared layout | `app/layout.tsx` → Root layout |
| `loading.tsx` | Loading UI | `app/loading.tsx` → Loading state |
| `error.tsx` | Error UI | `app/error.tsx` → Error boundary |
| `not-found.tsx` | 404 page | `app/not-found.tsx` → 404 |
| `[param]` | Dynamic segment | `app/pharmacists/[id]/page.tsx` → `/pharmacists/:id` |

### Route Examples

```
app/
├── layout.tsx                  → Root layout (all pages)
├── page.tsx                    → / (homepage)
├── loading.tsx                 → Loading state for /
├── pharmacists/
│   ├── page.tsx               → /pharmacists (list)
│   ├── loading.tsx            → Loading for list
│   └── [pharmacistId]/
│       ├── page.tsx           → /pharmacists/:id (detail)
│       └── loading.tsx        → Loading for detail
```

### Layouts

Layouts wrap pages and persist across navigation:

```typescript
// app/layout.tsx
import { SiteHeader } from '@/components/layout/site-header'
import { Providers } from '@/components/providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteHeader />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  )
}
```

### Dynamic Routes

Use `[param]` folder naming for dynamic segments:

```typescript
// app/pharmacists/[pharmacistId]/page.tsx
import { getProvider } from '@/api/providers'

interface PageProps {
  params: Promise<{
    pharmacistId: string
  }>
}

export default async function ProviderPage({ params }: PageProps) {
  const { pharmacistId } = await params
  const provider = await getProvider(pharmacistId)

  return (
    <div>
      <h1>{provider.name}</h1>
      {/* Provider details */}
    </div>
  )
}
```

### Loading States

Create `loading.tsx` for automatic loading UI:

```typescript
// app/pharmacists/loading.tsx
import { ProviderListSkeleton } from '@/components/ui/provider-skeleton'

export default function Loading() {
  return <ProviderListSkeleton />
}
```

### Error Handling

Create `error.tsx` for error boundaries:

```typescript
// app/pharmacists/error.tsx
"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

---

## Server vs Client Components

### Server Components (Default)

**When to use**:
- Static content and marketing pages
- Data fetching on server
- SEO-critical pages
- No client-side interactivity needed

**Benefits**:
- Better SEO and initial page load
- Can fetch data directly with `async/await`
- No JavaScript sent to client
- Reduced bundle size

**Example**:
```typescript
// app/pharmacists/page.tsx (Server Component - no directive needed)
import { getProviders } from '@/api/providers'

export default async function ProvidersPage() {
  const providers = await getProviders()

  return (
    <div>
      <h1>Find a Pharmacist</h1>
      {/* Render providers */}
    </div>
  )
}
```

### Client Components

**When to use**:
- Forms and user input
- Event handlers (onClick, onChange)
- Browser APIs (localStorage, window)
- State management (useState, useReducer)
- Effects (useEffect)
- TanStack Query hooks

**Required**: Add `"use client"` directive at top of file

**Example**:
```typescript
// components/filters/provider-filter.tsx
"use client"

import { useState } from 'react'
import { useSearchProviders } from '@/hooks/use-providers'

export function ProviderFilter() {
  const [specialty, setSpecialty] = useState('')
  const { data } = useSearchProviders({ specialty })

  return (
    <div>
      <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
        {/* Options */}
      </select>
    </div>
  )
}
```

### Pattern: Server Component Wraps Client Component

**Best Practice**: Server Component fetches data, Client Component adds interactivity

```typescript
// app/pharmacists/page.tsx (Server Component)
import { getProviders } from '@/api/providers'
import { ProviderList } from '@/components/provider-list'

export default async function ProvidersPage() {
  const providers = await getProviders()

  return <ProviderList initialData={providers} />  {/* Client Component */}
}
```

```typescript
// components/provider-list.tsx (Client Component)
"use client"

import { useProviders } from '@/hooks/use-providers'

export function ProviderList({ initialData }) {
  const { data: providers = initialData } = useProviders()

  // Interactive filtering, sorting, etc.
  return (/* UI */)
}
```

---

## Route Guards (Next.js Pattern)

**Location**: `services/guards.ts`

Route guards control access to routes based on authentication. They work with **Server Components** (different from TanStack Router guards).

### Available Guards

#### 1. `requireAuth()` - Authentication Required

Use for routes that need authentication.

```typescript
// app/booking/page.tsx
import { requireAuth } from '@/services/guards'

export default async function BookingPage() {
  const { user } = await requireAuth()

  return <div>Welcome, {user.name}</div>
}
```

**Returns**: `{ user: User }`
**Redirects to**: `/auth/sign-in` if not authenticated

#### 2. `requireGuest()` - Guest Only

Use for pages that should redirect authenticated users away (like landing page).

```typescript
// app/page.tsx
import { requireGuest } from '@/services/guards'

export default async function HomePage() {
  await requireGuest()  // Redirects to dashboard if authenticated

  return <div>Welcome to Monobase</div>
}
```

**Redirects to**: `/` if authenticated

#### 3. `getSession()` - Optional Authentication

Get session without redirecting (for optional auth features).

```typescript
// app/layout.tsx or components
import { getSession } from '@/services/guards'

export default async function Layout() {
  const session = await getSession()  // null if not authenticated

  return (
    <div>
      {session ? `Hello, ${session.user.name}` : 'Guest'}
    </div>
  )
}
```

**Returns**: `Session | null`

### Using Guards in Client Components

For Client Components, use hooks instead:

```typescript
"use client"

import { useSession } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ProtectedContent() {
  const { data: session, isLoading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/auth/sign-in')
    }
  }, [session, isLoading, router])

  if (isLoading) return <div>Loading...</div>
  if (!session) return null

  return <div>Protected content</div>
}
```

---

## SEO and Metadata

### Static Metadata

Export `metadata` object for static pages:

```typescript
// app/pharmacists/page.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Find a Pharmacist - Monobase',
  description: 'Search and book appointments with licensed pharmacists',
  openGraph: {
    title: 'Find a Pharmacist - Monobase',
    description: 'Search and book appointments with licensed pharmacists',
  },
}

export default function ProvidersPage() {
  // Implementation
}
```

### Dynamic Metadata

Use `generateMetadata` function for dynamic pages:

```typescript
// app/pharmacists/[pharmacistId]/page.tsx
import { Metadata } from 'next'
import { getProvider } from '@/api/providers'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pharmacistId } = await params
  const provider = await getProvider(pharmacistId)

  return {
    title: `${provider.name} - Monobase`,
    description: provider.bio,
    openGraph: {
      title: `${provider.name} - Monobase`,
      description: provider.bio,
      images: [provider.imageUrl],
    },
  }
}

export default async function ProviderPage({ params }: PageProps) {
  // Page implementation
}
```

### SEO Best Practices

1. **Always export metadata** for all pages
2. **Use semantic HTML** (h1, h2, nav, main, etc.)
3. **Optimize images** with Next.js Image component
4. **Static generation** for marketing pages when possible
5. **Structured data** for provider profiles (JSON-LD)

---

## Routes

### Public Routes

- `/` - Landing page
- `/pharmacists` - Provider search/directory
- `/pharmacists/[pharmacistId]` - Provider detail page
- `/features` - Platform features (marketing)
- `/solutions` - Solutions (marketing)
- `/integrations` - Integrations (marketing)

### Auth Routes

- `/auth/sign-in` - Sign in page
- `/auth/sign-up` - Sign up page

### Protected Routes (Planned)

- `/booking` - Appointment booking (requires auth, redirects to patient app)

**Note**: Most routes are public for marketing/SEO purposes. Authentication primarily used for cross-app navigation.

---

## Quick Reference

### Development Commands

```bash
cd apps/website

# Development
bun install          # Install dependencies
bun dev             # Start dev server (port 3000)
bun run build       # Build for production
bun run typecheck   # TypeScript checking

# Quality
bun run lint        # Run ESLint
```

### Adding shadcn/ui Components

```bash
cd apps/website
bunx shadcn@latest add [component-name]
```

**Never** edit files in `components/ui/` manually.

### Before Implementing Features

1. Check OpenAPI spec: `specs/api/dist/openapi/openapi.json`
2. Determine if Server or Client Component
3. Create page in `app/` directory
4. Add loading state (`loading.tsx`)
5. Add error boundary (`error.tsx`)
6. Export metadata for SEO
7. Apply route guards if needed

### Common Patterns

**Server Component Data Fetching**:
```typescript
export default async function Page() {
  const data = await apiGet('/endpoint')
  return <div>{/* Render */}</div>
}
```

**Client Component with Hooks**:
```typescript
"use client"

export function Component() {
  const { data, isLoading } = useQuery(...)
  if (isLoading) return <Skeleton />
  return <div>{/* Render */}</div>
}
```

**Dynamic Routes**:
```typescript
interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  // Use id
}
```

---

## Complete Development Patterns

For complete details on:
- ⚠️ Critical rules (OpenAPI spec, shadcn/ui CLI, sanitization)
- Module architecture (4-file pattern)
- API integration and error handling
- Component patterns and form structure
- Query hooks and mutation patterns
- Type safety rules
- Development workflow

**See**: [Root CONTRIBUTING.md > Frontend Development Patterns](../../CONTRIBUTING.md#frontend-development-patterns)

---

**For Next.js patterns, refer to existing code**:
- Server Components: `app/pharmacists/page.tsx`
- Client Components: `components/filters/`
- Layouts: `app/layout.tsx`
- Dynamic routes: `app/pharmacists/[pharmacistId]/page.tsx`
- Route guards: `services/guards.ts`

**Last Updated**: 2025-10-02
