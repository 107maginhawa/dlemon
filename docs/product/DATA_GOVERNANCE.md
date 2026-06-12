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
| `Person` (name, DOB, contact) | PII — High | PHI when linked to dental record | Yes — storage-layer at rest + TLS transit (see §1.1) | Dental members of linked branch only |
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

> In the **Encryption Required** column, "Yes" for PHI/PII at rest is satisfied
> by the storage-layer control defined in §1.1 below (not column-level
> encryption). "Transit" is satisfied by TLS terminated in front of the API.

### §1.1 PHI Encryption-at-Rest Control (G-012 / AG-6)

**Control type — storage-layer (transparent disk/volume) encryption.** PHI/PII
at rest (e.g. `Person.first_name/last_name/date_of_birth/contact_info`,
`dental_patient_contact.name/phone/email`, and all PHI tables in §1) is
protected by **transparent encryption of the database storage volume** — an
encrypted block device / filesystem (LUKS/dm-crypt) for self-hosted Postgres, or
managed-storage encryption (e.g. AWS RDS encryption with KMS, GCP Cloud SQL
CMEK, Azure Database for PostgreSQL storage encryption) for managed deployments,
plus encrypted S3/object storage for imaging (`ImagingStudy` server-side
encryption). This is the HIPAA-recognized addressable safeguard for
encryption-at-rest; HIPAA does **not** require column-level encryption.

**Why not column-level.** Encrypting `name`/`date_of_birth`/`contact` columns
in the application or via `pgcrypto` would break the search, sort, and
range-query paths those fields drive (e.g. patient name search, DOB filters) for
no incremental compliance benefit over volume encryption. Column-level
encryption is therefore **deferred** — see §1.2.

**How it is verified (non-regressable attestation).** Because volume encryption
is an infrastructure/provisioning control rather than application code, the API
records an explicit **operator attestation** that the control is in force:
- Env var **`DB_AT_REST_ENCRYPTION`** (`enabled` | `verified` | `unverified`),
  parsed into typed config at
  `services/api-ts/src/core/config.ts` → `config.database.atRestEncryption`
  (type in `services/api-ts/src/core/database.ts` `DatabaseConfig.atRestEncryption`).
- **Startup assertion:** in production (`NODE_ENV=production`) `parseConfig()`
  **refuses to boot** unless the attestation is `enabled` or `verified` — the
  same guard that already rejects weak `AUTH_SECRET` / default infra
  credentials. This makes the §1 "Yes (at rest)" claim a deterministic startup
  invariant that cannot silently regress.
- **Test evidence:** `services/api-ts/src/core/config.test.ts` (V-DG-001
  cases) — asserts the attestation parses, defaults to `unverified`, and that
  production boot throws when it is absent/disabled and passes when attested.
- **Deployment evidence:** operators provision the encrypted volume / managed
  storage encryption out-of-band and set `DB_AT_REST_ENCRYPTION=verified` once
  the cloud/KMS encryption status is confirmed (see `services/api-ts/.env.example`).

### §1.2 Deferred: column-level encryption (future defense-in-depth)

Column-level / field-level encryption (e.g. `pgcrypto` or application-layer
envelope encryption) is a **deferred future option**, scoped only to a named
**ultra-sensitive subset** if/when required: government identifiers and any
free-text clinical fields that do not need to be searchable
(`MedicalHistoryEntry` systemic-health notes, `Prescription` free-text). It is
**not** planned for searchable demographics (`name`, `date_of_birth`,
`contact`), because that would break search/sort with no HIPAA requirement to
justify it. Tracked as defense-in-depth, not a compliance blocker.

---

## §2 Retention Policies

| Entity | Retention Period | Auto-Purge? | Archive Strategy | Locale Notes |
|--------|-----------------|------------|-----------------|-------------|
| `Patient` (demographics) | Duration of care + 10 years (PH) / 6 years (GDPR) | No | Anonymize on erasure; retain for legal minimum | PH: RA 9439; EU: GDPR Art. 17 |
| `Visit` + clinical data | 10 years from last encounter (PH) / 8 years (UK/AU) / 7 years (US) | No | Retain minimum; anonymize patient link on erasure | [VERIFY per locale] |
| `Treatment` | Same as Visit | No | Same as Visit | — |
| `Prescription` | 5 years (PH) / 2 years (EU) | No | Retain; anonymize patient link | [VERIFY per locale] |
| `ImagingStudy` + S3 | 7 years clinical minimum | No | Delete S3 object + DB metadata on erasure | Must delete radiographs on GDPR erasure request |
| `PMDDocument` | Permanent (immutable clinical export) | **NO — cannot delete** | Immutable once generated; supersede-on-amend only | Checksum-sealed (tamper-evident) clinical record; digital signing / non-repudiation is Phase-2 (FR12.4), not V1 |
| `Invoice` / `LineItem` | 7 years (financial / tax) | No | Anonymize patient link; retain for tax audit | All locales: 7-year financial records |
| `AuditEvent` | 7 years minimum | No | Append-only; no deletion ever | HIPAA audit trail requirement |
| `ConsentForm` | Duration of care + 10 years | No | Retain; mark revoked | Must be available for litigation |
| `MedicalHistoryEntry` | Same as Visit | No | Same as Visit | — |
| `Appointment` | 1 year from date | Yes (after 1 year) | Soft-delete | Admin only |
| `Authentication sessions` | **PIN: 5 min idle (in-memory) / Cloud: 7 days absolute (ADR-003)** | Yes | PIN auto-lock on idle; cloud session DB-revoke → immediate 401 | Two-layer model per ADR-003: PIN re-auth at the shared workstation (HIPAA §164.312(a)(2)(iii) automatic logoff — 5 min is stricter than the common 10–15 min); cloud "stay signed in" trust = 7-day industry default |
| `Person` PII fields | Linked to Patient retention | No | Anonymize on erasure (replace with pseudonym) | GDPR Art. 17 + BR-020 patient merge |

