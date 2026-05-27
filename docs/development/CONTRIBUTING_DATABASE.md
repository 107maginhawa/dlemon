# Database Workflow

This document covers Drizzle ORM schema changes, migrations, and database best practices.

## Schema Changes

1. **Modify Drizzle Schema**:
```typescript
// services/api-ts/src/core/database.schema.ts
export const persons = pgTable('persons', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  // Add new field
  phoneNumber: text('phone_number'),
  created_at: timestamp('created_at').defaultNow(),
});
```

2. **Generate Migration**:
```bash
cd services/api-ts
bun run db:generate
```

3. **Review Generated SQL**:
```bash
cat src/generated/migrations/0001_add_phone_number_field.sql
```

4. **Apply Migration**:
Migrations are applied automatically on server start, or manually:
```bash
bun run db:migrate
```

## Database Inspection

Use Drizzle Studio for visual database exploration:

```bash
cd services/api-ts
bun run db:studio
```

Opens a web interface at `http://localhost:4983`

## Best Practices

- **Migrations**: Never edit generated migrations - modify schema and regenerate
- **Indexes**: Add indexes for frequently queried columns
- **Foreign Keys**: Always define relationships
- **JSONB**: Use for flexible consent and configuration data
- **Timestamps**: Include `created_at` and `updated_at` on all tables
