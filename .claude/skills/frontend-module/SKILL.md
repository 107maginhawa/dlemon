---
name: frontend-module
description: Build a complete frontend module following the 4-file pattern (API client + hooks + schema + components + routes). Use when implementing UI for a new or existing API module in a frontend app.
---

# frontend-module

Build a complete frontend module with API client, hooks, components, and routes.

## Triggers

- Implementing UI for a new API module
- Adding frontend for endpoints created via `/typespec` + `/handler`
- Building a new page or feature in a frontend app

## Workflow

### 1. Check OpenAPI Spec

Always start by checking the API contract:

```bash
cat specs/api/dist/openapi/openapi.json | jq '.components.schemas.{ModelName}'
cat specs/api/dist/openapi/openapi.json | jq '.paths."/my-entities"'
```

Find nullable fields (needed for sanitization):
```bash
cat specs/api/dist/openapi/openapi.json | jq '.components.schemas.{ModelUpdateRequest}.properties | to_entries[] | select(.value.nullable == true) | .key'
```

### 2. Create API Client

`src/api/{module}.ts`:

```typescript
import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import { sanitizeObject } from '@/utils/api';

export async function listMyEntities() {
  return apiGet<MyEntity[]>('/my-entities');
}

export async function getMyEntity(id: string) {
  return apiGet<MyEntity>(`/my-entities/${id}`);
}

export async function createMyEntity(data: CreateMyEntityRequest) {
  return apiPost<MyEntity>('/my-entities', data);
}

export async function updateMyEntity(id: string, data: UpdateMyEntityRequest) {
  // sanitizeObject: nullable fields send null, others omit if empty
  const sanitized = sanitizeObject(data, {
    nullable: ['description', 'optionalField'], // from OpenAPI spec
  });
  return apiPatch<MyEntity>(`/my-entities/${id}`, sanitized);
}
```

### 3. Create Query Hooks

`src/hooks/use-{module}.ts` — domain-grouped pattern:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/api/my-entity';
import { queryKeys } from '@/api/query';

export function useMyEntities() {
  return useQuery({
    queryKey: queryKeys.myEntities(),
    queryFn: api.listMyEntities,
  });
}

export function useMyEntity(id: string) {
  return useQuery({
    queryKey: queryKeys.myEntity(id),
    queryFn: () => api.getMyEntity(id),
    enabled: !!id,
  });
}

export function useCreateMyEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createMyEntity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myEntities() });
      toast.success('Created successfully');
    },
    onError: () => toast.error('Failed to create'),
  });
}

export function useUpdateMyEntity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMyEntityRequest) => api.updateMyEntity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myEntities() });
      queryClient.invalidateQueries({ queryKey: queryKeys.myEntity(id) });
      toast.success('Updated successfully');
    },
    onError: () => toast.error('Failed to update'),
  });
}
```

Add query keys to `src/api/query.ts`:
```typescript
myEntities: () => ['my-entities'] as const,
myEntity: (id: string) => [...queryKeys.myEntities(), id] as const,
```

### 4. Create Zod Schema

`src/components/{module}/schema.ts`:

```typescript
import { z } from 'zod';

export const createMyEntitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
});

export type CreateMyEntityFormValues = z.infer<typeof createMyEntitySchema>;
```

### 5. Create Form Components

`src/components/{module}/{module}-form.tsx`:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMyEntitySchema, type CreateMyEntityFormValues } from './schema';

interface MyEntityFormProps {
  defaultValues?: Partial<CreateMyEntityFormValues>;
  onSubmit: (data: CreateMyEntityFormValues) => void;
  mode?: 'create' | 'edit';
}

export function MyEntityForm({ defaultValues, onSubmit, mode = 'create' }: MyEntityFormProps) {
  const form = useForm<CreateMyEntityFormValues>({
    resolver: zodResolver(createMyEntitySchema),
    defaultValues,
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields using shadcn/ui components */}
    </form>
  );
}
```

### 6. Create Route

`src/routes/_dashboard/{module}/index.tsx` (TanStack Router):

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { useMyEntities } from '@/hooks/use-my-entity';

export const Route = createFileRoute('/_dashboard/my-entities/')({
  component: MyEntitiesPage,
});

function MyEntitiesPage() {
  const { data, isLoading, error } = useMyEntities();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorAlert />;
  if (!data?.length) return <EmptyState />;

  return (/* render list */);
}
```

### 7. Type Check

```bash
cd apps/{app} && bun run typecheck
```

## File Naming Rules

- All files: **kebab-case** (`my-entity-form.tsx`, NOT `MyEntityForm.tsx`)
- Component exports: **PascalCase** (`export function MyEntityForm`)
- Import: `import { MyEntityForm } from './my-entity-form'`

## Architecture Rules

- Routes NEVER import from `@/api/*` — only through hooks
- Hooks encapsulate all API calls internally
- Use `@/` path alias for all imports
- Dates: `formatDate` from `@monobase/ui/lib/format-date` for display, `date-fns` for manipulation
- Country codes: uppercase. Language codes: lowercase. Timezones: IANA format.
- shadcn/ui components: CLI only (`bunx shadcn@latest add {component}`), never manual edits to `src/components/ui/`
