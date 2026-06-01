<!-- oli-version: 1.1 -->
<!-- based-on: DATA_GOVERNANCE_DRAFT.md, PRD v3, DOMAIN_MODEL.md -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-domain-model | sole owner of this file -->
<!-- consumed: DATA_GOVERNANCE_DRAFT.md from /oli-prd-audit — enriched with per-entity PII classification -->

# Data Governance — Dentalemon

> **Regulations:** HIPAA (US), GDPR (EU), RA 10173 (Philippines), plus financial record-keeping laws per locale.
> **This file is sole-owned by `/oli-domain-model`.** Do not edit manually — re-run the skill to update.

---

## §1 Data Classification

| Entity | Data Type | Sensitivity | Encryption Required | Access Restrictions |
|--------|-----------|------------|--------------------|--------------------|
| `Person` (name, DOB, contact) | PII — High | PHI when linked to dental record | Yes (at rest + transit) | Dental members of linked branch only |
| `Patient` | PHI — Critical | Directly identifiable | Yes | assertBranchAccess (BR-016) |
| `Visit` | PHI — Critical | Dental encounter record | Yes | Branch member with workspace access |
| `Treatment` | PHI — Critical | Clinical procedure data | Yes | Dentist, Dentist-Owner |
| `ChartEntry` | PHI — Critical | Dental chart conditions | Yes | Dentist, Dentist-Owner |
| `Prescription` | PHI — Critical | Drug + dosage + prescriber | Yes | Dentist who wrote, Dentist-Owner |
| `MedicalHistoryEntry` | PHI — Critical | Systemic health, allergies, medications | Yes | Dentist, Dentist-Owner |
| `ConsentForm` | PHI / Legal | Patient authorization | Yes | Dentist, Dentist-Owner, Patient |
| `ImagingStudy` + S3 objects | PHI — Critical | Radiographic images | Yes (S3 server-side + transit) | Dentist, Dentist-Owner |
| `CephAnalysis` | PHI — Critical | Derived clinical measurements | Yes | Dentist, Dentist-Owner |
| `LabOrder` | PHI — Critical | Patient + tooth + lab instructions | Yes | Dentist who created, Dentist-Owner |
| `PMDDocument` | PHI — Critical + Legal | Signed portable health record | Yes (immutable signed) | Dentist, Patient (download) |
| `ImportedPMD` | PHI — Critical | External health record | Yes | Dentist, Dentist-Owner |
| `Invoice` + `LineItem` | Financial — High | Billing record with procedure codes | Yes | Staff Full, Dentist-Owner |
| `PaymentPlan` | Financial — High | Payment schedule | Yes | Staff Full, Dentist-Owner |
| `Appointment` | PII — Medium | Scheduling metadata | Yes | All dental members |
| `AuditEvent` | Compliance — High | Action log (no PHI in log body) | Yes | Dentist-Owner only |
| `Membership` | Identity | Staff role at branch | Standard | Dentist-Owner |
| `Organization` / `Branch` | Operational | Practice metadata | Standard | Admin |
| `ConsentRecord` (Person JSONB) | PII / Legal | Marketing + data sharing consent | Yes | Patient, Dentist-Owner |
| `EMRRecord` | PHI — Critical | External medical import | Yes | Dentist, Dentist-Owner |

---

## §2 Retention Policies

