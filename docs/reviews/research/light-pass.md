# Light-Pass Table-Stakes Research — Supporting Modules

Scope: industry must-haves only (table-stakes) for five supporting modules, benchmarked against leading dental PMS (Dentrix, Open Dental, Curve, CareStack, tab32). Lighter pass — not exhaustive.

Date: 2026-06-02

---

## Billing

### Table-stakes
- **Invoicing / ledger with adjustments**: per-patient running ledger, charges, payments, credits, write-offs, and manual adjustments; color-coded ledger entries are common ([Practice-Web/Open Dental ledger tooling](https://www.daydream.dental/blog-post/best-dental-practice-management-software-2025)).
- **Insurance claims (e-claims via clearinghouse)**: electronic claim submission, batch claims, real-time claim status tracking, and **automated secondary claim generation** are standard ([Open Dental batch + secondary claims](https://www.daydream.dental/blog-post/best-dental-practice-management-software-2025)).
- **Insurance estimation + eligibility**: real-time eligibility verification and per-procedure benefit/coverage estimation at treatment-plan time, plus pre-authorization tracking ([Dentrix eligibility & claim tracking](https://www.daydream.dental/blog-post/best-dental-practice-management-software-2025)).
- **Fee schedules**: multiple fee schedules per provider/plan (UCR, PPO/contracted, cash) driving estimates and PPO write-off calculation ([Open Dental Fee Schedules](https://www.opendental.com/manual/feeschedules.html)).
- **Statements**: patient billing statements, batch statement runs, and EOB posting/reconciliation.
- **Aging / collections (AR)**: AR aging reports (30/60/90+) and collections follow-up workflows ([Open Dental AR aging](https://www.daydream.dental/blog-post/best-dental-practice-management-software-2025)).
- **Payment plans**: scheduled installment/payment-plan agreements tracked against the ledger.
- **Online payments / card processing**: integrated payments, autopay, and card-on-file ([Dentrix automated payments](https://www.dentrix.com/)).

### Likely gaps to check
PPO write-off automation, secondary-claim auto-generation, real-time eligibility, and EOB/ERA posting are the most likely missing/weak pieces vs. incumbents.

---

## Scheduling

### Table-stakes
- **Multi-provider / multi-operatory calendar**: appointments assigned to specific provider AND operatory/room; day/week/multi-column views ([Quo PMS scheduling teardown](https://www.quo.com/blog/dental-scheduling-software/)).
- **Color-coding**: appointments color-coded by type/provider/status for at-a-glance scheduling ([Quo](https://www.quo.com/blog/dental-scheduling-software/)).
- **Drag-and-drop reschedule**: move/resize appointments on the grid ([Quo](https://www.quo.com/blog/dental-scheduling-software/)).
- **Online / self-service booking**: patient-facing after-hours booking that syncs to the PMS calendar ([Picktime](https://www.picktime.com/resources/best-dental-appointment-scheduling-software-for-small-practices-in-2026/), [iDentalSoft](https://www.identalsoft.com/features/appointment-scheduling)).
- **Automated reminders + recall**: SMS/email/voice reminders and recall (continuing-care) lists for hygiene/periodic recare; cited as the primary no-show reduction lever ([Dentra](https://www.getdentra.com/resources/guides/dental-scheduling-software)).
- **Waitlist / ASAP fill**: short-notice/waitlist automation to fill cancellations ([Viva AI](https://www.getviva.ai/dental-scheduling-software/), [Dentra](https://www.getdentra.com/resources/guides/dental-scheduling-software)).
- **Check-in / queue**: patient check-in / front-desk status flow (arrived → seated → checkout).
- **No-show / cancellation handling**: status tracking, no-show flags, and confirmation states.

### Likely gaps to check
Recall (continuing-care) engine, waitlist/ASAP auto-fill, and confirmation/no-show status lifecycle are the features most commonly under-built in non-incumbent apps.

---

## Org / Auth & Staff

### Table-stakes
- **Role-based permissions via user groups**: granular per-feature permissions assigned to user groups, not just individuals ([Open Dental Permissions](https://opendental.com/manual/permissions.html), [Security](https://www.opendental.com/manual/security.html)).
- **Multi-location**: clinic/location restrictions per user; users limited to assigned clinics ([Open Dental Security — clinic restrictions](https://www.opendental.com/manual/security.html)).
- **PIN / quick user-switch**: fast clinical-staff login/switch at shared chairside workstations (a standard chairside expectation; verify against incumbents).
- **Access audit trail**: log every login/logoff and record edits; "Audit Trail logs entries every time a user logs in, logs off or closes" ([Open Dental Security](https://www.opendental.com/manual/security.html)).
- **Password rules + auto-logoff**: password strength enforcement, automatic log-off, and account lock dates for HIPAA workstation security ([Open Dental Security](https://www.opendental.com/manual/security.html)).
- **Provider credentials**: provider records carrying license/NPI/credential data used on claims and clinical records.

### Likely gaps to check
PIN/quick-switch chairside login, per-location user scoping, and edit-level (not just login-level) audit trail are the riskiest to be missing.

---

## Patient Management

### Table-stakes
- **Registration & demographics**: name, address, employer, contacts, insurance, notes, continuing-care status held on the patient/family record ([Dentrix Family File](https://hsps.pro/Dentrix/Help/index.htm)).
- **Search + duplicate dedup/merge**: patient search plus add/edit/**merge** and move-between-family operations to resolve duplicates ([Dentrix merge/move patients](https://www.youtube.com/watch?v=BNb9t-w_vgQ)).
- **Family / household linkage**: family-file model linking household members, guarantor, and shared billing ([Dentrix Family File](https://hsps.pro/Dentrix/Help/index.htm)).
- **Recall / continuing-care status**: per-patient recare due tracking feeding the scheduling recall engine ([Dentrix continuing care](https://hsps.pro/Dentrix/Help/index.htm)).
- **Communication preferences + consent**: contact-channel preferences and consent capture for SMS/email/marketing ([mConsent](https://mconsent.net/dental-practice-management-software/)).
- **Document storage**: attach scanned forms, IDs, insurance cards, signed consents to the patient record.

### Likely gaps to check
Duplicate detection + merge tooling and guarantor/household billing linkage are the most likely under-built; verify consent is per-channel, not a single flag.

---

## PMD / Audit (Portable Records + Audit Log)

### Table-stakes
- **Access logging (HIPAA § 164.312(b))**: record who accessed which PHI record, when, and the action (read/create/modify/delete), plus logins, failed logins, permission changes, and **access to the audit log itself** ([Aptible — HIPAA audit log events](https://www.aptible.com/hipaa/audit-log-retention)).
- **6-year retention, retrievable**: audit logs and required HIPAA documentation must be retained and retrievable for **at least 6 years** (longer if state law requires) ([Aptible](https://www.aptible.com/hipaa/audit-log-retention), [HIPAA Journal retention](https://www.hipaajournal.com/hipaa-retention-requirements/), [Kiteworks](https://www.kiteworks.com/hipaa-compliance/hipaa-audit-log-requirements/)).
- **PHI-export / data-movement logging**: log exports and third-party transmissions of PHI ([Aptible](https://www.aptible.com/hipaa/audit-log-retention)).
- **Portable / continuity-of-care record export**: ability to export a patient's record for transfer/continuity of care (records-release / continuity-of-care document) — a patient-rights and care-transition expectation under HIPAA right-of-access.
- **Tamper-resistance / centralization**: centralized, append-only/protected audit storage rather than rotating container logs ([Censinet](https://censinet.com/perspectives/hipaa-audit-logs-key-requirements-for-phi-transfers)).

### Likely gaps to check
Field-/record-level PHI *access* logging (most apps only log writes), 6-year retention guarantee with tamper-resistance, and a true portable continuity-of-care export are the highest-risk gaps.

---

### Sources
- Open Dental: [Security](https://www.opendental.com/manual/security.html), [Permissions](https://opendental.com/manual/permissions.html), [Fee Schedules](https://www.opendental.com/manual/feeschedules.html)
- Dentrix: [Platform](https://www.dentrix.com/), [Help/Family File](https://hsps.pro/Dentrix/Help/index.htm)
- PMS comparisons: [Daydream 2025](https://www.daydream.dental/blog-post/best-dental-practice-management-software-2025), [Quo 2026](https://www.quo.com/blog/dental-scheduling-software/), [Dentra](https://www.getdentra.com/resources/guides/dental-scheduling-software), [Viva AI](https://www.getviva.ai/dental-scheduling-software/), [Picktime](https://www.picktime.com/resources/best-dental-appointment-scheduling-software-for-small-practices-in-2026/), [iDentalSoft](https://www.identalsoft.com/features/appointment-scheduling), [mConsent](https://mconsent.net/dental-practice-management-software/)
- HIPAA audit/retention: [Aptible](https://www.aptible.com/hipaa/audit-log-retention), [HIPAA Journal](https://www.hipaajournal.com/hipaa-retention-requirements/), [Kiteworks](https://www.kiteworks.com/hipaa-compliance/hipaa-audit-log-requirements/), [Censinet](https://censinet.com/perspectives/hipaa-audit-logs-key-requirements-for-phi-transfers)
