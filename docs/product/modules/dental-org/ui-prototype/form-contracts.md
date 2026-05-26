<!-- oli-version: 1.0 | generated: 2026-05-24 | skill: oli-ui-blueprint --blueprint --all -->

# Form Contracts — dental-org

## InviteStaffForm

| Field | Type | Required | Validation | Error message |
|-------|------|----------|------------|---------------|
| email | email input | YES | z.string().email() | "Valid email required" |
| role | select | YES | z.enum([roles]) | "Select a role" |

- Validation timing: onBlur per field, onSubmit form-level
- Server errors: 409 MEMBERSHIP_CONFLICT → "This person is already a staff member"
- Multi-step: NO — single dialog form
- Submit: POST /api/v1/dental/memberships → close dialog + refresh table

## CreateOrgForm (onboarding only)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| name | text | YES | min:2, max:120 |
| country_code | select | YES | ISO 3166 alpha-2 |

## UpdateBranchForm

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| name | text | YES | min:2, max:120 |
| timezone | select | YES | IANA timezone |
| address.street | text | YES | max:200 |
| address.city | text | YES | max:100 |
| address.postcode | text | YES | max:20 |

## UpdateFeeScheduleForm (inline)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| price_cents | number | YES | min:0, max:999999 |

- Validation: onBlur only (inline save)
- Error: inline red border + tooltip
