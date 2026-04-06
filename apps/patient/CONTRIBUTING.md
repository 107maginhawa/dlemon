# Account App Development Guide

This guide covers account app-specific development details. **For shared frontend patterns**, see [Root CONTRIBUTING.md > Frontend Development Patterns](../../CONTRIBUTING.md#frontend-development-patterns).

## Table of Contents

1. [App Overview](#app-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Domain Modules](#domain-modules)
5. [Routes](#routes)
6. [Quick Reference](#quick-reference)

---

## App Overview

**Purpose**: User-facing account management portal for Monobase Application Platform

**Features**:
- User profile management (personal information, contact, address)
- Multi-channel notifications (email, push via OneSignal)
- File storage (upload/download via S3/MinIO)
- Account security settings
- Secure authentication with Better-Auth

**Key Principles**:
- **API-First**: OpenAPI spec at `specs/api/dist/openapi/openapi.json` is source of truth
- **Module-Based**: Organize by domain (person, notifications, storage)
- **Type-Safe**: Strict TypeScript with Zod validation
- **Sanitized**: Proper null/omit handling via `sanitizeObject()`

---

## Tech Stack

- **Framework**: TanStack Router (type-safe file-based routing for React)
- **Runtime**: Bun 1.2.21+
- **State**: TanStack Query v5, React Hook Form
- **UI**: shadcn/ui + Tailwind CSS
- **Auth**: Better-Auth
- **Port**: 3002 (development)

**For detailed tech stack info and patterns**, see [Root Frontend Patterns](../../CONTRIBUTING.md#frontend-development-patterns).

---

## Directory Structure

```
src/
├── api/                      # API client functions
│   ├── client.ts            # Base HTTP client
│   ├── person.ts            # Person API functions
│   ├── notifications.ts     # Notifications API functions
│   ├── storage.ts           # Storage API functions
│   └── query.ts             # Centralized query keys
│
├── components/               # React components (by domain)
│   ├── person/              # Person domain
│   │   ├── schema.ts        # Zod schemas + types
│   │   ├── personal-info-form.tsx
│   │   ├── contact-info-form.tsx
│   │   ├── address-form.tsx
│   │   └── preferences-form.tsx
│   │
│   ├── notifications/       # Notifications domain
│   │   ├── schema.ts        # Notification schemas
│   │   └── notification-preferences-form.tsx
│   │
│   ├── storage/             # File storage domain
│   │   ├── file-upload.tsx
│   │   └── file-list.tsx
│   │
│   └── ui/                  # shadcn/ui (CLI-managed only)
│
├── hooks/                    # TanStack Query hooks
│   ├── use-person.ts        # Person query/mutation hooks
│   ├── use-notifications.ts # Notifications hooks
│   ├── use-storage.ts       # Storage hooks
│   └── use-mobile.tsx       # Utility hooks
│
├── routes/                   # File-based routing
│   ├── __root.tsx           # Root layout
│   ├── index.tsx            # Landing page
│   ├── auth/                # Auth pages
│   │   └── $authView.tsx    # Dynamic auth view
│   └── _dashboard/          # Protected routes
│       ├── dashboard.tsx    # Dashboard home
│       ├── notifications.tsx # Notifications view
│       └── settings/
│           ├── account.tsx  # Account settings
│           └── security.tsx # Security settings
│
├── services/                 # Business logic
│   ├── auth.ts              # Auth client
│   └── guards.ts            # Route guards
│
└── utils/                    # Utilities
    ├── api.ts               # Data sanitization
    └── config.ts            # App configuration
```

---

## Domain Modules

### Person Module

**Purpose**: Central PII safeguard - manages personal information for user accounts

**Files**:
- `components/person/schema.ts` - Personal info, contact, address, preferences schemas
- `components/person/*-form.tsx` - Personal info, contact, address, preferences forms
- `api/person.ts` - Person API functions (CRUD operations)
- `hooks/use-person.ts` - Person query/mutation hooks

**Forms**:
- `PersonalInfoForm` - First name, last name, middle name, DOB, gender
- `ContactInfoForm` - Email, phone, preferred language
- `AddressForm` - Primary and shipping address management
- `PreferencesForm` - Communication and notification preferences

**Key Patterns**:
- Check OpenAPI spec for `PersonUpdateRequest` nullable fields
- Use `sanitizeObject()` with nullable: `['lastName', 'middleName', 'dateOfBirth', 'gender']`

### Notifications Module

**Purpose**: Multi-channel notification management (email, push via OneSignal)

**Files**:
- `components/notifications/schema.ts` - Notification preferences schemas
- `components/notifications/notification-preferences-form.tsx` - Preference management
- `api/notifications.ts` - Notifications API functions
- `hooks/use-notifications.ts` - Notification query/mutation hooks

**Features**:
- Email notification preferences
- Push notification settings (OneSignal)
- Notification history and status
- Channel-specific preferences

### Storage Module

**Purpose**: File upload/download management (S3/MinIO backend)

**Files**:
- `components/storage/file-upload.tsx` - File upload component
- `components/storage/file-list.tsx` - File listing component
- `api/storage.ts` - Storage API functions
- `hooks/use-storage.ts` - Storage query/mutation hooks

**Features**:
- File upload with progress tracking
- File download and preview
- File metadata management
- Secure file access via signed URLs

---

## Routes

### Public Routes

- `/` - Landing page (requireGuest guard)
- `/auth/$authView` - Dynamic auth views (sign-in, sign-up, etc.)

### Protected Routes (Layout: `_dashboard`)

All dashboard routes use `requireAuthWithProfile()` guard.

**Dashboard**:
- `/dashboard` - Dashboard home (notifications, storage summary)

**Notifications**:
- `/dashboard/notifications` - Notification center and preferences

**Settings**:
- `/dashboard/settings/account` - Account settings (person profile management)
- `/dashboard/settings/security` - Security settings (password, 2FA)

### Special Routes

- `/onboarding` - Onboarding flow (uses `requireAuthWithoutProfile()` guard)

**Route Guards**:
See [Root Frontend Patterns > Routing](../../CONTRIBUTING.md#routing-tanstack-router) for guard usage and decision tree.

---

## Quick Reference

### Development Commands

```bash
cd apps/account

# Development
bun install          # Install dependencies
bun dev             # Start dev server (port 3002)
bun run build       # Build for production
bun run typecheck   # TypeScript checking

# Testing
bun run test:e2e        # E2E tests (Playwright)
bun run test:e2e:ui     # Playwright UI
```

### Adding shadcn/ui Components

New shadcn components should be added to the **shared UI package** at `/packages/ui`:

```bash
cd packages/ui
bunx shadcn@latest add [component-name]
```

**Never** edit generated shadcn components manually. All UI components are now shared via `@monobase/ui/components/*`.

### Before Implementing Features

1. Check OpenAPI spec: `specs/api/dist/openapi/openapi.json`
2. Identify nullable fields for the schema
3. Create schema file with Zod validation
4. Create form components
5. Create API functions with `sanitizeObject()`
6. Create query/mutation hooks
7. Create routes with appropriate guards

### Common Patterns

**Loading States**:
```typescript
const { data, isLoading, error } = useMyPerson()

if (isLoading) return <Skeleton />
if (error) return <ErrorAlert error={error} />
if (!data) return <EmptyState />
return <Content data={data} />
```

**Path Aliases**:
```typescript
// ✅ Good
import { Button } from '@/components/ui/button'

// ❌ Bad
import { Button } from '../../../components/ui/button'
```

---

## Complete Development Patterns

For complete details on:
- ⚠️ Critical rules (OpenAPI spec, shadcn/ui CLI, sanitization)
- Module architecture (4-file pattern)
- API integration and error handling
- Component patterns and form structure
- Query hooks and mutation patterns
- Routing conventions and guards
- Type safety rules
- Development workflow

**See**: [Root CONTRIBUTING.md > Frontend Development Patterns](../../CONTRIBUTING.md#frontend-development-patterns)

---

**For code examples, refer to existing modules in this app**:
- Complete module: `apps/account/src/components/person/`
- Query hooks: `apps/account/src/hooks/use-person.ts`
- API functions: `apps/account/src/api/person.ts`
- Route guards: `apps/account/src/services/guards.ts`

**Last Updated**: 2025-10-09