| Entity | Retention Period | Auto-Purge? | Archive Strategy | Locale Notes |
|--------|-----------------|------------|-----------------|-------------|
| `Patient` (demographics) | Duration of care + 10 years (PH) / 6 years (GDPR) | No | Anonymize on erasure; retain for legal minimum | PH: RA 9439; EU: GDPR Art. 17 |
| `Visit` + clinical data | 10 years from last encounter (PH) / 8 years (UK/AU) / 7 years (US) | No | Retain minimum; anonymize patient link on erasure | [VERIFY per locale] |
| `Treatment` | Same as Visit | No | Same as Visit | — |
| `Prescription` | 5 years (PH) / 2 years (EU) | No | Retain; anonymize patient link | [VERIFY per locale] |
| `ImagingStudy` + S3 | 7 years clinical minimum | No | Delete S3 object + DB metadata on erasure | Must delete radiographs on GDPR erasure request |
| `PMDDocument` | Permanent (signed export) | **NO — cannot delete** | Cannot delete signed PMD per compliance | PMD signing is non-repudiable |
| `Invoice` / `LineItem` | 7 years (financial / tax) | No | Anonymize patient link; retain for tax audit | All locales: 7-year financial records |
| `AuditEvent` | 7 years minimum | No | Append-only; no deletion ever | HIPAA audit trail requirement |
| `ConsentForm` | Duration of care + 10 years | No | Retain; mark revoked | Must be available for litigation |
| `MedicalHistoryEntry` | Same as Visit | No | Same as Visit | — |
| `Appointment` | 1 year from date | Yes (after 1 year) | Soft-delete | Admin only |
| `Authentication sessions` | Session expiry (ADR-007 — [UNSPECIFIED]) | Yes | Auto-expire | [RESOLVE: define session TTL] |
| `Person` PII fields | Linked to Patient retention | No | Anonymize on erasure (replace with pseudonym) | GDPR Art. 17 + BR-020 patient merge |

---

## §3 Right to Deletion (GDPR Art. 17 / RA 10173 §34)

| Entity | Hard Delete? | Anonymization Method | Cascading Effects | Audit Trail Preserved? |
|--------|-------------|---------------------|------------------|----------------------|
| `Person` | No — Anonymize | Replace name/DOB/contact with synthetic pseudonym | Patient profile anonymized; dental records retain clinical data only | Yes — audit log retains actorId (now pseudonym) |
| `Patient` | No — Anonymize | Unlink from Person; replace with `[ERASED]` marker | Visits/treatments retain clinical codes; patient name gone | Yes |
| `Visit` / `Treatment` | No | Anonymize patient reference | CDT codes, procedure codes retain for statistical/billing compliance | Yes |
| `Prescription` | No | Anonymize patient reference | Drug name retains; patient identity gone | Yes |
| `ImagingStudy` | Partial — S3 delete | Delete S3 object (radiograph); retain metadata with anonymized patient ref | CephAnalysis anonymized | Yes |
| `PMDDocument` | **No** — legal hold | Cannot delete signed PMD | PMD remains; patient name may be anonymized in DB record | Yes |
| `Invoice` | No | Anonymize patient name; retain for 7-year tax compliance | LineItems retain CDT codes; patient identity gone | Yes |
| `AuditEvent` | **No** — never | Append-only; no deletion | None | N/A (is audit trail) |
| `ConsentForm` | No — keep state | Mark as `[ERASED]`; consent record anonymized | Downstream consent checks may fail — requires care | Yes |
| `Appointment` | Yes (after 1 year) | Hard delete | None | Audit event before delete |

**Erasure Workflow:** [WFG-006 — backend implemented (V-DG-002), Person+Patient targets]
> Implemented in `services/api-ts/src/handlers/erasure/`: a two-step audited
> request→approve/reject workflow (`dental_erasure_request`) over an anonymize
> engine. Hard invariants: anonymize-not-delete, audit trail never touched
> (append-only), legal-hold blocks erasure, dry-run by default. Targets wired so
> far: **Person** (name→`[ERASED]` pseudonym, all other identifiers nulled, row
> kept), **Patient** (emergency contact / provider / pharmacy / history /
> comms-prefs nulled), **ConsentForm** (signature + name snapshot redacted, state
> kept), and **Imaging** (DICOM/finding/annotation identifiers nulled, image rows
> archived), all via boundary-compliant `*-erasure.facade.ts`. A real **LegalHold
> store** (`dental_legal_hold`) blocks erasure of held subjects (and is consulted
> by retention). Visit/Treatment/Prescription/Invoice are verified NO-OP (they
> only reference patientId → resolves to the anonymized Person; clinical/billing
> codes retained per the §3 table).
> HTTP surface (admin-only, manual routes + `dental-erasure.tsp` contract):
> `POST /dental/erasure-requests`, `GET /dental/erasure-requests[/{id}]`,
> `POST /dental/erasure-requests/{id}/approve|reject`, plus
> `POST|GET /dental/legal-holds`, `POST /dental/legal-holds/{id}/release`.
> Still to add: the **physical S3 object deletion** of imaging radiographs — the
> imaging facade archives metadata + surfaces the stored-file ids; a storage-
> service job must delete the actual objects (a repo facade has no S3 client). The
> remaining §3 entities are covered above. Related: G-012 (PHI encryption gap).

