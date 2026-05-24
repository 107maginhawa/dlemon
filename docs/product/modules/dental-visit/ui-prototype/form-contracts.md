# Form Contracts — dental-visit
<!-- oli: v3-dentalemon | dental-visit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

## Chart Entry — Conditions
Fields:
- `tooth_fdi` — hidden, required, set from chart click
- `condition_type` — select (caries/fracture/mobility/abrasion/erosion/other), required
- `severity` — radio (mild/moderate/severe), required
- `surfaces` — multi-checkbox (M/O/D/B/L), at least 1 required
- `notes` — textarea, optional, max 500

## Chart Entry — Treatments
Fields:
- `tooth_fdi` — hidden, required
- `cdt_code` — required (via CDTCodePicker)
- `surfaces` — multi-checkbox (M/O/D/B/L), required for surface-based codes
- `status` — select (diagnosed/planned/performed), default `diagnosed`. Server enforces state machine: cannot skip directly to performed.
- `fee` — currency input, optional override, defaults from template

## SOAP Notes
Fields (all rich-text, min 10 chars each for sign):
- `subjective` — required for sign
- `objective` — required for sign
- `assessment` — required for sign
- `plan` — required for sign

Submit: PATCH `/api/v1/visits/:vid/soap` (auto-save). POST `/api/v1/visits/:vid/soap/sign` to lock. Addendums via POST `/api/v1/visits/:vid/soap/addendum`.

Validation: Zod schemas `chartEntrySchema`, `treatmentCreateSchema`, `soapNotesSchema`. Server 422 with field errors.
