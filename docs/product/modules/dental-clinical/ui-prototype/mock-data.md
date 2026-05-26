# Mock Data — dental-clinical
<!-- oli: v3-dentalemon | dental-clinical | ui-prototype -->
<!-- Stub: see screens.md and components.md for primary specification -->

Prescriptions:
- `{ drug_name: "Amoxicillin", dosage: "500 mg", frequency: "q8h", duration_value: 7, duration_unit: "days", instructions: "Take with food. Complete the full course." }`
- `{ drug_name: "Ibuprofen", dosage: "400 mg", frequency: "PRN", duration_value: 3, duration_unit: "days", instructions: "Max 1200 mg/day. Take with meals." }`

Lab orders:
- `{ lab_name: "Crown & Bridge Lab Ltd", order_type: "crown", tooth_region: "46", due_date: "2026-06-07", status: "sent", instructions: "Porcelain-fused-to-metal, A2 shade." }`
- `{ lab_name: "Nightguard Specialists", order_type: "nightguard", tooth_region: "upper arch", due_date: "2026-05-31", status: "pending" }`

Consent:
- One signed "Treatment Consent v3" with signer "Maria Lopez" signed 2026-05-24 10:14, plus one unsigned "Implant Consent v1".

Medical history (patient PMH):
- Allergies: `[{ allergen: "Penicillin", severity: "severe" }, { allergen: "Latex", severity: "mild" }]`
- Medications: `[{ name: "Metformin", dose: "500 mg", frequency: "bid", since_date: "2022-08-01" }]`
- Systemic conditions: `["diabetes_type_2"]`, ASA II, notes: "Well-controlled HbA1c 6.4."
- Derived safety floor: `high` (severe penicillin allergy drives high).

Attachments: one PDF "treatment-plan.pdf" 187 KB; one photo "intraoral-pre.jpg" 1.2 MB.

Amendments (only when visit completed): one entry "Corrected dosage frequency on amoxicillin per pharmacist call." by Dr. Chen, 2026-05-24 16:02.