---

## §3 Right to Deletion (GDPR Art. 17 / RA 10173 §34)

| Entity | Hard Delete? | Anonymization Method | Cascading Effects | Audit Trail Preserved? |
|--------|-------------|---------------------|------------------|----------------------|
| `Person` | No — Anonymize | Replace name/DOB/contact with synthetic pseudonym | Patient profile anonymized; dental records retain clinical data only | Yes — audit log retains actorId (now pseudonym) |
| `Patient` | No — Anonymize | Unlink from Person; replace with `[ERASED]` marker | Visits/treatments retain clinical codes; patient name gone | Yes |
| `Visit` / `Treatment` | No | Anonymize patient reference | CDT codes, procedure codes retain for statistical/billing compliance | Yes |
| `Prescription` | No | Anonymize patient reference | Drug name retains; patient identity gone | Yes |
| `ImagingStudy` | Yes — S3 delete (implemented V-DG-002) | Delete S3 object (radiograph) + storage `file` row; retain anonymized metadata | CephAnalysis anonymized | Yes |
| `DentalAttachment` | Yes — S3 delete (implemented V-DG-002) | Null `fileName`/`note` (PHI) + redact `filePath`; delete the S3 object + storage `file` row for **confirmed object-store keys**; retain `imageType`/`toothNumbers` clinical metadata; mark row deleted | None | Yes |
| `PMDDocument` | **No** — legal hold | Cannot delete signed PMD | PMD remains; patient name may be anonymized in DB record | Yes |
| `Invoice` | No | Anonymize patient name; retain for 7-year tax compliance | LineItems retain CDT codes; patient identity gone | Yes |
| `AuditEvent` | **No** — never | Append-only; no deletion | None | N/A (is audit trail) |
| `ConsentForm` | No — keep state | Mark as `[ERASED]`; consent record anonymized | Downstream consent checks may fail — requires care | Yes |
| `Appointment` | No — soft-delete (archive via `deletedAt`) | Retention auto-purge after 1yr from `scheduledAt` (V-DG-003); legal-hold subjects excluded | None | Audit event on archive |

