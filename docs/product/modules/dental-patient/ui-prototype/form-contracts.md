# Form Contracts — dental-patient
<!-- oli: v3-dentalemon | dental-patient | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

## New Patient Form
Fields:
- `first_name` — text, required, max 80
- `last_name` — text, required, max 80
- `dob` — date picker, required, must be past, min 1900-01-01
- `gender` — select (male/female/other/prefer_not_to_say), optional
- `phone` — tel input, required, E.164 normalized
- `email` — email input, optional, validated
- `address` — multiline text, optional, max 500
- `emergency_contact_name` — text, optional, max 160
- `emergency_contact_phone` — tel, optional, E.164

Validation: Zod schema `patientCreateSchema`. Client-side via TanStack Form + zodResolver. Server returns 422 with field-level errors.
Submit: POST `/api/v1/patients` → redirect to `/patients/:id`.
