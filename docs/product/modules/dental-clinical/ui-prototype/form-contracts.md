# Form Contracts — dental-clinical
<!-- oli: v3-dentalemon | dental-clinical | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Prescription form: `drug_name` (required, string, autocomplete from common dental drugs with free-text fallback), `dosage` (required, e.g. "500 mg"), `frequency` (required, enum: q4h/q6h/q8h/q12h/PRN/custom; if custom → free-text), `duration_value` (number, required), `duration_unit` (days/weeks), `instructions` (textarea, optional), `override_acknowledged` (boolean; required only if contraindication detected).

Lab order form: `lab_name` (required), `order_type` (required, enum: crown/bridge/splint/nightguard/other), `tooth_region` (FDI tooth picker, optional), `due_date` (date, optional), `instructions` (textarea, optional).

Medical history form: `allergies[]` (array of `{ allergen, severity }`), `medications[]` (array of `{ name, dose, frequency, since_date }`), `systemic_conditions[]` (multi-select from canonical list + free-text "other"), `asa_class` (enum I–V), `notes` (textarea). Validation: at least one allergen text required when adding an allergy row; ASA class optional but recommended.

Consent request: pick a template + optional override of title/version. Sign action requires non-empty signature canvas strokes + signer name.

File attachment: file picker accepts `image/*,.pdf` (PDF, PNG, JPG, HEIC). UI-side guard = **50 MB** per file (FIX-010 / decision Q5). Server byte ceiling is enforced one layer up in the storage module (100 MB images-PDF / 2 GB DICOM, env-configurable); the dental-clinical attachment endpoint records metadata only and applies no cap/MIME check. DICOM/CBCT (`.dcm`) studies are owned by the dental-imaging module, not this sheet.

Amendment append: `text` (required, min 4 chars, max 4000).
