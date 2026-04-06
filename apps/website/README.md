# Marketing Website

Public-facing marketing website for the Monobase Healthcare Platform. Built with Next.js for optimal SEO, provider discovery, and public information about platform features.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org) - React framework with App Router
- **Runtime**: [Bun](https://bun.sh) - 3× faster than Node.js with native TypeScript
- **UI**: [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com) - Accessible components built on Radix UI
- **State Management**: [TanStack Query v5](https://tanstack.com/query) - Server state and data fetching
- **Forms**: [React Hook Form](https://react-hook-form.com) + [Zod 4.x](https://zod.dev) - Type-safe validation
- **Auth**: [Better-Auth](https://better-auth.com) - Embedded authentication with cookie-based sessions

## Quick Start

```bash
# Install dependencies (from monorepo root)
bun install

# Start development server
cd apps/website
bun dev
```

The app runs on **http://localhost:3000** by default.

## Development

For detailed development guidelines, architecture patterns, and contribution standards, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### Essential Commands

```bash
# Development
bun dev              # Start dev server (port 3000)
bun run build        # Build for production
bun run typecheck    # Run TypeScript checks

# Testing
bun run lint         # Run ESLint
```

### API Integration

This app consumes the API service at `services/api`. Before implementing API features:

1. Check the OpenAPI spec: `specs/api/dist/openapi/openapi.json`
2. Use generated types from `@monobase/api-spec`
3. Follow Next.js Server Component patterns for data fetching

See [CONTRIBUTING.md](./CONTRIBUTING.md) for comprehensive API integration workflow.

## Project Structure

```
src/
├── api/              # API client functions
├── components/       # React components (organized by domain)
│   ├── filters/     # Filter components (provider search)
│   ├── layout/      # Layout components (header, footer)
│   ├── auth/        # Auth components
│   └── ui/          # shadcn/ui base components (CLI-managed)
├── hooks/           # TanStack Query hooks
├── app/             # Next.js App Router (file-based routing)
└── utils/           # Utilities (API sanitization, config)
```

## Features

- **Provider Directory**: Search and discover healthcare providers and pharmacists
- **Public Marketing**: Landing pages, features, solutions, integrations
- **SEO Optimized**: Static generation for marketing content
- **Appointment Booking**: Redirect to patient app for authenticated booking
- **Secure Auth**: Cookie-based sessions with Better-Auth
- **Responsive Design**: Mobile-first UI with Tailwind CSS

## Documentation

- **[CONTRIBUTING.md](./CONTRIBUTING.md)**: Comprehensive development guide (Next.js patterns, routing, SEO)
- **[Monorepo Root CLAUDE.md](../../CLAUDE.md)**: Workspace commands and monorepo structure
- **[API Spec](../../specs/api/dist/openapi/openapi.json)**: OpenAPI schema (single source of truth)

## Contributing

**Development Patterns**: See [Root CONTRIBUTING.md > Frontend Development Patterns](../../CONTRIBUTING.md#frontend-development-patterns) for:
- Module architecture (4-file pattern)
- API integration and sanitization
- Component patterns (shadcn/ui, forms)
- Query hooks with TanStack Query
- Type safety rules

**Website App Specifics**: See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Next.js App Router routing patterns
- Server vs Client Components
- SEO and metadata best practices
- Routes structure
- Development commands

---

**Part of the Monobase Healthcare Platform monorepo**
