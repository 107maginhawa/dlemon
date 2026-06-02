# PMD / Audit (Portable Records + Audit Log) — Standards & Experience Review
> Review date 2026-06-02 · Depth: LIGHT (table-stakes)

## 1. What we have
Strong compliance backbone. **Audit log** (`dental-audit/`): append-only store with DB trigger denying row UPDATE/DELETE (`audit-immutability-db.test.ts`, `audit-append-only.test.ts`), PHI sanitized at a single seam (`audit-log.repo.ts`), viewer restricted to `dentist_owner` and the viewer read is **itself self-audited** (`getAuditEvents.ts:153`). PHI **reads** are logged, not just writes — e.g. `getDentalPatient.ts:87` writes a `patient.view` event; exports log `pmd.export` (`exportPMD.ts:68`) and patient export (`exportDentalPatients.ts:74`). **PMD** (Portable Medical/Dental Document): generate/import/export per visit (`generatePMD.ts`, `importPMD.ts`, `exportPMD.ts`), imported PMDs immutable (`imported-pmd-immutable.test.ts`), checksum + signed-at on export envelope, **patient-self download allowed** (`exportPMD.ts` EF-PMD-007). **Retention** (`retention/`): seeded default policies (clinical/visit/attachment ~10y, prescription ~5y, appointment 1y, audit retain-forever) with a jurisdiction disclaimer; retention jobs (`retention/jobs/`). **Legal hold** (`dental-legalhold/`) and **erasure** (`dental-erasure/` — request/approve/reject, S3 delete, legal-hold-aware) round out data governance.

## 2. Table-stakes gaps
| Capability | Industry table-stakes | Our status | Evidence | Severity |
|---|---|---|---|---|
| PHI access logging (read/create/modify/delete + logins) | Who accessed which record, when, action | ✅ | `getDentalPatient.ts:87` `patient.view`; writes audited; logins via Better-Auth | — |
| Audit-log access self-logged | Access to the audit log itself is logged | ✅ | `getAuditEvents.ts:153` records ACCESSED scope/counts | — |
| 6-year retention, retrievable | ≥6y retention (longer per state) | ✅ | `retention-defaults.ts`: clinical 10y, audit retain-forever; disclaimer notes HIPAA 6y min | — |
| PHI-export / data-movement logging | Log exports & third-party transmissions | ✅ | `pmd.export` + patient `export` audit events | — |
| Portable / continuity-of-care export | Export patient record for transfer | ⚠️ | `exportPMD.ts` exports a **single visit's** PMD as JSON; **no whole-patient continuity-of-care bundle** across all visits | P2 |
| Tamper-resistance / centralization | Append-only/protected centralized store | ✅ | DB trigger blocks UPDATE/DELETE (`audit-immutability-db.test.ts`) | — |
| Export format portability | Standard interchange (FHIR/CCDA) for transfer | ⚠️ | Export is app-specific JSON envelope, not FHIR/CCDA — limits inter-provider portability | P2 |

## 3. Notable findings
- **[P2] PMD export is per-visit, not a whole-patient continuity-of-care record.** `exportPMD.ts` exports one visit's PMD. A true records-release / care-transition export should bundle the patient's full longitudinal record. Recommend a patient-level export aggregating all visit PMDs.
- **[P2] Export format is proprietary JSON, not FHIR/CCDA.** Fine internally, but real continuity-of-care to another provider expects a standard interchange format. Consider a FHIR export once integrations are needed.
- **Strengths to preserve:** read-level PHI access logging (rare — most apps log only writes), DB-enforced append-only immutability, self-audited audit viewer, legal-hold-aware erasure, and seeded retention policies with jurisdiction disclaimer. This module materially exceeds typical non-incumbent baseline.

## 4. Carousel relevance
Moderate. The audit log is inherently a **per-patient access/change timeline** and could power a "who touched this record, when" longitudinal view. PMD snapshots per visit are themselves point-in-time records that align with the snapshot-over-time model.

---

## Cross-module backlog digest (all P0–P2)

| # | Module | Sev | Finding |
|---|--------|-----|---------|
| 1 | Scheduling | **P1** | Dashboard appointment fetch 400s — `use-dashboard-summary.ts:69-70` sends `date=`, API needs `date_from`/`date_to` (calendar hook is correct; only morning briefing broken). |
| 2 | Scheduling | **P1** | No automated reminder/recall dispatch — only one booking notif; recall `status='sent'` is manual; no scheduled job. |
| 3 | Scheduling | **P1** | No online / self-service patient booking. |
| 4 | Scheduling | P2 | No waitlist/ASAP cancellation-fill matcher. |
| 5 | Scheduling | P2 | No explicit "confirmed" status between scheduled and check-in. |
| 6 | Scheduling | P2 | Drag-and-drop reschedule UX unverified (server reschedule exists). |
| 7 | Billing | **P1** | No insurance e-claims (clearinghouse/EDI/837, batch, secondary auto-gen) — claims are manual drafts. |
| 8 | Billing | **P1** | No real-time eligibility / per-procedure benefit estimation. |
| 9 | Billing | **P1** | No EOB/ERA posting & reconciliation. |
| 10 | Billing | **P1** | No PPO contractual write-off automation. |
| 11 | Billing | P2 | Collections is period totals, not 30/60/90+ AR aging buckets. |
| 12 | Billing | P2 | Single flat fee schedule per branch (no UCR/PPO/cash tiers). |
| 13 | Billing | P2 | Statements per-patient only; no batch statement run. |
| 14 | Billing | P2 | Online payments / card-on-file not dental-wired (unconfirmed). |
| 15 | Patient | **P1** | No household / guarantor / family-file model. |
| 16 | Patient | **P1** | Consent is a single registration boolean, not per-channel (SMS/email/marketing). |
| 17 | Patient | P2 | Merge/unmerge exist but no duplicate-candidate detection or move-between-family. |
| 18 | Org/Auth | P2 | PIN session drops crossing `_workspace`↔`_dashboard` route trees (chairside friction). |
| 19 | Org/Auth | P2 | Roles coarse/hard-coded; no per-feature permission grid. |
| 20 | Org/Auth | P2 | Auto-logoff / idle session timeout unverified. |
| 21 | Org/Auth | P2 | Provider NPI/license credential fields unconfirmed. |
| 22 | PMD/Audit | P2 | PMD export is per-visit, not a whole-patient continuity-of-care bundle. |
| 23 | PMD/Audit | P2 | Export format proprietary JSON, not FHIR/CCDA. |

No P0s found. Strongest module by far: PMD/Audit (read-level PHI logging + DB-enforced immutability + retention + legal-hold/erasure). Biggest strategic gap: billing insurance revenue cycle (4×P1) and scheduling automation (3×P1).