---

## §4 Right to Export (GDPR Art. 20)

| Entity | Exportable? | Format | Includes Related? | Implemented? |
|--------|------------|--------|-------------------|-------------|
| `Patient` demographics | Yes | JSON / PDF | Yes — visit history, consents | **No — [WFG-006]** |
| `Visit` clinical records | Yes via PMD | PDF (PMD format) | Yes — treatments, chart, prescriptions | Yes (per-visit PMD) |
| `Invoice` history | Yes | PDF / CSV | Yes — line items, payments | **Partial — no bulk export** |
| `Prescription` history | Yes | PDF | Yes — drug + dosage + date | **No** |
| `ImagingStudy` | Yes | DICOM / JPEG | Yes — images + annotations | **Partial — download per image** |
| `ConsentForm` | Yes | PDF | No | **No** |

---

## §5 Consent Tracking

| Consent Type | Field on Person | Collected At | Revocable? | Impact of Revocation |
|-------------|----------------|-------------|-----------|---------------------|
| Marketing consent | `marketing_consent` (JSONB) | Registration (WF-005) | Yes | Stop marketing communications |
| Data sharing consent | `data_sharing_consent` (JSONB) | Registration | Yes | Restrict third-party data sharing |
| SMS consent | `sms_consent` (JSONB) | Registration | Yes | Disable SMS notifications |
| Email consent | `email_consent` (JSONB) | Registration | Yes | Disable email notifications |
| Treatment consent | `ConsentForm` entity | Per treatment (WF-018) | Yes (BR-014) | Block treatment; clinical record preserved |
| Data erasure request | — | Patient request | N/A — triggers erasure workflow | WFG-006 |

**Consent record structure (JSONB on Person):**
```json
{
  "granted": boolean,
  "granted_at": "ISO8601",
  "ip_address": "string",
  "updated_at": "ISO8601",
  "updated_by": "personId"
}
```

---

## §6 Data Lineage

| Entity | Field | Source | Transformation |
|--------|-------|--------|---------------|
| `Treatment` | `cdt_code` | Dentist selects from FeeSchedule | Stored as-is; copied to InvoiceLineItem |
| `Treatment` | `price_cents` | FeeSchedule default; dentist may override | Integer cents; no floating point |
| `Invoice` | `total_cents` | Sum of LineItem.price_cents | Computed; tax = 0 (BR-010 stub) |
| `PMDDocument` | `checksum` | SHA-256 of serialized visit snapshot | Computed at generation; verified on import |
| `ImagingAnnotation` | coordinates | Dentist draws on image | Pixel-space coordinates; stored as JSONB |
| `CephLandmark` | `x, y` | Dentist places on ceph radiograph | Pixel coords → calibrated mm (via calibration method) |
| `Person.marketing_consent` | `ip_address` | Captured at registration | Stored verbatim; not transformed |
| `AuditEvent` | `actor_id` | Better-Auth session | Copied from JWT claim; not transformed |

---

## §7 Open Items (from DATA_GOVERNANCE_DRAFT.md)

| Item ID | Question | Resolution |
|---------|----------|------------|
| AG-1 | Exact retention periods per locale | [VERIFY]: PH=10y, EU=varies by record type, US=7y minimum |
| AG-2 | Audit log retention period | **7 years** — HIPAA minimum; append-only, never deleted |
| AG-3 | PMD deletion policy for signed documents | **Cannot delete** — signed PMD is non-repudiable; anonymize DB record only |
| AG-4 | Data portability export format | PMD covers clinical; billing CSV needed; no bulk export workflow exists |
| AG-5 | Session TTL (ADR-007) | [UNRESOLVED] — must define before compliance sign-off |
| AG-6 | PHI at-rest encryption | G-012 in brownfield wave G1 — currently unimplemented |
