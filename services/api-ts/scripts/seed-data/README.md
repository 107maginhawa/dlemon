# Seed Data Modules

Modular seed data for the Dentalemon demo clinic.

## UUID Convention

All seed entities use deterministic UUIDs:

```
xx000000-0000-1000-8000-{zero-padded-seq}
```

| Prefix | Entity                |
| ------ | --------------------- |
| `a0`   | Organization          |
| `b0`   | Branch                |
| `c0`   | Owner person          |
| `m0`   | Memberships           |
| `p0`   | Patient persons       |
| `pt`   | Patient records       |
| `v0`   | Visits                |
| `ch`   | Dental charts         |
| `ap`   | Appointments          |
| `in`   | Invoices              |
| `py`   | Payments              |
| `pl`   | Payment plans         |
| `tr`   | Treatments            |
| `tt`   | Treatment templates   |
| `vn`   | Visit notes           |
| `rx`   | Prescriptions         |
| `lo`   | Lab orders            |
| `mh`   | Medical history       |
| `li`   | Invoice line items    |
| `pi`   | Plan installments     |

## Adding a New Module

1. Add IDs to `ids.ts` using the next available prefix
2. Create `your-module.ts` exporting `async function seedYourModule(db: DatabaseInstance)`
3. Use `db.insert(table).values({...}).onConflictDoNothing()` for idempotency
4. Import and call it from `seed-demo.ts` in dependency order

## Running

```bash
cd services/api-ts
bun scripts/seed-demo.ts
```

Requires the API server to be running (for Better-Auth sign-up).
Re-running is safe — all inserts use `onConflictDoNothing`.
