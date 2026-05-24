<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | source: docs/prd/v3-dentalemon.md + codebase
-->

# Domain Glossary — Dentalemon

> Sources: PRD Section 15, codebase schemas, DOMAIN_MODEL.md. Tags: [PRD] = from PRD, [CODE] = from codebase, [INFERRED] = inferred.

---

## Clinical Terms

| Term | Definition | Source |
|------|-----------|--------|
| **Amendment** | Additive correction record linked to the original clinical entry. Original remains visible; amendment appears alongside it. Past records are immutable — corrections are always additive. | [PRD] |
| **Baseline** | A dental chart snapshot captured at a specific visit. "Today's Baseline" = current visit chart state. | [PRD] |
| **Cabinet** | All clinical and administrative records for one patient, organized as a virtual file cabinet. Navigation metaphor for the patient workspace. | [PRD] |
| **Carry-over** | Pending (diagnosed/planned) treatments from a prior visit that persist to the current visit. Not auto-charged — dentist must explicitly add to treatment table. | [PRD] BR-008 |
| **CDT Code** | Current Dental Terminology — standardized 5-character procedure codes (e.g., D0120 = periodic oral evaluation, D7140 = simple extraction). Used on invoices and PMD exports. | [PRD] |
| **Chief Complaint** | Free-text patient-reported reason for the visit. Stored on `dental_visit.chief_complaint`. | [CODE] |
| **Clinical Notes** | SOAP-format notes (Subjective/Objective/Assessment/Plan) authored by a dentist member per visit. Append-only with versioned snapshots. | [PRD] |
| **Condition Code** | Clinical finding code on a treatment record (ICD-10 or SNOMED CT). | [CODE] |
| **Consent Form** | Patient authorization record for a specific treatment or procedure. Must be signed before treatment proceeds (BR-014). States: `pending → signed | revoked`. | [CODE] |
| **Dental Chart** | SVG-based per-tooth interactive map showing conditions and treatments. Supports FDI and Universal notation. Per-tooth timeline accessible from chart. | [PRD] ADR-003 |
| **Dentition** | Full set of teeth for a patient. Initialized via `initializeDentition` handler. Supports adult (FDI 11–48) and pediatric (FDI 51–85). | [CODE] |
| **FDI Notation** | International tooth numbering system: adult 11–48 (upper-right to lower-left), pediatric 51–85. Default in PH, EU, SG, AU. | [PRD] |
| **Focal Card** | The center/active card in the Timeline Carousel — fully interactive; left/right cards are preview-only. | [PRD] |
| **Folder** | One visit's records within a patient's cabinet. Each folder = one visit snapshot. | [PRD] |
| **ICD-10** | International Classification of Diseases, 10th revision — standard diagnostic codes (e.g., K02.1 = dental caries). Used in clinical records and PMD exports. | [PRD] |
| **Lab Order** | Request to an external dental laboratory. Contains tooth/surface, lab name, instructions, due date. States: `pending → sent → completed | cancelled`. | [CODE] |
| **Medical History Entry** | Append-only record of patient's systemic health conditions, allergies, or medications. Cannot be deleted — amended only. | [CODE] |
| **PMD** | Portable Medical Document — open signed document format for portable health records. One completed visit = one PMD file. Digitally signed with facility certificate. | [PRD] |
| **Prescription** | Medication order written by a dentist member. Requires `prescriberMemberId` (dentist role only — BR-017). State machine enforced. | [CODE] |
| **RxNorm** | Standard medication codes (e.g., 197361 = Amlodipine 5mg). Used in prescription records. | [PRD] |
| **Safety Floor** | Always-visible panel at the top of the clinical workspace showing patient's critical information: allergies, current medications, active conditions. | [PRD] |
| **Smart Attachment** | Image or document uploaded with dental-aware tagging: image type (periapical, bitewing, etc.) + tooth number(s). | [PRD] |
| **SNOMED CT** | Systematized Nomenclature of Medicine — standard clinical finding codes and allergy codes. Used in medical history and conditions. | [PRD] |
| **SOAP** | Clinical note format: Subjective (patient description), Objective (clinical findings), Assessment (diagnosis), Plan (treatment). | [PRD] |
| **Surface** | Anatomical subdivision of a tooth: Buccal (B), Mesial (M), Distal (D), Incisal/Occlusal (I/O), Palatal/Lingual (P/L). Stored as array on treatment record. | [PRD] |
| **Universal Notation** | US tooth numbering system: upper-right = 1, lower-right = 32. | [PRD] |