**Erasure Workflow:** [WFG-006 — backend implemented (V-DG-002), Person+Patient targets]
> Implemented in `services/api-ts/src/handlers/dental-erasure/`: a two-step audited
> request→approve/reject workflow (`dental_erasure_request`) over an anonymize
> engine. Hard invariants: anonymize-not-delete, audit trail never touched
> (append-only), legal-hold blocks erasure, dry-run by default. Targets wired so
> far: **Person** (name→`[ERASED]` pseudonym, all other identifiers nulled, row
> kept), **Patient** (emergency contact / provider / pharmacy / history /
> comms-prefs nulled), **ConsentForm** (signature + name snapshot redacted, state
> kept), **Imaging** (DICOM/finding/annotation identifiers nulled, image rows
> archived), and **Attachment** (x-ray/photo `fileName`/`note` nulled, `filePath`
> redacted, row marked deleted; only filePaths confirmed as object-store keys are
> surfaced for physical S3 delete — legacy free-form `/uploads/…` paths have their
> DB PHI erased but are never handed to the storage client as a bogus delete),
> all via boundary-compliant `*-erasure.facade.ts`. A real **LegalHold
> store** (`dental_legal_hold`) blocks erasure of held subjects (and is consulted
> by retention). Visit/Treatment/Prescription/Invoice are verified NO-OP (they
> only reference patientId → resolves to the anonymized Person; clinical/billing
> codes retained per the §3 table).
> HTTP surface (admin-only, manual routes + `dental-erasure.tsp` contract):
> `POST /dental/erasure-requests`, `GET /dental/erasure-requests[/{id}]`,
> `POST /dental/erasure-requests/{id}/approve|reject`, plus
> `POST|GET /dental/legal-holds`, `POST /dental/legal-holds/{id}/release`.
> **Physical S3 object deletion of imaging radiographs + clinical attachments — implemented (V-DG-002,
> imaging 2026-06-01; attachments 2026-06-12).**
> The imaging and attachment facades surface `fileIdsPendingS3Delete`; `approveErasureHandler` (handler
> scope, `ctx.get('storage')`) calls `physicalDeleteErasedFiles` to delete the S3 objects AND their
> storage `file` rows, with an `erasure.s3_deleted` audit event. Fail-open: anonymization is already
> committed before delete runs, so a storage error records the object as pending (idempotent — the
> id set is recomputed each run) rather than failing the erasure. See
> `services/api-ts/src/handlers/dental-erasure/erasure-storage.ts`.
> For **attachments**, `dental_attachment.filePath` is an unvalidated client string with no FK: the
> facade nulls DB PHI (`fileName`/`note`) + redacts `filePath` for **every** row, but only surfaces
> filePaths it can confirm as real object-store `stored_file` keys (`filterExistingStoredFileIds`) for
> the S3 delete — so a legacy free-form `/uploads/…` path is never issued as a silently-succeeding
> bogus `DeleteObject`. **Residual (roadmap):** a true legacy filesystem object whose real location is
> not an object-store key cannot be physically located by this code (its DB PHI is still erased); the
> durable fix is to validate `filePath` at write time / migrate legacy rows. (Two further erasure-wide
> infra items remain open and shared with imaging: there is no operator-reachable retry path for an
> S3-delete left pending after an outage, and `physicalDeleteErasedFiles` counts a non-throwing
> `DeleteObject` as deleted without a `HeadObject` confirmation — both tracked for a future
> erasure-hardening pass.) The remaining §3 entities are covered above. (PHI at-rest encryption:
> resolved separately — AG-6/G-012, §1.1.)

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

> **V-IMG-EXP-001 — DEFERRED (P1→P2), pending WFG-006 PRD decision (2026-06-01).** The bulk/multi-entity
> GDPR Art. 20 portability export for `Patient` (bulk), `Prescription`, and `ConsentForm` is **not built**
> and is **deferred by design**: WFG-006 (and the portability bundle format) requires a PRD-level decision —
> see `WORKFLOW_MAP.md` ("WFG-006 … require PRD-level decisions … escalation to PRD amendment"). Building an
> aggregated JSON/PDF portability bundle against an undecided format would be premature at this stage. Clinical
> export is already covered per-visit by signed PMD (`dental-pmd/exportPMD.ts`); patient-list CSV exists
> (`exportDentalPatients.ts`, FR2.8). **Tracked as a deferred item, not a P1 gap.** Re-classify to a build task
> once the WFG-006 portability format is decided at PRD level.

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
| AG-3 | PMD deletion policy | **Cannot delete** — PMD is an immutable, checksum-sealed (tamper-evident) clinical record; anonymize DB record only. Digital signing / non-repudiation is Phase-2 (FR12.4), not V1 — do not claim "signed/non-repudiable" until it ships. |
| AG-4 | Data portability export format | **DEFERRED pending WFG-006 PRD decision** (V-IMG-EXP-001, see §4 note). PMD covers clinical per-visit; patient-list CSV exists; bulk/multi-entity Art. 20 bundle blocked on an undecided portability format — not a P1 gap until PRD resolves WFG-006. |
| AG-5 | Session TTL (ADR-003) | **RESOLVED (decision C-3, 2026-06-12)** — PIN idle = **5 min** (`apps/dentalemon/src/lib/pin-session.ts` `INACTIVITY_TIMEOUT_MS`, in-memory, lost on reload); cloud session = **7 days** absolute (DB-stored, revoke → immediate 401). Documented in ADR-003 §Addendum. (Note: the session-expiry ADR is **ADR-003**; an earlier "ADR-007" citation here was a misnumber — ADR-007 is self-service onboarding.) |
| AG-6 / G-012 | PHI at-rest encryption | **SATISFIED-by-infra.** Control is storage-layer (transparent disk/volume / managed-Postgres + S3 SSE) encryption, defined in §1.1 — NOT column-level. Verified by a non-regressable startup attestation: `DB_AT_REST_ENCRYPTION` (`enabled`/`verified`) parsed in `services/api-ts/src/core/config.ts` (`config.database.atRestEncryption`) and asserted in the production boot guard — the server refuses to start if unattested. Evidence: `services/api-ts/src/core/config.test.ts` (V-DG-001 cases, RED-without/GREEN-with) + operator-set env (`.env.example`). Column-level encryption deferred as future defense-in-depth for a named ultra-sensitive subset only (§1.2). |
