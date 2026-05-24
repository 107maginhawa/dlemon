# Mock Data — dental-visit
<!-- oli: v3-dentalemon | dental-visit | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

## Sample Visit (completed)
- `visit_id`: `vis_01HX...`
- `patient_id`: `pat_00142` (Maria Hernandez)
- `visit_date`: 2026-05-22
- `dentist`: Dr. Elena Ruiz
- `status`: `completed`
- `chief_complaint`: "Sensitivity on lower-left molar to cold"

### Treatments (performed)
- **FDI 36** — `D2392` Resin-based composite, two surfaces (M, O), status **performed**, fee €145.00
- **FDI 46** — `D2740` Crown — porcelain/ceramic substrate, status **performed** (prep + temp), fee €820.00

### Chart entries (conditions)
- **FDI 36** — caries, moderate severity, surfaces M+O, notes "Active lesion, depth to mid-dentin"
- **FDI 46** — fracture, severe, surfaces O+D, notes "MOD fracture, crown indicated"

### SOAP (signed)
- **S**: "Patient reports cold sensitivity on lower-left molar for 2 weeks."
- **O**: "Caries on 36 M+O. Fractured 46 with MOD involvement."
- **A**: "Active caries 36, fractured 46 requiring crown."
- **P**: "Composite 36 today. Crown prep 46 today, final delivery in 2 weeks."
- Signed by Dr. Elena Ruiz, 2026-05-22 14:32

## Sample Carry-over (from prior visit 2026-04-15)
- **FDI 17** — `D2391` Resin composite, one surface (O), status **planned** (not yet performed) — appears as ghost on current chart
- **FDI 27** — `D1110` Adult prophylaxis, status **planned** — ghost carry-over

## Sample Visit (draft, in progress)
- `visit_id`: `vis_01HX_draft`
- `patient_id`: `pat_00187` (James O'Connor)
- `visit_date`: 2026-05-24 (today)
- `status`: `draft`
- `chief_complaint`: "Routine checkup"
- No treatments yet, empty chart, SOAP unsigned