---

## Organizational Terms

| Term | Definition | Source |
|------|-----------|--------|
| **Branch** | A physical clinic location within an Organization. All clinical data is scoped to a branch. Access control unit. | [CODE] |
| **Dentist-Owner** | Highest-privilege dental membership role. Full access to all modules including staff management and reports. | [PRD] |
| **Dentist (Associate)** | Clinical membership role. Full workspace access but limited to own patients for billing/reports. No staff/settings access. | [PRD] |
| **Membership** | A person's active role at a specific branch. Junction table between `person` and `branch`. The RBAC enforcement point (BR-016). | [PRD] |
| **Organization** | Top-level tenant entity. A dental practice may have one or more branches. | [CODE] |
| **Staff – Full Operations** | Administrative membership role. View-only workspace, full scheduling/patient-registration, payment recording only for billing. | [PRD] |
| **Staff – Scheduling Only** | Restricted staff role. Calendar access only. Default landing = Calendar. | [PRD] |

---

## Billing Terms

| Term | Definition | Source |
|------|-----------|--------|
| **CDT Code** | See Clinical Terms above. Also used as invoice line item identifier. | [PRD] |
| **Fee Schedule** | Pre-configured list of procedures with default prices per branch. Editable per-procedure. | [PRD] |
| **Invoice** | Financial record for services rendered. States: `draft → issued → partial → paid | overdue | voided`. | [CODE] |
| **Line Item** | One procedure charge on an invoice, derived from a treatment record. | [CODE] |
| **Payment Plan** | Installment agreement for an invoice. Presence blocks invoice voiding (BR-011). | [CODE] |
| **VAT / GST** | Tax applied per locale. Currently stubbed at 0% (BR-010, ADR-008). Phase 2. | [PRD] |

---

## Technical Terms

| Term | Definition | Source |
|------|-----------|--------|
| **assertBranchAccess** | Server-side guard verifying requesting user has a `DentalMembership` for the requested branch. Called at start of every clinical handler (BR-016). | [CODE] |
| **assertBranchRole** | Server-side guard verifying requesting user has a specific membership role at the branch (e.g., dentist required for prescriptions). | [CODE] |
| **CRDT** | Conflict-free Replicated Data Type — algorithm for merging concurrent edits without conflicts. Used by the Cadence sync engine for offline-first replication. | [PRD] |
| **baseEntityFields** | Drizzle mixin applied to every table: `id` (UUID), `created_at`, `updated_at`, `created_by`, `updated_by`. | [CODE] |
| **Better-Auth** | Authentication library. Provides session management, email+password, magic link, passkey, 2FA, API keys. | [CODE] |
| **Cadence** | Rust P2P sync engine (Iroh transport, SQLite/Valkey metadata backends). Handles offline-first CRDT replication. Embedded in Tauri app. | [CODE] |
| **Drizzle ORM** | TypeScript-first SQL ORM generating type-safe queries. Database access layer throughout the API. | [CODE] |
| **pg-boss** | PostgreSQL-backed job queue for background tasks (email delivery, notifications, audit writes, booking slot generation). | [CODE] |
| **TypeSpec** | Microsoft API definition language. Compiled to OpenAPI + TypeScript types. Single source of truth for all API contracts. | [CODE] |
| **Visit Lifecycle** | State machine: `draft → active → completed → locked`. Optional: `active → discarded` (auto-discard, BR-005, deferred). | [CODE] |
| **Treatment Lifecycle** | State machine: `diagnosed → planned → performed → verified`. Terminal escape: any → `dismissed`. Forward-only (BR-006). | [CODE] |
