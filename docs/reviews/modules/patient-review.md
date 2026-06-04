# Patient Management — Standards & Experience Review
> Review date 2026-06-02 · Depth: LIGHT (table-stakes)

## 1. What we have
Rich patient module built on the `person`/`patient` base. Identity: create/get/update/archive/restore, bulk archive, import, export (`dental-patient/identity/`); list with pagination. **Patient list UX verified live** — filter tabs (All / Active / Needs-Follow-Up / Archived), search, bulk archive, export-all all present (`screenshots/02-patients-list.png`). Contacts (`dental-patient/contacts/`), insurance profiles + claim drafts (`insurance/`), recalls (`recalls/`), tasks (`repos/task.*`), alerts (`alerts/`), treatment plans (`treatment-plans/`), engagement, sync. Registration consent persisted as JSONB on person (`person.schema.ts` `PersonConsent { registrationConsent, capturedAt }`), enforced at create (`createDentalPatient.ts:38`, FR2.20). **Patient merge** exists in the base handler (`patient/mergePatients.ts`, `unmergePatients.ts`). Document storage via `storage` module. Frontend: `features/patients/{components,hooks,__tests__}`.

## 2. Table-stakes gaps
| Capability | Industry table-stakes | Our status | Evidence | Severity |
|---|---|---|---|---|
| Registration & demographics | Name, DOB, contacts, insurance, notes, recare status | ✅ | `identity/createDentalPatient.ts`, `contacts/`, `insurance/`, `recalls/` | — |
| Search + list management | Search, filter, bulk ops, export | ✅ | Live: tabs/search/bulk-archive/export (`02-patients-list.png`); `listDentalPatients.ts`, `exportDentalPatients.ts` | — |
| Duplicate dedup / merge | Detect + merge + move-between-family | ⚠️ | `patient/mergePatients.ts` + `unmergePatients.ts` exist (merge/unmerge), but **no duplicate detection/surfacing**; no move-between-family | P2 |
| Family / household linkage | Family-file linking household, guarantor, shared billing | ❌ | No `guarantor`/`household`/`family` model on dental patient or person | P1 |
| Recall / continuing-care status | Per-patient recare due feeding scheduling | ⚠️ | `recalls/` tracks type/dueDate/status but manual (see scheduling review) | P2 |
| Communication prefs + consent | Per-channel (SMS/email/marketing) consent | ❌ | Single `registrationConsent` boolean; **not per-channel**; comment in `person.schema.ts:70` explicitly notes "NOT the 4-consent split" | P1 |
| Document storage | Attach forms/IDs/insurance cards/consents | ✅ | `storage` module + consent templates (`dental-org/consentTemplates.ts`) | — |

## 3. Notable findings
- **[P1] No household / guarantor / family-file model.** Each patient is standalone; no household linkage, shared guarantor, or family billing. This is foundational in every incumbent (Dentrix Family File) for pediatric/family practices and guarantor statements. Recommend a household + guarantor relationship layer.
- **[P1] Consent is a single registration boolean, not per-channel.** `PersonConsent` captures only `registrationConsent`. Per-channel consent (SMS / email / marketing) is a table-stakes + compliance expectation, especially once automated reminders ship. The schema comment deliberately scopes it down — revisit when comms/marketing land.
- **[P2] Merge exists but no duplicate detection.** `mergePatients`/`unmergePatients` are present, but nothing surfaces likely duplicates (name+DOB match) to the front desk. Add a dedup-candidate finder.
- **[P2] Recall is manual** (shared finding with scheduling).

## 4. Carousel relevance
High indirectly: the patient is the spine the clinical/billing timelines hang off. The patient record itself anchors the longitudinal **visit/recall/treatment-plan history** that the carousel renders — strong fit as the entity whose state evolves over time.
