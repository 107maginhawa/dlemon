# Contributing to `@monobase/ui`

This guide covers development patterns specific to the UI component library. For general contribution guidelines, see the [main CONTRIBUTING.md](../../CONTRIBUTING.md).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Adding Components](#adding-components)
- [Domain Organization](#domain-organization)
- [Testing Components](#testing-components)
- [Exporting New Code](#exporting-new-code)
- [Styling Guidelines](#styling-guidelines)

## Architecture Overview

The UI package follows a **domain-based organization**:

### Root Directories (Common Code)
Use root-level directories for **shared/reusable** code across all domains:
- `src/components/` - Common UI components (shadcn/ui)
- `src/hooks/` - Common React hooks
- `src/lib/` - Common utilities
- `src/constants/` - Common constants

### Domain Directories (Self-Contained Modules)
Create domain subdirectories for **domain-specific** code:
- `src/{domain}/components/` - Domain-specific components
- `src/{domain}/hooks/` - Domain-specific hooks
- `src/{domain}/lib/` - Domain-specific utilities
- `src/{domain}/constants/` - Domain-specific constants
- `src/{domain}/schemas.ts` - Domain Zod validation schemas

**Example**: The `person/` domain contains person-specific forms and schemas:
```
src/person/
├── components/
│   ├── personal-info-form.tsx
│   ├── contact-info-form.tsx
│   ├── address-form.tsx
│   └── preferences-form.tsx
└── schemas.ts
```

## Adding Components

### shadcn/ui Components (Common UI)

All common UI components are managed via the **shadcn CLI**, not hand-coded. To add a new shadcn component:

```bash
cd packages/ui
bunx shadcn@latest add <component-name>
```

**Examples**:
```bash
bunx shadcn@latest add button
bunx shadcn@latest add dialog
bunx shadcn@latest add form
```

The CLI will:
1. Add the component to `src/components/`
2. Install required dependencies
3. Use the configuration from `components.json`

**Configuration** (`components.json`):
- **Style**: `new-york`
- **Base Color**: `zinc`
- **CSS Variables**: Enabled
- **Aliases**: Components use `@/` imports

### Custom Components

When shadcn doesn't provide what you need:

**Common custom component**:
```typescript
// src/components/custom-component.tsx
import { cn } from "@/lib/utils"

export function CustomComponent({ className, ...props }) {
  return <div className={cn("base-styles", className)} {...props} />
}
```

**Domain-specific component**:
```typescript
// src/person/components/custom-person-component.tsx
import { Button } from "@/components/button"  // Use common components
import { personalInfoSchema } from "../schemas"

export function CustomPersonComponent() {
  // Domain-specific logic
}
```

## Domain Organization

### When to Create a Domain Directory

Create a new domain directory when you have:
- Multiple related components for a specific domain
- Domain-specific validation schemas
- Domain-specific hooks or utilities
- Self-contained functionality

**Example** - Creating a `booking/` domain:
```bash
mkdir -p src/booking/components
touch src/booking/schemas.ts
```

```
src/booking/
├── components/
│   ├── booking-form.tsx
│   └── booking-card.tsx
├── hooks/
│   └── use-booking-status.ts
└── schemas.ts
```

### When to Use Root Directories

Use root directories for:
- UI primitives (buttons, inputs, dialogs) - shadcn components
- Generic hooks (useMobile, useDetectCountry)
- Generic utilities (cn, formatDate, formatCurrency)
- Generic constants (countries, languages, timezones)

## Testing Components

Tests use **Bun's test runner** with **Happy DOM** for React component testing.

### Test Structure

```typescript
// src/components/button.test.tsx
import { describe, expect, test } from "bun:test"
import { render, screen } from "@testing-library/react"
import { Button } from "./button"

describe("Button", () => {
  test("renders correctly", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText("Click me")).toBeTruthy()
  })
})
```

### Running Tests

```bash
# Run all tests
bun test

# Watch mode
bun test:watch

# Run specific test file
bun test src/components/button.test.tsx
```

### Testing Domain Components

```typescript
// src/person/components/person-forms.test.tsx
import { describe, expect, test } from "bun:test"
import { render } from "@testing-library/react"
import { PersonalInfoForm } from "./personal-info-form"

describe("PersonalInfoForm", () => {
  test("validates with schema", () => {
    // Test form validation
  })
})
```

## Exporting New Code

All exports are defined in `package.json`. When you add new code, update the exports:

### Export Patterns

```json
{
  "exports": {
    "./styles": "./src/styles/globals.css",
    "./lib/*": "./src/lib/*.ts",
    "./constants/*": "./src/constants/*.ts",
    "./hooks/*": "./src/hooks/*",
    "./components/*": "./src/components/*",
    "./person/*": "./src/person/*",
    "./booking/*": "./src/booking/*"  // New domain
  }
}
```

### Usage in Apps

```typescript
// After adding exports, apps can import:
import { Button } from "@monobase/ui/components/button"
import { useBookingStatus } from "@monobase/ui/booking/hooks/use-booking-status"
import { BookingForm } from "@monobase/ui/booking/components/booking-form"
```

## Styling Guidelines

### Tailwind CSS

Use Tailwind utility classes with the `cn()` helper for conditional styling:

```typescript
import { cn } from "@/lib/utils"

export function Component({ variant, className }) {
  return (
    <div
      className={cn(
        "base-class",
        variant === "primary" && "variant-specific",
        className
      )}
    />
  )
}
```

### CSS Variables

Theme colors are defined as CSS variables in `src/styles/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}
```

Components use these via Tailwind utilities:
```typescript
<div className="bg-background text-foreground" />
```

### Typography

Typography is managed in `src/styles/globals.css` with imported fonts:
- **Headlines** (h1-h6): Montserrat Bold
- **Subtitles** (`.subtitle`): Merriweather Regular  
- **Body** (body, p, `.body-text`): Open Sans Semi-Bold

Fonts are automatically applied to semantic HTML elements. For custom elements:

```typescript
<h1>Heading</h1>              {/* Auto: Montserrat */}
<div className="subtitle">Subtitle</div>  {/* Merriweather */}
<p>Body text</p>              {/* Auto: Open Sans */}
```

## Form Components with Zod

Domain-specific forms should use Zod schemas for validation:

```typescript
// src/person/schemas.ts
import { z } from "zod"

export const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
})

// src/person/components/personal-info-form.tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { personalInfoSchema } from "../schemas"

export function PersonalInfoForm() {
  const form = useForm({
    resolver: zodResolver(personalInfoSchema),
  })

  // Form implementation
}
```

## Type Safety

### Path Aliases

The package uses TypeScript path aliases:
- `@/*` → `src/*`
- `@monobase/ui/*` → `src/*`

These are configured in `tsconfig.json` and work across the package.

### Type Checking

```bash
# Run type checking
bun run typecheck
```

## Common Patterns

### Detect User Preferences

```typescript
// Using common hooks
import { useDetectCountry } from "@monobase/ui/hooks/use-detect-country"
import { useDetectLanguage } from "@monobase/ui/hooks/use-detect-language"
import { useDetectTimezone } from "@monobase/ui/hooks/use-detect-timezone"

function MyForm() {
  const country = useDetectCountry()
  const language = useDetectLanguage()
  const timezone = useDetectTimezone()

  // Pre-fill form with detected values
}
```

### Format Values

```typescript
import { useFormatCurrency } from "@monobase/ui/hooks/use-format-currency"
import { useFormatDate } from "@monobase/ui/hooks/use-format-date"

function Display() {
  const formatCurrency = useFormatCurrency()
  const formatDate = useFormatDate()

  return (
    <div>
      <p>{formatCurrency(1000, "USD")}</p>
      <p>{formatDate(new Date())}</p>
    </div>
  )
}
```

## Questions?

For general contribution questions, see [main CONTRIBUTING.md](../../CONTRIBUTING.md).

For UI-specific questions, reference existing implementations in `src/` or open a discussion in the repository.
