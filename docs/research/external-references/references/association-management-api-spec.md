# Association Management API — Comprehensive Reference Spec

**Version:** 1.0.0-draft  
**Date:** 2026-04-16  
**Format:** Lightweight PRD (entities + workflows + business rules + state machines + endpoints)  
**Purpose:** Handoff document for AI-assisted API generation. Covers all 57 domains of a comprehensive association management system.  
**Output target:** Single AI-readable API spec markdown at `/association-management-api-spec.md`

---

## How to Use This Document

This document is the **domain skeleton** for generating a full AI-readable API spec. For each domain:

1. Use the **Key Entities** to define canonical schemas with typed fields, required markers, and descriptions
2. Use the **Key Workflows** to derive state machine transitions and use-case mappings
3. Use the **Key Business Rules** to populate `x-business-rules`, `x-invariants`, and field-level validations
4. Use the **State Machine** to define status enums and allowed transitions
5. Use the **Key Endpoints** to derive operationIds, methods, paths, and role annotations
6. Add request/response examples, error shapes, and FHIR mapping notes per the guide

**Do not invent** entities, business rules, or state machines not listed here. Mark gaps as `UNKNOWN` or `REQUIRES_DECISION`.

---

## AI Instruction Block

> Generate APIs only from explicitly defined requirements in this document.  
> Do not invent fields, workflows, business rules, state transitions, or permissions.  
> If something is missing, mark it as `UNKNOWN` or `REQUIRES_DECISION`.  
> Use canonical schemas, strict typing, camelCase naming, and ISO 8601 timestamps.  
> Standard error shape: `{ code, message, details }`.  
> Standard ID format: `string` (CUID or UUID — specify per domain).  
> All timestamps: ISO 8601 UTC (`createdAt`, `updatedAt`).  
> All entities include: `id`, `tenantId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

---

## FHIR Mapping Strategy

> Core Shared domains map to FHIR R4 where a clean 1:1 resource exists. Association-native domains have no FHIR mapping by design — these represent association primitives (dues, governance, credits, PAC, grants) that FHIR does not model. Where a partial export path exists (e.g., credentials → `DocumentReference`), it is noted as optional. The `Person` base resource is preferred over `Patient` for association member identity — `Practitioner` + `PractitionerRole` are layered as profile extensions for members who practice.

---

## Jurisdiction Posture

> This specification is jurisdiction-neutral. Regulatory and integration details that vary by country — tax receipt formats, election commission filings, payment gateways, data privacy regimes — appear inline as examples tagged with their jurisdiction (e.g., `BIR 2322 (PH)`, `IRS 501(c)(3) (US)`, `T3010 (CA)`). Deployments in other jurisdictions substitute equivalent values via configuration. Appendix A enumerates jurisdiction-specific `REQUIRES_DECISION` items.

---

## Terminology Lock

> This spec uses canonical association-management terminology. Locked terms: `Association` (top-level tenant), `Organization` (chapter/society/national body), `Member` (person with active Membership), `Officer` (President/Treasurer/Secretary), `Dues` (periodic membership payment), `Fund Allocation` (configurable split), `Credit Entry` (AUTO or MANUAL), `Credit Cycle` (per-member, 1/2/3-yr), `Training` (credit-bearing), `Event` (social/governance), `Membership Status` (computed from `duesExpiryDate`). Synonyms MUST NOT be introduced.

---

## Table of Contents

### Core Shared Health Domains (1–17)
1. [Person & Member Identity Profile](#1-person--member-identity-profile)
2. [Forms, Surveys & Questionnaires](#2-forms-surveys--questionnaires)
3. [Interaction & Engagement Timeline](#3-interaction--engagement-timeline)
4. [Practitioner](#4-practitioner)
5. [Organization & Multi-Tier Hierarchy](#5-organization--multi-tier-hierarchy)
6. [Staff Workforce](#6-staff-workforce)
7. [Calendar & Scheduling](#7-calendar--scheduling)
8. [Fee Schedules & Pricing](#8-fee-schedules--pricing)
9. [Billing & Financial](#9-billing--financial)
10. [Document Management](#10-document-management)
11. [Communication](#11-communication)
12. [Notifications](#12-notifications)
13. [Consent & Preferences](#13-consent--preferences)
14. [Audit & Compliance](#14-audit--compliance)
15. [Auth & Access Control](#15-auth--access-control)
16. [Reporting & Analytics](#16-reporting--analytics)
17. [Data Import / Export](#17-data-import--export)

### Association-Specific Member Lifecycle (18–37)
18. [Individual Membership & Lifecycle](#18-individual-membership--lifecycle)
19. [Group & Institutional Memberships](#19-group--institutional-memberships)
20. [Dues, AR & Dunning](#20-dues-ar--dunning)
21. [Chapter Affiliations](#21-chapter-affiliations)
22. [Elections & Ballots](#22-elections--ballots)
23. [Officer Terms & Succession](#23-officer-terms--succession)
24. [Committees & Working Groups](#24-committees--working-groups)
25. [Board Governance](#25-board-governance)
26. [Member Directory](#26-member-directory)
27. [Credentials & Digital IDs](#27-credentials--digital-ids)
28. [Professional Licensing](#28-professional-licensing)
29. [Certification Programs](#29-certification-programs)
30. [Accredited Provider Registry](#30-accredited-provider-registry)
31. [CE Credits & Credit Cycles](#31-ce-credits--credit-cycles)
32. [Ethics, Discipline & Attestations](#32-ethics-discipline--attestations)
33. [Awards, Scholarships & Recognition](#33-awards-scholarships--recognition)
34. [Grants Management](#34-grants-management)
35. [Prospect & Non-Member CRM](#35-prospect--non-member-crm)
36. [Advocacy, PAC & Action Center](#36-advocacy-pac--action-center)
37. [Fundraising, Donations & Tax Receipts](#37-fundraising-donations--tax-receipts)

### Association Operations (38–52)
38. [Events Management](#38-events-management)
39. [Training & Learning Activities](#39-training--learning-activities)
40. [Learning Management](#40-learning-management)
41. [Conference & Session Management](#41-conference--session-management)
42. [Abstracts & Peer Review](#42-abstracts--peer-review)
43. [Exhibitors & Sponsorship](#43-exhibitors--sponsorship)
44. [Volunteer Management](#44-volunteer-management)
45. [Job Board & Career Services](#45-job-board--career-services)
46. [Mentorship Matching](#46-mentorship-matching)
47. [Publications & Journal Management](#47-publications--journal-management)
48. [Community Forums & SIGs](#48-community-forums--sigs)
49. [Member Benefits Marketplace](#49-member-benefits-marketplace)
50. [Knowledge Library & Resource Hub](#50-knowledge-library--resource-hub)
51. [Member Portal & Self-Service](#51-member-portal--self-service)
52. [Marketing Automation & Campaigns](#52-marketing-automation--campaigns)

### Integration & Interoperability (53–57)
53. [FHIR / HL7 Interoperability](#53-fhir--hl7-interoperability)
54. [Webhook & Event Subscriptions](#54-webhook--event-subscriptions)
55. [External System Connectors](#55-external-system-connectors)
56. [Task & Workflow Automation](#56-task--workflow-automation)
57. [AI Agents & Copilots](#57-ai-agents--copilots)

---

## Domain Glossary

| Term | Definition |
|---|---|
| **Association** | Top-level tenant — a professional or trade association such as a dental, medical, or nursing society |
| **Organization** | Operational unit within an Association — chapter, regional society, national body, or special interest group |
| **Chapter** | An Organization of type chapter — the primary sub-unit members affiliate with |
| **Member** | A Person with at least one active Membership record in an Organization |
| **Membership** | The formal enrollment relationship between a Person and an Organization, governed by dues and tier |
| **Membership Status** | Computed value derived from `duesExpiryDate` — Active, Grace, or Lapsed — never stored |
| **Officer** | An elected or appointed member in a formal governance role — President, Treasurer, or Secretary |
| **Dues** | Periodic membership payment (annual or term-based) owed to the Association or its Organizations |
| **Fund Allocation** | Configurable split of a Dues payment across named funds — last fund absorbs rounding |
| **Credit Entry** | A single CE/CPD credit record — AUTO (system-generated from attendance) or MANUAL (officer-entered) |
| **Credit Cycle** | A per-member time window (1, 2, or 3 years from registration date) in which credits accumulate |
| **CE / CPD** | Continuing Education or Continuing Professional Development — credit-bearing learning required for license renewal |
| **Training** | A credit-bearing learning activity — seminar, workshop, convention, webinar — internal default type |
| **Event** | A social or governance activity — assembly, induction, mission — non-credit internal default type |
| **Grace Period** | Configurable window after Membership expiry during which the member retains active-equivalent access |
| **Lapsed** | Membership state reached when payment is not received within the Grace Period |
| **Proxy Vote** | A vote cast on behalf of an absent member in an election or governance meeting, subject to bylaws rules |
| **Quorum** | Minimum number of eligible voters or committee members required for governance decisions to be valid |
| **Term of Office** | Defined period during which an elected or appointed Officer holds a specific Position |
| **LOI** | Letter of Intent — a short pre-proposal submitted before a full grant or abstract application |
| **SIG** | Special Interest Group — a member-organized sub-community focused on a shared topic |
| **PAC** | Political Action Committee — a separately accounted fund used for regulated advocacy contributions |
| **501(c)** | US tax-exempt organization designation for associations and nonprofits |
| **Tax Receipt** | Jurisdiction-specific acknowledgement document issued for donations, with sequential numbering |
| **Affinity Program** | Negotiated benefit arrangement with an external partner offering discounted services to members |
| **DOI** | Digital Object Identifier — persistent identifier for journal articles, assigned by CrossRef |
| **SCORM** | Shareable Content Object Reference Model — e-learning content packaging standard (v2 integration) |
| **xAPI** | Experience API — learning activity tracking standard, formerly Tin Can (v2 integration) |
| **HMAC-rotating QR** | Anti-sharing check-in code that regenerates every 60 seconds using an HMAC-SHA256 signature |
| **Polymorphic Activity** | An entity reference (Event, Training, or ConferenceSession) used as the source of a Credit Entry |
| **Dunning** | Automated sequence of overdue payment reminders sent to members with outstanding dues invoices |
| **Aging Bucket** | Categorization of outstanding invoices by days overdue — current, 30, 60, or 90+ days |

---

## Cross-Domain Entity Map

```
Association (1) ──── Organization (many)
Organization (1) ──── Organization (many)          // multi-tier: region → chapter → sub-chapter
Organization (1) ──── Membership (many)
Organization (1) ──── StaffMember (many)
Organization (1) ──── OrgConfig (1)
Person (1) ──── Membership (many)                  // primary + secondary affiliations
Person (1) ──── Practitioner (0..1)                // profile extension
Person (1) ──── ProfessionalLicense (many)
Person (1) ──── CreditEntry (many)
Person (1) ──── ConsentRecord (many)
Person (1) ──── DirectoryProfile (0..1)
Person (1) ──── PortalUser (0..1)
Membership (1) ──── MembershipApplication (0..1)
Membership (1) ──── DuesInvoice (many)
Membership (1) ──── ChapterAffiliation (many)
DuesInvoice (1) ──── Payment (many)
DuesInvoice (1) ──── FundAllocation (many)         // last fund absorbs rounding
Donation (1) ──── TaxReceipt (0..1)                // sequential numbering per fiscal year
PACContribution (1) ──── PACLedger (1)             // segregated from general funds
CreditCycle (1) ──── CreditEntry (many)
CreditEntry (1) ──── Activity (1, polymorphic: Event | Training | ConferenceSession)
CreditEntry (1) ──── CreditCarryOver (0..1)
Event (1) ──── EventRegistration (many)
EventRegistration (1) ──── CheckIn (0..1)
Training (1) ──── TrainingEnrollment (many)
Training (1) ──── QRCheckInSecret (1)              // HMAC-rotating 60s
Conference (1) ──── Session (many)
Session (1) ──── Speaker (many)
Session (1) ──── AbstractSubmission (0..1)
Election (1) ──── Candidate (many)
Election (1) ──── Ballot (many)
OfficerTerm (1) ──── Position (1)
Committee (1) ──── CommitteeSeat (many)
CommitteeSeat (1) ──── Person (1)
CredentialDocument (*) ──── Person (1)             // HMAC-signed, public untennanted verify
Document (*) ──── Any entity (polymorphic attachment)
AuditLog (*) ──── Any entity (polymorphic)
WebhookSubscription (1) ──── WebhookDelivery (many)
WorkflowTrigger (1) ──── WorkflowRun (many)
AIAgentTask (*) ──── Any entity (polymorphic context)
```

---

## Core Shared Health Domains

> Vertical-agnostic. These domains contain no association-specific logic and are intended to be identical in shape to other Health API Hub verticals (dental, hospital). Per-domain FHIR mappings are noted inline.

---

### 1. Person & Member Identity Profile

**Category:** Core Shared  
**FHIR Mapping:** `Person`; `Practitioner` + `PractitionerRole` layered as profile extensions

**Purpose:** Core identity record for any individual participating in the ecosystem — professional members, students, retirees, guests, and staff. Anchors all downstream records including Memberships, Credentials, registrations, and billing.

**Key Entities:** `Person`, `PersonProfile`, `PersonContact`, `PersonPrivacySettings`, `PersonPreference`

**Key Workflows:**
- Register Person → complete profile → attach photo → set privacy preferences → activate
- Update profile fields → audit logged → downstream projections refreshed
- Deactivate on departure (active downstream records must be resolved first)
- Merge duplicate records → target retains all relationships → source archived

**Key Business Rules:**
- Primary email must be unique per tenant
- Profile photo validated for file type and size (configurable)
- Privacy settings govern directory visibility per field
- Deactivated persons cannot log in or transact
- Merge requires elevated role and produces an immutable audit trail

**State Machine:** `pending_verification` → `active` → `inactive` | `suspended` | `merged`

**Key Endpoints:**
- `listPersons` — filter by tenant, status, tag
- `createPerson` — register new Person
- `getPersonById` — full profile with relationships
- `updatePerson` — patch profile fields
- `deactivatePerson` — soft deactivate
- `uploadPersonPhoto` — multipart upload
- `getPersonTimeline` — cross-domain activity feed
- `mergePersons` — combine two Person records
- `exportPersonData` — data-portability export
- `listPersonRelationships` — affiliations, profile extensions, contacts

---

### 2. Forms, Surveys & Questionnaires

**Category:** Core Shared  
**FHIR Mapping:** `Questionnaire`, `QuestionnaireResponse`

**Purpose:** Generic forms engine supporting onboarding, applications, post-activity evaluations, satisfaction surveys, and compliance attestations. Distinguishes identified and anonymous response modes.

**Key Entities:** `FormTemplate`, `FormField`, `FormSubmission`, `FormResponse`, `FormAggregation`

**Key Workflows:**
- Create template → define fields → publish → distribute to audience → collect responses → aggregate → export
- Anonymous survey → PersonId omitted at submission → aggregated only
- Evaluation linked to activity → auto-distribute after completion → response window enforced
- Template version bump → prior version frozen → new version published

**Key Business Rules:**
- Anonymous forms must not store PersonId or device identifiers
- Submissions after response window are rejected
- Required fields validated server-side
- Aggregations computed at query time — not cached
- Published templates are immutable; edits require a new version

**State Machine:**  
`FormTemplate`: `draft` → `published` → `closed` → `archived`  
`FormSubmission`: `in_progress` → `submitted` → `processed`

**Key Endpoints:**
- `listFormTemplates` — by category, status
- `createFormTemplate` — define form
- `publishFormTemplate` — open for responses
- `closeFormTemplate` — stop accepting responses
- `listFormSubmissions` — by template, by respondent
- `createFormSubmission` — start a response
- `submitFormResponse` — finalize
- `getFormAggregation` — summary statistics
- `exportFormResponses` — CSV/JSON
- `previewFormTemplate` — render without persisting

---

### 3. Interaction & Engagement Timeline

**Category:** Core Shared  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Read-side projection of all activity a Person has had with the tenant — logins, attendance, payments, announcements read, course completions, volunteer hours, and communications received. Powers 360-degree views and engagement scoring.

**Key Entities:** `InteractionEvent`, `EngagementScore`, `ActivitySummary`, `TimelineEntry`, `EngagementBucket`

**Key Workflows:**
- Source domains emit system events → captured as `InteractionEvent`s → aggregated into `EngagementScore`
- Elevated role queries a Person timeline for review
- Downstream AI segmentation reads `EngagementScore` for targeting (see Domain 57)
- Score recomputed on configurable schedule → versioned

**Key Business Rules:**
- `InteractionEvent`s are immutable once written; corrections via compensating events only
- `EngagementScore` recomputed on schedule (configurable period)
- Timeline is read-only from the API surface — no direct writes
- Events from all source domains contribute via polymorphic source reference
- Retention follows Audit policy (see Domain 14)

**State Machine:** No state machine — append-only event log; `EngagementScore.version` increments on recomputation

**Key Endpoints:**
- `getPersonTimeline` — activity feed with filters
- `listTimelineEvents` — paginated
- `getEngagementScore` — current period
- `listEngagementScoreHistory` — trend
- `getActivitySummary` — rollup by category
- `listTopEngagedPersons` — leaderboard
- `exportTimelineData` — analytics export
- `listInteractionEventsBySource` — forensic by domain

---

### 4. Practitioner

**Category:** Core Shared  
**FHIR Mapping:** `Practitioner`, `PractitionerRole`

**Purpose:** Professional profile extension on Person for individuals who practice a licensed profession. Includes specialties, NPI-equivalent identifier, and role assignments. Not every Person is a Practitioner.

**Key Entities:** `Practitioner`, `PractitionerRole`, `Specialty`, `PractitionerCredential`, `PractitionerAvailability`

**Key Workflows:**
- Link Person → create Practitioner profile → assign specialties → assign roles → attach credentials → activate
- Deactivate on retirement or license revocation
- Role change → `PractitionerRole` updated (prior roles retained)
- Credential expiry alert → license renewal triggered (see Domain 28)

**Key Business Rules:**
- Each Practitioner must have at least one active role
- NPI-equivalent identifier required for billing-enabled practitioners (REQUIRES_DECISION on enforcement by jurisdiction)
- Deactivated practitioners cannot be assigned to clinical or governance activities
- Credentials must include type, issuing body, issue date, and expiry date
- Specialties must reference the `Specialty` catalog

**State Machine:** `pending_onboarding` → `active` → `on_leave` → `inactive` | `terminated`

**Key Endpoints:**
- `listPractitioners` — filter by specialty, role, status
- `createPractitioner` — extend Person with practice profile
- `getPractitionerById` — full profile
- `updatePractitioner` — patch fields
- `deactivatePractitioner` — soft deactivate
- `listPractitionerRoles` — current and historical roles
- `assignPractitionerRole` — add role
- `listPractitionerCredentials` — attached credentials
- `addCredential` — issue or record credential
- `getPractitionerSchedule` — availability feed

---

### 5. Organization & Multi-Tier Hierarchy

**Category:** Core Shared  
**FHIR Mapping:** `Organization`, `Organization.partOf`

**Purpose:** Full organizational hierarchy spanning tenants, regions, operational units, and sub-units. Every data record is scoped to at least one Organization; `partOf` chains express parent-child relationships.

**Key Entities:** `Organization`, `OrganizationTier`, `BrandingProfile`, `OrgPublicPage`, `OrgConfig`

**Key Workflows:**
- Provision new Organization → set tier → link to parent → configure branding → publish public page → activate
- Change parent Organization → child records re-scoped
- Deactivate Organization → active downstream relationships suspended
- Configure unit-level settings (pricing, cycle length, fund allocation)

**Key Business Rules:**
- Each Organization has exactly one `OrganizationTier`
- Circular parent-child chains are forbidden
- Deactivated Organizations cannot accept new relationships
- `OrgConfig` values override tenant-level defaults
- `BrandingProfile` stores theme and optional custom domain (microsite scope REQUIRES_DECISION)

**State Machine:** `draft` → `active` → `suspended` → `archived`

**Key Endpoints:**
- `listOrganizations` — tenant tree
- `createOrganization` — provision
- `getOrganizationById` — full record
- `updateOrganization` — patch fields
- `suspendOrganization` — soft suspend
- `listChildOrganizations` — one level down
- `getOrganizationConfig` — effective config with inheritance
- `updateOrganizationConfig` — override a setting
- `getOrgPublicPage` — public-facing page (untennanted)
- `updateOrgBranding` — theme, logo, colors

---

### 6. Staff Workforce

**Category:** Core Shared  
**FHIR Mapping:** `Practitioner`, `PractitionerRole` (repurposed for workforce)

**Purpose:** Tenant employees and contractors — executive directors, program managers, accountants, IT admins. Distinct population from end users; separate onboarding, access provisioning, and offboarding flows.

**Key Entities:** `StaffMember`, `StaffRole`, `EmploymentTerm`, `StaffSchedule`, `StaffInvitation`

**Key Workflows:**
- Invite staff → send single-use token → accept → complete onboarding → activate
- Offboard → revoke all access tokens → terminate employment term
- Schedule staff for operational events
- Role change → prior role retained in history

**Key Business Rules:**
- Staff do not appear in end-user directories
- Staff roles are distinct from end-user roles — no overlap in RBAC definitions
- Offboarding revokes all active sessions before marking terminated
- `EmploymentTerm` must have a start date; end date optional
- Staff invitation tokens are single-use and expire after 7 days (configurable)

**State Machine:**  
`StaffInvitation`: `sent` → `accepted` | `expired` | `revoked`  
`StaffMember`: `onboarding` → `active` → `on_leave` → `terminated`

**Key Endpoints:**
- `listStaffMembers` — filter by role, status
- `inviteStaffMember` — send invitation
- `getStaffById` — full profile
- `updateStaff` — patch fields
- `offboardStaff` — terminate with access revocation
- `listStaffRoles` — roles catalog
- `assignStaffRole` — grant role
- `getStaffSchedule` — shifts and availability
- `updateStaffSchedule` — edit shifts
- `listPendingInvitations` — open invites

---

### 7. Calendar & Scheduling

**Category:** Core Shared  
**FHIR Mapping:** `Schedule`, `Slot`, `Appointment`

**Purpose:** Generic scheduling primitives underlying all time-based activities — governance meetings, events, training sessions, conference tracks, office hours, mentorship sessions. Provides conflict detection, time-zone handling, and iCal export.

**Key Entities:** `Schedule`, `Slot`, `Appointment`, `ScheduleBlock`, `Recurrence`

**Key Workflows:**
- Create Schedule for a resource → define available Slots → open for booking → Appointment created on claim
- Block Slots for maintenance or holidays
- Conflict detection on overlapping Appointments
- iCal feed generated per Schedule or per Person

**Key Business Rules:**
- Slot duration must match parent Schedule unit (configurable: 15 / 30 / 60 minutes)
- Overlapping Slots on the same Schedule are forbidden
- Cancelled Appointments return Slots to available
- All times stored UTC; displayed in Person locale
- Recurring Schedules generate Slots for a configurable future window (default 90 days)

**State Machine:**  
`Slot`: `available` → `booked` → `blocked` | `cancelled`  
`Appointment`: `pending` → `confirmed` → `completed` | `cancelled` | `no_show`

**Key Endpoints:**
- `listSchedules` — by resource
- `createSchedule` — define schedule
- `getScheduleById` — details
- `listSlots` — availability feed
- `createSlot` — manual slot insert
- `bookSlot` — claim a slot
- `cancelSlot` — release
- `createAppointment` — book with metadata
- `cancelAppointment` — cancel
- `getICalFeed` — export feed
- `listBlockedSlots` — holidays, maintenance
- `createScheduleBlock` — block a range

---

### 8. Fee Schedules & Pricing

**Category:** Core Shared  
**FHIR Mapping:** `ChargeItemDefinition`

**Purpose:** Configurable pricing catalog for subscriptions, registration fees, exam fees, and packaged offerings. Supports tier-based pricing, promotional codes, multi-currency, and org-level overrides.

**Key Entities:** `FeeSchedule`, `FeeItem`, `PricingTier`, `PromotionalCode`, `FeeOverride`

**Key Workflows:**
- Create `FeeSchedule` → define items → assign `PricingTier`s → activate
- Apply org-level `FeeOverride` → cascades to child Organizations if inheritance enabled
- Create `PromotionalCode` → set discount, redemption limit, expiry
- Validate and redeem promo at checkout → remaining uses decremented

**Key Business Rules:**
- `FeeSchedule` must be active before referenced by checkout
- `PricingTier` prices must be non-negative
- Promo codes single-use per Person unless marked multi-use
- Child-org overrides cannot exceed parent floor price (REQUIRES_DECISION on enforcement)
- Currency must match tenant-configured base currency
- Referenced items are deactivated, not deleted

**State Machine:**  
`FeeSchedule`: `draft` → `active` → `superseded` | `archived`  
`PromotionalCode`: `active` → `exhausted` | `expired` | `revoked`

**Key Endpoints:**
- `listFeeSchedules`
- `createFeeSchedule`
- `getFeeScheduleById`
- `updateFeeSchedule`
- `listFeeItems`
- `createFeeItem`
- `createPricingTier`
- `validatePromoCode` — precheck at cart
- `redeemPromoCode` — applied at checkout
- `listOrgFeeOverrides`
- `applyFeeOverride`

---

### 9. Billing & Financial

**Category:** Core Shared  
**FHIR Mapping:** `Invoice`, `Account`, `PaymentNotice`, `PaymentReconciliation`

**Purpose:** Core financial layer — invoice generation, payment capture, refunds, revenue recognition schedules, and GL export for all billable activities including subscriptions, registrations, exams, donations, and sponsorships.

**Key Entities:** `Invoice`, `InvoiceLineItem`, `Payment`, `Refund`, `RevenueSchedule`, `RecognitionEntry`, `LedgerEntry`

**Key Workflows:**
- Billable trigger → Invoice generated → sent to payer → Payment initiated → gateway webhook received → reconciled → receipt issued
- Refund requested → approved → gateway refund issued → Invoice credited
- Deferred revenue (multi-year subscriptions, advance registration) → `RevenueSchedule` created → `RecognitionEntry`s generated per period
- GL export → `LedgerEntry`s posted to accounting connector

**Key Business Rules:**
- Invoice totals are immutable once Payment is applied
- Refunds cannot exceed original Invoice total
- `RevenueSchedule` required for multi-year subscriptions and prepaid registrations
- `RecognitionEntry`s must sum to original Invoice amount
- GL export is idempotent — re-export of same period produces identical entries
- Webhook processing idempotent on gateway transaction ID
- Tax treatment determined by line item type (REQUIRES_DECISION on multi-jurisdiction)

**State Machine:**  
`Invoice`: `draft` → `issued` → `partially_paid` → `paid` → `overdue` | `voided` | `refunded`  
`Payment`: `pending` → `captured` → `settled` | `failed` | `refunded`

**Key Endpoints:**
- `listInvoices` — filter by status, payer
- `createInvoice`
- `getInvoiceById`
- `issueInvoice`
- `voidInvoice`
- `listPayments`
- `initiatePayment`
- `getPaymentById`
- `processRefund`
- `getRevenueSchedule`
- `listRecognitionEntries`
- `exportGLEntries` — to accounting connector
- `getFinancialSummary` — period rollup

---

### 10. Document Management

**Category:** Core Shared  
**FHIR Mapping:** `DocumentReference`, `Binary`

**Purpose:** Generic document store for tenant-wide files — policies, minutes, board books, handbooks, signed forms, uploaded media. Supports versioning, access-control tiers, and polymorphic attachment to any entity.

**Key Entities:** `Document`, `DocumentVersion`, `DocumentTag`, `DocumentAccess`, `DocumentAttachment`

**Key Workflows:**
- Upload document → classify → set access tier → attach to one or more entities → publish
- New version → prior version retained → current version pointer updated
- Access tier change → access log entry created
- Soft-delete with retention hold check

**Key Business Rules:**
- `DocumentAttachment` is polymorphic (`entityType` + `entityId` discriminator)
- Version history is immutable — versions cannot be deleted while document is active
- Access tiers: `public` | `tenant_only` | `unit_only` | `restricted` | `privileged`
- Retention policy enforced per category (minimum 7 years for financial)
- Binary storage via S3-compatible object store
- Size limits configurable per tenant

**State Machine:**  
`Document`: `draft` → `published` → `archived` | `deleted` (soft)  
`DocumentVersion`: `current` | `superseded`

**Key Endpoints:**
- `listDocuments`
- `uploadDocument` — multipart upload
- `getDocumentById`
- `updateDocumentMetadata`
- `publishDocument`
- `archiveDocument`
- `deleteDocument` — soft
- `listDocumentVersions`
- `uploadNewVersion`
- `attachDocument` — polymorphic attach
- `detachDocument`
- `getDocumentAccessLog`

---

### 11. Communication

**Category:** Core Shared  
**FHIR Mapping:** `Communication`, `CommunicationRequest`

**Purpose:** Transactional messaging dispatcher — one-off announcements, approval notices, payment reminders, system alerts. Handles multi-channel delivery (in-app, email, SMS, push) with templates and delivery tracking. Drip/campaign flows are handled by Marketing Automation (see Domain 52).

**Key Entities:** `Message`, `MessageTemplate`, `DeliveryRecord`, `Audience`, `CommunicationChannel`

**Key Workflows:**
- Create message → select template → define audience → schedule or send immediately → `DeliveryRecord`s created per recipient → status tracked
- Template rendered with merge fields → dispatched across configured channels
- Unsubscribe → channel preference updated (see Domain 13)

**Key Business Rules:**
- Transactional messages (receipts, password reset, security alerts) are exempt from unsubscribe
- Bulk sends are rate-limited per channel (configurable)
- Failed deliveries retried with exponential backoff (default 3 attempts)
- `DeliveryRecord`s retained for 90 days (configurable)
- Merge fields validated at template save time
- Audience size estimated before send confirmation

**State Machine:**  
`Message`: `draft` → `scheduled` | `sending` → `sent` → `partially_failed` | `failed`  
`DeliveryRecord`: `queued` → `delivered` | `failed` | `bounced`

**Key Endpoints:**
- `listMessages`
- `createMessage`
- `sendMessage`
- `scheduleMessage`
- `cancelScheduledMessage`
- `listMessageTemplates`
- `createMessageTemplate`
- `getDeliveryReport`
- `listDeliveryRecords`
- `updateChannelPreference`
- `previewMessage`

---

### 12. Notifications

**Category:** Core Shared  
**FHIR Mapping:** `Subscription` (delivery channel), `Communication` (dispatch)

**Purpose:** Real-time notification infrastructure — in-app badges, push notifications, email digests. Provides per-Person notification center, read/unread tracking, and configurable digest cadence.

**Key Entities:** `Notification`, `NotificationPreference`, `NotificationCenter`, `DigestJob`, `SubscriptionTopic`

**Key Workflows:**
- System event → `Notification` created per subscriber → pushed via configured channels → delivery logged
- Notification center opened → unread count cleared
- Digest scheduled → batches unread → sends summary → marks batch as digested

**Key Business Rules:**
- In-app notifications retained 30 days (configurable)
- Push tokens expire — stale tokens purged on delivery failure
- Digest runs on configurable schedule (daily/weekly)
- Topics are subscribable per Person
- Critical notifications bypass quiet hours
- Preferences per topic and per channel

**State Machine:**  
`Notification`: `unread` → `read` | `dismissed`  
`DigestJob`: `scheduled` → `running` → `sent` | `failed`

**Key Endpoints:**
- `listNotifications`
- `getNotificationById`
- `markNotificationRead`
- `markAllRead`
- `dismissNotification`
- `getNotificationPreferences`
- `updateNotificationPreferences`
- `listSubscriptionTopics`
- `subscribeToTopic`
- `unsubscribeFromTopic`
- `getUnreadCount`
- `triggerDigest`

---

### 13. Consent & Preferences

**Category:** Core Shared  
**FHIR Mapping:** `Consent`

**Purpose:** Data-processing consent management, channel opt-in/opt-out, and privacy preferences in compliance with applicable regimes (DPA 2012 [PH], GDPR [EU], HIPAA [US], CCPA [CA]). Records consent version and timestamp for audit.

**Key Entities:** `ConsentRecord`, `ConsentTemplate`, `ConsentVersion`, `PreferenceSet`, `UnsubscribeRecord`

**Key Workflows:**
- New Person → consent template presented → accept/decline each item → `ConsentRecord` created
- Template updated → new `ConsentVersion` → affected Persons re-prompted
- Unsubscribe → `UnsubscribeRecord` → honored across Communication and Marketing
- Data deletion request → legal minimums retained, other data soft-deleted

**Key Business Rules:**
- Required consents (ToS, privacy policy) must be accepted before account activation
- `ConsentRecord`s are immutable — withdrawal creates a new record with declined status
- Consents version-controlled — prior acceptances remain valid until re-prompt threshold
- Deletion requests must complete within 30 days (configurable per regime)
- Unsubscribes honored within 10 minutes

**State Machine:**  
`ConsentRecord`: `pending` → `accepted` | `declined` | `withdrawn`  
`ConsentTemplate`: `draft` → `active` → `superseded`

**Key Endpoints:**
- `listConsentTemplates`
- `createConsentTemplate`
- `publishConsentTemplate`
- `getPersonConsents`
- `recordConsent`
- `withdrawConsent`
- `listUnsubscribeRecords`
- `recordUnsubscribe`
- `resubscribe`
- `requestDataDeletion`
- `getDataDeletionStatus`
- `exportPersonConsents`

---

### 14. Audit & Compliance

**Category:** Core Shared  
**FHIR Mapping:** `AuditEvent`, `Provenance`

**Purpose:** Append-only audit log capturing all state-changing operations — who did what, when, and to which entity. Supports compliance reporting, tamper evidence via hash chain, and forensic investigation.

**Key Entities:** `AuditLog`, `AuditActor`, `AuditTarget`, `ComplianceReport`, `RetentionPolicy`

**Key Workflows:**
- Mutation operation → middleware auto-creates `AuditLog` entry → immutable
- Compliance report requested → query by actor / target / date range → export
- Retention policy applied → entries older than threshold purged (7 years financial; 3 years auth; configurable)
- Hash-chain verification → tamper detection

**Key Business Rules:**
- `AuditLog` entries are immutable — no update or delete
- Each entry captures actor (PersonId + role), action, target (entityType + entityId), IP, timestamp, outcome, metadata
- Financial records retained 7 years; auth events 3 years; others minimum 1 year
- Hash chain maintained for tamper detection
- Audit access restricted to admin roles

**State Machine:** No state machine — append-only log

**Key Endpoints:**
- `listAuditLogs`
- `getAuditLogById`
- `queryAuditLogs` — filter by actor, target, date
- `exportAuditLogs`
- `generateComplianceReport`
- `listRetentionPolicies`
- `updateRetentionPolicy`
- `getHashChainStatus`
- `purgeExpiredLogs` — admin only

---

### 15. Auth & Access Control

**Category:** Core Shared  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Authentication, session management, multi-factor authentication, RBAC/ABAC policy enforcement, and API key lifecycle. Governs all identity flows — staff, end users, portal users, and system integrations. Notes untennanted public endpoints where applicable (see Domain 27).

**Key Entities:** `Session`, `MfaToken`, `ApiKey`, `Role`, `Permission`, `AccessPolicy`

**Key Workflows:**
- Login → credentials validated → MFA challenged (if enabled) → session created → JWT issued
- Password reset → magic link sent → one-time token validated → password updated
- API key created → scoped to role + IP allowlist → usage tracked
- Session revoked → all tokens invalidated
- ABAC policy evaluated on every protected operation

**Key Business Rules:**
- Sessions expire after configurable idle timeout (default 8 hours for staff; 2 hours for portal — see Domain 51)
- MFA required for elevated roles (configurable)
- API keys scoped to least-privilege permissions
- Failed login attempts locked after threshold (default 5)
- Password complexity enforced per configurable policy
- Public credential verification (Domain 27) is explicitly untennanted — no auth header required
- Break-glass access requires MFA plus audit event

**State Machine:**  
`Session`: `active` → `expired` | `revoked`  
`ApiKey`: `active` → `rotated` | `revoked`  
`MfaToken`: `pending` → `verified` | `expired`

**Key Endpoints:**
- `login`
- `logout`
- `refreshToken`
- `requestPasswordReset`
- `resetPassword`
- `enableMfa`
- `disableMfa`
- `verifyMfa`
- `listSessions`
- `revokeSession`
- `createApiKey`
- `listApiKeys`
- `revokeApiKey`
- `listRoles`
- `assignRole`

---

### 16. Reporting & Analytics

**Category:** Core Shared  
**FHIR Mapping:** `MeasureReport` (optional)

**Purpose:** Queryable reporting layer for tenant health metrics. Supports multi-tier rollups from unit → region → tenant level, ad-hoc exports, scheduled dashboards, and BI warehouse feeds. Real-time counts always computed live.

**Key Entities:** `Report`, `ReportTemplate`, `ReportRun`, `Dashboard`, `HierarchyRollup`

**Key Workflows:**
- Define template → schedule report → run → output file generated → distributed to recipients
- Ad-hoc query → filters applied → export CSV/PDF
- Hierarchy rollups aggregated from child Organizations at request time
- Cross-unit dashboard visible only to tenant-level roles
- BI warehouse export via connector

**Key Business Rules:**
- `ReportRun`s are idempotent for the same date range
- Rollups recomputed per request — not cached
- Cross-unit data visible only to elevated roles
- PII fields redacted in non-admin exports
- Report outputs retained 2 years (configurable)
- Real-time counts (active records, open invoices) computed live — not from cache

**State Machine:**  
`ReportRun`: `queued` → `running` → `completed` | `failed`  
`Report`: `draft` → `scheduled` | `active` → `archived`

**Key Endpoints:**
- `listReports`
- `createReport`
- `getReportById`
- `runReport`
- `getReportRunStatus`
- `getReportRunOutput`
- `listDashboards`
- `createDashboard`
- `getDashboard`
- `getHierarchyRollup`
- `exportDataWarehouseFeed`
- `listReportTemplates`

---

### 17. Data Import / Export

**Category:** Core Shared  
**FHIR Mapping:** `Bundle`

**Purpose:** Bulk data ingestion and export — CSVs, JSON, vCard, iCal, FHIR Bundles. Supports async import jobs with validation, error reporting, partial-success semantics, and signed download URLs.

**Key Entities:** `ImportJob`, `ImportRow`, `ImportError`, `ExportJob`, `ExportTemplate`

**Key Workflows:**
- Upload file → validate schema → create `ImportJob` → process rows asynchronously → surface `ImportError`s → partial-success reported → confirmation email sent
- Export requested → `ExportJob` created → data extracted → file generated → signed URL issued
- FHIR Bundle export → entities mapped to FHIR resources → Bundle assembled → streamed

**Key Business Rules:**
- Validation runs before any rows commit (dry-run mode)
- Partial success allowed — valid rows commit, invalid rows surface in `ImportError`s
- Imports idempotent when rows have unique external IDs
- Export files expire after 24 hours (configurable)
- PII exports require elevated role
- FHIR exports require explicit FHIR scope in the API key
- Maximum import batch size: 10,000 rows (configurable)

**State Machine:**  
`ImportJob`: `pending` → `validating` → `processing` → `completed` | `failed` | `partial`  
`ExportJob`: `queued` → `running` → `ready` | `failed` | `expired`

**Key Endpoints:**
- `listImportJobs`
- `createImportJob`
- `uploadImportFile`
- `getImportJobStatus`
- `getImportErrors`
- `cancelImportJob`
- `listExportJobs`
- `createExportJob`
- `getExportJobStatus`
- `downloadExport`
- `listExportTemplates`
- `createExportTemplate`
- `createFhirBundleExport`

---

## Association-Specific Member Lifecycle

> The core association management value. Mostly `association-native (no direct FHIR mapping)`. These domains hold all member-specific logic and must not leak into the Core Shared layer above.

---

### 18. Individual Membership & Lifecycle

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Individual member lifecycle from application through lapse — tier and category, application workflow, renewal, grace, reinstatement. Membership Status (Active / Grace / Lapsed) is computed from `duesExpiryDate` and never stored.

**Key Entities:** `Membership`, `MembershipTier`, `MembershipCategory`, `MembershipApplication`, `RenewalCycle`

**Key Workflows:**
- Apply → submit application → review (auto or board approval by category) → approved → dues invoice generated (see Domain 20) → payment → Membership activated
- Annual renewal → invoice generated before expiry → payment → expiry extended
- Grace period begins on expiry → lapsed after configurable window
- Reinstatement: back-dues paid → Membership reactivated

**Key Business Rules:**
- Membership Status is computed from `duesExpiryDate` — never stored
- Categories configured per tier (student / active / retired / honorary / life / associate — REQUIRES_DECISION on taxonomy)
- Institutional categories require board approval
- Lapsed Members lose member-only directory and benefit access immediately
- Life Membership has no dues obligation after initial payment
- Grace length and lapse threshold configurable (default 30 days grace / 90 days lapsed)

**State Machine:**  
`MembershipApplication`: `draft` → `submitted` → `under_review` → `approved` | `rejected` | `withdrawn`  
`Membership`: `pending_payment` → `active` → `grace_period` → `lapsed` → `expired` | `suspended` | `terminated`

**Key Endpoints:**
- `listMemberships`
- `createMembershipApplication`
- `submitMembershipApplication`
- `reviewMembershipApplication`
- `getMembershipById`
- `renewMembership`
- `suspendMembership`
- `terminateMembership`
- `reinstateMembership`
- `transferMembership`
- `computeMembershipStatus`
- `getMembershipTimeline`
- `listMembershipTiers`
- `createMembershipTier`

---

### 19. Group & Institutional Memberships

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Corporate, employer, and institutional memberships where an Organization pays for a pool of seats allocated to named individuals. Distinct from individual membership in billing, seat lifecycle, and primary-contact delegation.

**Key Entities:** `InstitutionalMembership`, `SeatAllocation`, `SeatHolder`, `InstitutionalBillingContact`, `GroupInvoice`

**Key Workflows:**
- Employer applies → seat count configured → `GroupInvoice` issued to billing contact → payment → `SeatAllocation`s created
- Employer assigns seats to employees → each `SeatHolder` gains individual access
- Employee departs → seat vacated → returned to pool → available for reassignment
- Seat-count increase → addendum invoice generated

**Key Business Rules:**
- `GroupInvoice` billed to institutional billing address — not individual email (REQUIRES_DECISION on routing)
- Each seat holder has exactly one active `SeatAllocation`
- Seat holders inherit individual Member benefits while seat is active
- Employer can reassign unoccupied seats without additional payment
- Seat reduction with occupied seats requires officer approval
- Billing contact must be distinct from seat holders (REQUIRES_DECISION)

**State Machine:**  
`InstitutionalMembership`: `pending_payment` → `active` → `grace_period` → `lapsed` | `suspended` | `terminated`  
`SeatAllocation`: `unassigned` → `assigned` → `vacated`

**Key Endpoints:**
- `listInstitutionalMemberships`
- `createInstitutionalMembershipApplication`
- `reviewInstitutionalApplication`
- `getInstitutionalMembershipById`
- `listSeatAllocations`
- `assignSeat`
- `vacateSeat`
- `getSeatHolder`
- `updateBillingContact`
- `addSeats`
- `reduceSeats`
- `getGroupInvoice`
- `transferSeat`

---

### 20. Dues, AR & Dunning

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `Invoice` (sub-profile); `association-native` for AR/dunning

**Purpose:** Member-facing accounts receivable for Dues — configurable Fund Allocation splits, proration, auto-renewal, aging buckets, statement runs, and dunning letter sequences for overdue accounts.

**Key Entities:** `DuesConfig`, `DuesInvoice`, `FundAllocation`, `StatementRun`, `AgingBucket`, `DunningTemplate`, `CollectionsHandoff`

**Key Workflows:**
- Dues configured per Organization with fund splits → cycle triggered → `DuesInvoice` generated with line items per fund → `FundAllocation`s computed (last fund absorbs rounding) → payment collected
- Statement run → Members with open invoices receive aged statement (current / 30 / 60 / 90+ days)
- Dunning sequence: first notice → second notice → final notice → `CollectionsHandoff`
- Auto-renewal checkout created configurable days before expiry

**Key Business Rules:**
- Fund allocation splits must sum to 100%; last fund absorbs rounding
- Membership Status references `duesExpiryDate` on `DuesConfig` — not on the invoice (see Domain 18)
- Proration: partial-period joiners invoiced for remaining months
- `AgingBucket`s recomputed daily
- Dunning sequences configurable per tier
- `CollectionsHandoff` requires officer approval
- Dunning exempt for Life Members and Honorary Members

**State Machine:**  
`DuesInvoice`: `draft` → `issued` → `partially_paid` → `paid` | `overdue` → `written_off` | `collections`  
`DunningSequence`: `first_notice` → `second_notice` → `final_notice` → `collections` | `resolved`

**Key Endpoints:**
- `listDuesConfigs`
- `createDuesConfig`
- `getDuesInvoiceById`
- `listDuesInvoices`
- `issueDuesInvoice`
- `recordDuesPayment`
- `listFundAllocations`
- `getFundAllocationSummary`
- `runStatements`
- `getAgingReport`
- `sendDunningNotice`
- `escalateToDunning`
- `createCollectionsHandoff`
- `listDunningTemplates`

---

### 21. Chapter Affiliations

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `Organization.partOf` (structural); `association-native` for affiliation semantics

**Purpose:** Manages a Member's affiliations across multiple Organizations — designating primary and secondary chapters, tracking transfers, and computing royalty/rebate splits between the national body and chapters.

**Key Entities:** `ChapterAffiliation`, `AffiliationTransfer`, `RoyaltySplit`, `AffiliationHistory`

**Key Workflows:**
- Member joins a chapter → `ChapterAffiliation` created (primary or secondary) → national body notified
- Transfer request → source chapter releases → target chapter accepts → `AffiliationHistory` updated → `RoyaltySplit` recalculated for current cycle
- Secondary affiliation added → Member gains chapter-scoped access at secondary privilege level

**Key Business Rules:**
- Each Member has exactly one primary chapter affiliation
- Secondary affiliations unlimited (configurable max)
- Transfer requires both source and target officer approval
- Transfer effective date cannot be retroactive
- Chapter-to-national royalty/rebate splits configured per Organization and recalculated on transfer
- Primary affiliation change may re-scope Credit Entries (REQUIRES_DECISION)
- Affiliations retained in history — never deleted

**State Machine:**  
`ChapterAffiliation`: `pending` → `active` → `transferred` | `terminated`  
`AffiliationTransfer`: `requested` → `source_approved` → `target_approved` → `completed` | `rejected`

**Key Endpoints:**
- `listChapterAffiliations`
- `createChapterAffiliation`
- `getChapterAffiliationById`
- `setPrimaryAffiliation`
- `requestTransfer`
- `approveTransferBySource`
- `approveTransferByTarget`
- `rejectTransfer`
- `listAffiliationHistory`
- `getRoyaltySplitConfig`
- `updateRoyaltySplit`
- `addSecondaryAffiliation`
- `removeSecondaryAffiliation`

---

### 22. Elections & Ballots

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Governance elections — nomination campaigns, candidate management, secret balloting, quorum validation, tally finalization, and official certification of results. Covers annual Officer elections, bylaw referenda, and emergency votes. Officer Term creation is downstream in Domain 23.

**Key Entities:** `Election`, `Ballot`, `Candidate`, `Nomination`, `Vote`, `ElectionPosition`

**Key Workflows:**
- Create election → define positions → open nominations → Members submit/second nominations → nominations close → voting opens → eligible Members cast ballots → voting closes → tally → certification → Officer Terms created (Domain 23)
- Annulment requires board vote and triggers a new election

**Key Business Rules:**
- Ballot cryptography is signed ballots with audit trail — not homomorphic (REQUIRES_DECISION on upgrade path)
- Each eligible voter casts exactly one ballot (idempotency on `memberId` + `electionId`)
- Nomination requires a seconder
- Candidate acceptance is mandatory before ballot is published
- Quorum based on eligible-voter count (configurable threshold)
- Tallying is idempotent — multiple runs produce identical result
- Certified results are immutable

**State Machine:**  
`Election`: `draft` → `nominations_open` → `nominations_closed` → `voting_open` → `voting_closed` → `tallied` → `certified` | `annulled`  
`Nomination`: `submitted` → `seconded` → `accepted` | `declined` | `withdrawn`

**Key Endpoints:**
- `listElections`
- `createElection`
- `openNominations`
- `closeNominations`
- `submitNomination`
- `secondNomination`
- `acceptNomination`
- `openVoting`
- `castBallot` — idempotent
- `closeVoting`
- `tallyElection`
- `certifyElection`
- `annulElection`
- `getElectionResults`
- `listCandidates`

---

### 23. Officer Terms & Succession

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Tracks the lifecycle of each elected or appointed Officer — position catalog, term start and end, inauguration, resignation, removal, and succession events. Created by Elections (Domain 22) on certification, or by appointment for non-elected roles.

**Key Entities:** `OfficerTerm`, `Position`, `SuccessionEvent`, `AppointmentRecord`

**Key Workflows:**
- Election certified → `OfficerTerm` created in `elected` state → inauguration transitions to `seated` → `active` term begins
- Term nearing end → transition-planning alert → successor identified via new election or appointment
- Resignation → `SuccessionEvent` created → replacement appointed or emergency election triggered
- Removal by board → `SuccessionEvent` with cause documented

**Key Business Rules:**
- Each Position has at most one active `OfficerTerm` at a time
- Position catalog defines title, term length, eligibility, and max consecutive terms (REQUIRES_DECISION)
- Term cannot start before election certification date
- Removal requires board vote per bylaws
- Resignation effective date must be specified
- Term history retained permanently
- Acting Officers during vacancy may not get a formal term (REQUIRES_DECISION on acting-role provisioning)

**State Machine:**  
`OfficerTerm`: `elected` → `seated` → `active` → `term_ending` → `completed` | `resigned` | `removed`  
`Position`: `active` | `inactive`

**Key Endpoints:**
- `listOfficerTerms`
- `getOfficerTermById`
- `seatOfficer`
- `listActiveOfficers`
- `listPositions`
- `createPosition`
- `updatePosition`
- `recordResignation`
- `recordRemoval`
- `listSuccessionEvents`
- `appointOfficer`
- `getTermHistory`
- `listTermsByPosition`

---

### 24. Committees & Working Groups

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `Group` (loose); `association-native` for governance workflow

**Purpose:** Standing and ad-hoc committees, task forces, and working groups — formation, seat assignments, term limits, meeting scheduling, motion tracking, and action-item management. Board governance is handled separately (see Domain 25).

**Key Entities:** `Committee`, `CommitteeSeat`, `CommitteeMeeting`, `Motion`, `ActionItem`, `MeetingMinutes`

**Key Workflows:**
- Form committee → define seats → appoint or elect seat holders → schedule first meeting
- Meeting → agenda distributed → quorum confirmed → motions introduced → voted → minutes recorded → action items assigned → minutes published at next meeting
- Action items tracked to closure
- Term expires → seat vacancy opened → replacement appointed

**Key Business Rules:**
- Quorum must be confirmed before motions are voted (configurable threshold per committee)
- Minutes must be approved at next meeting before publishing
- Motions require mover and seconder
- Action items must have assignee and due date
- Term limits per seat configurable per committee
- Committee chairs are a designated seat subset with elevated permissions
- Agendas distributed at least 24 hours before meeting (configurable)
- Committees cannot be disbanded while motions are open

**State Machine:**  
`Committee`: `proposed` → `active` → `disbanded`  
`CommitteeSeat`: `vacant` → `filled` → `term_ending` → `vacated`  
`Motion`: `introduced` → `seconded` → `tabled` | `voted_on` → `passed` | `failed` | `withdrawn`

**Key Endpoints:**
- `listCommittees`
- `createCommittee`
- `getCommitteeById`
- `disbandCommittee`
- `listCommitteeSeats`
- `fillSeat`
- `vacateSeat`
- `scheduleCommitteeMeeting`
- `getMeetingById`
- `recordMotion`
- `voteOnMotion`
- `recordMeetingMinutes`
- `approveMeetingMinutes`
- `listActionItems`
- `updateActionItem`
- `confirmQuorum`

---

### 25. Board Governance

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Governing board operations — board books, consent agendas, privileged-scope documents, executive session management, and board resolutions. Board reuses Committee primitives (see Domain 24) with additional access restrictions.

**Key Entities:** `BoardMeeting`, `BoardBook`, `ConsentAgenda`, `ConsentAgendaItem`, `ExecutiveSession`, `BoardResolution`

**Key Workflows:**
- Board meeting scheduled → `BoardBook` assembled (reports, consent agenda, committee updates) → distributed to board only → consent agenda reviewed → non-contested items voted en bloc → contested items pulled for individual motion
- Executive session called → non-board members excluded → session recorded separately → rejoined in open session

**Key Business Rules:**
- Board books accessible only to board members and designated staff — no general officer access
- Consent agenda items approved by silence unless pulled
- Executive session minutes stored under privileged-scope flag (REQUIRES_DECISION on access policy)
- Board resolutions numbered sequentially per fiscal year
- Quorum for board votes configurable (default majority of seated board)
- Board-only documents inherit `privileged` tier from Document Management (Domain 10)
- No board member may vote where conflict of interest has been disclosed (see Domain 32)

**State Machine:**  
`BoardMeeting`: `scheduled` → `in_session` → `executive_session` → `adjourned`  
`BoardResolution`: `drafted` → `adopted` | `tabled` | `withdrawn`  
`BoardBook`: `draft` → `distributed` → `archived`

**Key Endpoints:**
- `listBoardMeetings`
- `createBoardMeeting`
- `getBoardMeetingById`
- `assembleBoardBook`
- `getBoardBook`
- `createConsentAgenda`
- `pullFromConsentAgenda`
- `callExecutiveSession`
- `endExecutiveSession`
- `recordBoardResolution`
- `listBoardResolutions`
- `getBoardOnlyDocuments`
- `confirmBoardQuorum`

---

### 26. Member Directory

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Searchable, privacy-governed Member directory exposing professional profiles to other Members. Per-field privacy state machine controls what each audience sees; search supports specialty, location, chapter, and certification filters.

**Key Entities:** `DirectoryProfile`, `DirectoryVisibility`, `DirectorySearchIndex`, `DirectorySearch`

**Key Workflows:**
- Member activates listing → sets per-field visibility → profile indexed → visible to permitted audience
- Member updates profile → index refreshed within configurable window
- Officer bulk export → PII redacted per export policy
- Search results honor per-field visibility at query time

**Key Business Rules:**
- Listing is opt-in — not automatic
- Per-field visibility state machine: `public` → `member_only` → `chapter_only` → `officer_only` → `hidden`
- Phone defaults to `officer_only`; email defaults to `member_only`
- Directory visible only to Active Members — not Grace or Lapsed
- Officer exports that include contact info require explicit role check
- Search must not expose `hidden` fields even to admin UI
- Index refresh SLA: within 5 minutes (configurable)
- HMAC-signed public directory share links expire after 24 hours (configurable)

**State Machine:**  
`DirectoryProfile`: `unlisted` → `listed` → `suspended`  
`VisibilityField` (per field): `public` | `member_only` | `chapter_only` | `officer_only` | `hidden`

**Key Endpoints:**
- `listDirectoryProfiles`
- `getDirectoryProfileById`
- `updateDirectoryProfile`
- `searchDirectory`
- `getDirectorySearchFilters`
- `updateFieldVisibility`
- `toggleDirectoryListing`
- `exportDirectory`
- `refreshDirectoryIndex`
- `getPublicDirectoryProfile` — untennanted, share-link only
- `listExpertiseTags`

---

### 27. Credentials & Digital IDs

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native`; optional `DocumentReference` export

**Purpose:** HMAC-signed verifiable digital IDs and certificates — Member ID cards, training completion certificates, and certification credentials. QR codes embed HMAC signatures rotated every 60 seconds for anti-sharing. Public verification endpoint is explicitly untennanted.

**Key Entities:** `CredentialDocument`, `DigitalID`, `QRPayload`, `VerificationLog`, `CredentialTemplate`

**Key Workflows:**
- Member qualifies → `CredentialDocument` generated from template → HMAC signature computed → QR embedded → PDF rendered and stored → issued
- Public verification: scanner presents QR → untennanted endpoint validates HMAC → returns credential status with no PII
- Template updated → existing credentials not regenerated until explicit reissue
- Credential revoked → public verification returns `revoked`

**Key Business Rules:**
- HMAC key rotates every 60 seconds server-side
- Verification endpoint returns `valid` / `revoked` / `expired` / `unrecognized` — no PII in response
- Issued credentials are immutable — amendments produce new linked `CredentialDocument`
- Offline verification app deferred to v2
- Templates are versioned
- PDFs stored via object storage
- Digital ID card and training certificate are distinct `CredentialDocument` types
- Verification requests logged in `VerificationLog` (rate-limited 100/min per IP)

**State Machine:**  
`CredentialDocument`: `generating` → `issued` → `revoked` | `expired`  
`QRPayload`: `active` (rotating HMAC) | `revoked`

**Key Endpoints:**
- `issueCredential`
- `getCredentialById`
- `listMemberCredentials`
- `revokeCredential`
- `reissueCredential`
- `verifyCredential` — untennanted
- `downloadCredentialPDF`
- `listCredentialTemplates`
- `createCredentialTemplate`
- `updateCredentialTemplate`
- `getVerificationLog`

---

### 28. Professional Licensing

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `Practitioner.qualification` (primary); `association-native` for renewal workflow

**Purpose:** Tracks external professional licenses held by Members — regulatory body, license number, specialty, issue/expiry dates, renewal cycles. Integrates with CE Credit compliance checks (Domain 31) to validate license-renewal eligibility.

**Key Entities:** `ProfessionalLicense`, `LicenseAuthority`, `LicenseRenewalCycle`, `RenewalAlert`, `LicenseDocumentUpload`

**Key Workflows:**
- Member enters license details → authority verified → `LicenseRenewalCycle` created based on type → renewal alerts generated before expiry
- License renewed → new expiry set → cycle reset
- License expired → flagged in compliance views → CE Credit check against renewal threshold
- Authority bulk sync → license status updated from regulatory registry (REQUIRES_DECISION on provider)

**Key Business Rules:**
- License number unique per `LicenseAuthority`
- Expired licenses flagged in Member Directory (Domain 26)
- CE Credit eligibility computed from Credit Cycle (Domain 31) — minimum threshold per license type
- License documents stored via Document Management (Domain 10)
- Renewal alerts sent at 90 / 30 / 7 days before expiry (configurable)
- Authority registry sync REQUIRES_DECISION on provider (PRC [PH], state boards [US])

**State Machine:** `active` → `expiring_soon` → `expired` | `renewed` | `surrendered` | `revoked`

**Key Endpoints:**
- `listProfessionalLicenses`
- `addLicense`
- `getLicenseById`
- `updateLicense`
- `renewLicense`
- `revokeLicense`
- `uploadLicenseDocument`
- `listLicenseAuthorities`
- `createLicenseAuthority`
- `getLicenseComplianceStatus`
- `listExpiringLicenses`
- `getLicenseRenewalCycle`

---

### 29. Certification Programs

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `Practitioner.qualification` (partial); `association-native` for program lifecycle

**Purpose:** Formal certification programs granting credentials distinct from CE credits — board certifications, diplomate status, specialty examinations. Manages exam result capture, recertification cycles, lapse/reinstatement, and CME accreditation body reporting. Proctored exam delivery deferred to v2.

**Key Entities:** `CertificationProgram`, `CertificationEnrollment`, `ExamResult`, `RecertificationCycle`, `AccreditationReport`, `AccreditationBodySubmission`

**Key Workflows:**
- Program created → eligibility rules set → Member applies → eligibility validated → exam administered externally → `ExamResult` submitted → certification granted or denied → `RecertificationCycle` created
- Cycle approaching expiry → renewal requirements verified → certification renewed
- Lapse → access restricted → reinstatement path opened
- `AccreditationReport` generated → submitted to accreditation body (ACCME [US] / PRC [PH] — REQUIRES_DECISION)

**Key Business Rules:**
- Exam proctoring deferred to v2 — v1 captures pass/fail submitted by elevated role
- Eligibility criteria may include CE credits, membership duration, and application documents (REQUIRES_DECISION per program)
- Recertification cycle length configurable per program
- Lapsed certifications displayed with `lapsed` status — not hidden
- Reinstatement requires back-requirements plus reinstatement fee

**State Machine:**  
`CertificationEnrollment`: `applied` → `eligible` | `ineligible` → `exam_pending` → `certified` | `failed`  
`CertificationStatus`: `active` → `recertification_due` → `lapsed` | `expired` | `surrendered`

**Key Endpoints:**
- `listCertificationPrograms`
- `createCertificationProgram`
- `getCertificationById`
- `enrollInCertification`
- `validateEligibility`
- `submitExamResult`
- `grantCertification`
- `denyCertification`
- `listRecertificationCycles`
- `renewCertification`
- `lapseCertification`
- `reinstateCertification`
- `generateAccreditationReport`
- `submitToAccreditationBody`

---

### 30. Accredited Provider Registry

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Registry of Organizations approved to deliver accredited CE and CPD activities. Board approves providers; approved activities are auto-credited to Members. Distinct from individual Certification Programs (Domain 29) — this accredits Organizations, not individuals.

**Key Entities:** `AccreditedProvider`, `ProviderApplication`, `AccreditationAudit`, `ProviderRenewal`, `ApprovedActivityType`

**Key Workflows:**
- Organization applies for provider status → review committee evaluates → board approves → `AccreditedProvider` created → approved activity types configured
- Annual audit → compliance documents collected → score computed → renewal approved or status suspended
- Provider offers activity → activity submitted for pre-approval → reviewer approves → activity auto-credited after check-in (see Domain 31)

**Key Business Rules:**
- Provider status requires board approval — not committee only
- Accreditation limited to declared activity types; activities outside declared types require individual review
- Audit cycle annual by default (configurable per provider)
- Suspended providers' past credits are not revoked
- Renewal must complete before expiry (30-day grace)
- Provider Organization must maintain active relationship with the tenant
- Approved activity types reference CE credit categories (Domain 31)

**State Machine:**  
`ProviderApplication`: `submitted` → `under_review` → `approved` | `rejected`  
`AccreditedProvider`: `active` → `audit_due` → `suspended` | `expired` | `revoked`

**Key Endpoints:**
- `listAccreditedProviders`
- `applyForProviderStatus`
- `reviewProviderApplication`
- `approveProvider`
- `revokeProviderStatus`
- `suspendProvider`
- `listProviderAuditHistory`
- `initiateAudit`
- `completeAudit`
- `listApprovedActivityTypes`
- `updateApprovedActivityTypes`
- `renewProviderStatus`
- `getProviderCEActivities`

---

### 31. CE Credits & Credit Cycles

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Tracks CE/CPD credit accumulation per Member across one or more Credit Cycles. AUTO credits created automatically on activity attendance; MANUAL credits entered by officers. Cross-org aggregation for multi-chapter Members; excess carry-over with configurable caps.

**Key Entities:** `CreditEntry`, `CreditCycle`, `CreditCategory`, `CreditCarryOver`, `CreditSummary`

**Key Workflows:**
- Member attends credit-bearing activity (Training, Event with CE, or Conference Session) → `CreditEntry` (AUTO) created in same transaction as check-in → provisional → verified on completion
- Officer enters manual credit → `CreditEntry` (MANUAL) created → audit logged
- Cycle closes → surplus credits up to carry-over cap → `CreditCarryOver` entries created for next cycle
- Cross-org aggregation computed at query time for Members with multiple affiliations

**Key Business Rules:**
- Provenance: `AUTO` (system-generated) or `MANUAL` (officer-entered)
- AUTO entry is idempotent on `(memberId, activityId)`
- MANUAL entries require officer role
- Revocation requires reason and creates an audit entry
- Membership Status (Domain 18) derives from `duesExpiryDate` — not from credits
- Categories configured per tenant (clinical, management, research)
- Carry-over cap configurable per cycle type
- Cycle length configurable: 1, 2, or 3 years from registration date
- Activity reference is polymorphic across `Event`, `Training`, `ConferenceSession`

**State Machine:**  
`CreditEntry`: `provisional` → `earned` → `verified` | `revoked`  
`CreditCycle`: `upcoming` → `active` → `closing` → `closed` → `archived`

**Key Endpoints:**
- `listCreditEntries`
- `createManualCreditEntry`
- `awardCreditsFromActivity` — AUTO path, idempotent
- `revokeCreditEntry`
- `getCreditEntryById`
- `listCreditCycles`
- `getMemberCreditSummary`
- `closeCreditCycle`
- `getCycleComplianceReport`
- `listCreditCategories`
- `createCreditCategory`
- `transferCreditsAcrossOrgs`
- `getCreditCarryOver`
- `exportCreditReport`

---

### 32. Ethics, Discipline & Attestations

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `Flag` (individual member); `association-native` for process

**Purpose:** Ethics complaint intake, peer-review panels, disciplinary actions, public sanctions registry, and annual conflict-of-interest attestation cycles. Case details restricted to ethics committee.

**Key Entities:** `EthicsComplaint`, `PeerReviewPanel`, `DisciplinaryAction`, `SanctionRecord`, `COIAttestation`, `AttestationCycle`

**Key Workflows:**
- Complaint filed → case opened → ethics committee assigned → peer review panel formed → review conducted → finding issued → disciplinary action determined → sanction applied → respondent notified → appeal window opens
- Annual attestation cycle → Members prompted to complete COI disclosure → submitted → flagged items reviewed

**Key Business Rules:**
- Case details restricted to ethics committee and named investigators — no general officer access
- Respondent must be notified within configurable days (default 10)
- Findings are not public unless sanction is published
- Sanctions registry queryable by public (name + sanction type only — no case details)
- Appeal window configurable (default 30 days)
- COI attestations version-controlled annually
- Members under active sanction cannot hold officer positions
- Case files retained permanently

**State Machine:**  
`EthicsComplaint`: `filed` → `under_review` → `finding_issued` → `sanction_applied` | `dismissed` | `appealed` → `appeal_resolved`  
`COIAttestation`: `pending` → `submitted` | `declined` | `flagged` → `resolved`

**Key Endpoints:**
- `fileEthicsComplaint`
- `getComplaintById` — restricted
- `listComplaintsByStatus` — restricted
- `assignPeerReviewPanel`
- `issueComplaintFinding`
- `applyDisciplinaryAction`
- `listSanctionRegistry` — public
- `querySanctionRegistry` — public
- `appealSanction`
- `startAttestationCycle`
- `listAttestationStatus`
- `submitCOIAttestation`
- `reviewFlaggedAttestation`

---

### 33. Awards, Scholarships & Recognition

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Formal recognition programs — awards for excellence, merit scholarships, honorary recognitions. Covers nomination campaigns, multi-stage judging panels, announcement workflows, and scholarship disbursements.

**Key Entities:** `AwardProgram`, `AwardNomination`, `JudgingPanel`, `JudgingScore`, `ScholarshipAward`, `Disbursement`

**Key Workflows:**
- Program opens → nomination period → Members submit nominations → deadline → judging panel assigned → scores submitted → finalist list → winner selected → announced → certificate issued (see Domain 27)
- Scholarship: applicant submits → documents uploaded → panel reviews → award decision → `Disbursement` schedule → payments released

**Key Business Rules:**
- Nominators and nominees may not share a judging panel
- Judging scores remain confidential until after announcement
- Self-nominations allowed only if program explicitly permits
- Scholarship disbursements tied to fulfillment conditions (enrollment verification, grade submission — REQUIRES_DECISION on verification method)
- Award announcements held until all judges submit scores
- Winner history publicly visible
- Programs may have multiple award tiers (gold/silver/bronze)

**State Machine:**  
`AwardProgram`: `draft` → `nominations_open` → `judging` → `announced` → `closed`  
`AwardNomination`: `submitted` → `under_review` → `shortlisted` | `not_shortlisted` → `winner` | `not_selected`  
`Disbursement`: `scheduled` → `released` | `withheld`

**Key Endpoints:**
- `listAwardPrograms`
- `createAwardProgram`
- `openAwardNominations`
- `submitAwardNomination`
- `closeAwardNominations`
- `assignJudgingPanel`
- `submitJudgingScore`
- `selectAwardWinner`
- `announceAwardWinner`
- `listAwardWinners`
- `createScholarshipAward`
- `scheduleScholarshipDisbursement`
- `releaseDisbursement`
- `getScholarshipById`

---

### 34. Grants Management

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** End-to-end grant lifecycle — LOI screening, full application intake, review panel scoring, award decision, fund disbursement, progress reporting, and final compliance reporting. Covers grants given by the Association to researchers/Members and those received from funders.

**Key Entities:** `GrantProgram`, `LetterOfIntent`, `GrantApplication`, `ReviewPanel`, `GrantAward`, `ProgressReport`, `FinalReport`

**Key Workflows:**
- Program opens → LOI period → LOIs screened → invited applicants submit full application → review panel assigned → scores submitted → awards decided → grant agreement executed → disbursements scheduled → progress reports at intervals → final report → compliance verified → grant closed

**Key Business Rules:**
- LOI screening pass rate configurable per program
- Review panel members must sign COI disclosure before application access (see Domain 32)
- Reviewer scores averaged; ties escalated to program chair
- Disbursements conditional on progress report approval
- Final report required before grantee eligible for future grants
- Grant funds tracked separately from general operating funds
- Grant-awarded funds must match disbursement total — no surplus
- Inactive programs cannot accept new applications

**State Machine:**  
`GrantApplication`: `loi_submitted` → `invited` | `declined` → `full_application_submitted` → `under_review` → `awarded` | `rejected` | `withdrawn`  
`GrantAward`: `active` → `reporting_due` → `completed` | `forfeited`

**Key Endpoints:**
- `listGrantPrograms`
- `createGrantProgram`
- `submitLOI`
- `getLOIById`
- `inviteToFullApplication`
- `submitGrantApplication`
- `assignReviewPanel`
- `submitReviewScore`
- `awardGrant`
- `rejectApplication`
- `listGrantAwards`
- `scheduleDisbursement`
- `releaseDisbursement`
- `submitProgressReport`
- `submitFinalReport`
- `closeGrant`

---

### 35. Prospect & Non-Member CRM

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** CRM for non-Members, corporate prospects, and leads at the top of the membership funnel. Tracks outreach history, pipeline stage, relationship owner, and application conversion analytics. Feeds into Individual Membership (Domain 18) and Marketing Automation (Domain 52).

**Key Entities:** `Prospect`, `ProspectActivity`, `Pipeline`, `PipelineStage`, `ProspectNote`, `ConversionEvent`

**Key Workflows:**
- Lead captured (web form, event scan, referral) → `Prospect` created → assigned to relationship owner → stage progresses → application triggered → approved → `ConversionEvent` logged → Prospect linked to created Member
- Lost prospects marked inactive with reason
- Campaign responses imported from Marketing Automation (Domain 52)

**Key Business Rules:**
- Prospect records are pre-Member — no dues, no credits, no directory access
- Relationship owner must be staff or officer
- Pipeline stage transitions unidirectional (REQUIRES_DECISION on reverse transitions)
- Conversion requires accepted `MembershipApplication` (Domain 18)
- Duplicate detection on email before creation
- Prospects inactive for configurable period auto-archive (default 180 days)
- Data deletion requests apply to prospects same as Members (see Domain 13)

**State Machine:** `lead` → `contacted` → `engaged` → `applied` → `converted` | `lost` | `archived`

**Key Endpoints:**
- `listProspects`
- `createProspect`
- `getProspectById`
- `updateProspect`
- `addProspectActivity`
- `updatePipelineStage`
- `assignRelationshipOwner`
- `convertProspect`
- `markProspectLost`
- `archiveProspect`
- `listPipelineStages`
- `createPipelineStage`
- `getConversionReport`
- `importProspectsFromCampaign`

---

### 36. Advocacy, PAC & Action Center

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Legislative advocacy tools and Political Action Committee (PAC) management — issue tracking, Member action alerts, contact-your-legislator campaigns, and PAC contribution accounting with a segregated ledger distinct from general funds.

**Key Entities:** `LegislativeIssue`, `ActionAlert`, `AdvocacyAction`, `Legislator`, `PACContribution`, `PACLedger`

**Key Workflows:**
- Staff creates issue → drafts action alert → publishes → Members receive alert → Member sends advocacy action (email/letter/call) → action logged
- PAC drive opened → Members contribute → contributions deposited into `PACLedger` (never general fund) → PAC report generated
- Legislator registry sync from external provider (REQUIRES_DECISION on provider)

**Key Business Rules:**
- PAC funds stored in `PACLedger` — NOT in Fund Allocation splits (see Domain 20)
- PAC and general funds must never co-mingle in reporting
- Contribution limits per Member configurable per jurisdiction (REQUIRES_DECISION: FEC [US] / COMELEC [PH] / Elections Canada [CA])
- Action alerts require opt-in distinct from notification preferences
- Advocacy actions attributed to individual Members
- PAC reporting format REQUIRES_DECISION per jurisdiction
- `PACLedger` audit trail is immutable

**State Machine:**  
`ActionAlert`: `draft` → `active` → `closed` → `archived`  
`AdvocacyAction`: `pending` → `sent` → `acknowledged` | `failed`  
`PACContribution`: `pledged` → `received` → `deposited` → `reported` | `refunded`

**Key Endpoints:**
- `listLegislativeIssues`
- `createLegislativeIssue`
- `createActionAlert`
- `publishActionAlert`
- `sendAdvocacyAction`
- `listAdvocacyActions`
- `listLegislators`
- `syncLegislatorRegistry`
- `recordPACContribution`
- `getPACLedger`
- `generatePACReport`
- `listPACContributions`
- `optInToAdvocacy`
- `optOutOfAdvocacy`

---

### 37. Fundraising, Donations & Tax Receipts

**Category:** Association-Specific Lifecycle  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Association fundraising — annual and capital campaigns, pledge management, recurring giving, legacy/planned giving, tribute gifts, and peer-to-peer events. Generates jurisdiction-specific tax receipts with sequential numbering and void/reissue workflow.

**Key Entities:** `Campaign`, `Donation`, `Pledge`, `PledgeSchedule`, `RecurringGift`, `LegacyGift`, `TaxReceipt`

**Key Workflows:**
- Campaign created → launch window → donation page published → donor gives → `Donation` recorded → `TaxReceipt` with sequential number emailed
- Pledge: donor pledges → `PledgeSchedule` (installments) → reminders → each installment paid → `TaxReceipt` per payment
- Recurring gift: donor establishes → charged on schedule → receipt per charge

**Key Business Rules:**
- Donations recorded separately from Dues (different tax treatment)
- `TaxReceipt` numbering sequential and unbroken per fiscal year (REQUIRES_DECISION: BIR 2322 [PH] / IRS 501(c)(3) [US] / T3010 [CA])
- Voided receipts retain number — gaps never allowed
- Reissue creates new receipt referencing the voided one
- Legacy gifts not counted as revenue until realized
- Tribute gifts may include notification to honoree family
- Peer-to-peer participant pages inherit campaign settings
- Duplicate donation detection via gateway idempotency key

**State Machine:**  
`Donation`: `pending` → `completed` | `failed` | `refunded`  
`Pledge`: `active` → `fulfilled` | `lapsed` | `written_off`  
`TaxReceipt`: `issued` → `voided` → `reissued`  
`Campaign`: `draft` → `active` → `closed` → `archived`

**Key Endpoints:**
- `listCampaigns`
- `createCampaign`
- `launchCampaign`
- `recordDonation`
- `getDonationById`
- `createPledge`
- `recordPledgePayment`
- `setupRecurringGift`
- `cancelRecurringGift`
- `recordLegacyGift`
- `issueTaxReceipt`
- `voidTaxReceipt`
- `reissueTaxReceipt`
- `getDonorHistory`
- `getCampaignReport`
- `listTaxReceipts`

---

## Association Operations

> Operational and workflow domains layered on the core + lifecycle foundation. Most are `association-native`; a subset overlap with Events, Training, and Scheduling primitives in Core Shared.

---

### 38. Events Management

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Social and governance events — general assemblies, induction ceremonies, mission activities, networking events — with registration, capacity management, waitlist, QR or manual check-in, and paid registration. Credit-bearing activities belong in Training (Domain 39).

**Key Entities:** `Event`, `EventRegistration`, `CheckIn`, `WaitlistEntry`, `EventCapacity`, `EventTicket`

**Key Workflows:**
- Create event → set capacity → open registration → Members register → capacity reached → waitlist activated → promoted when spot opens
- On-site check-in: QR scanned or name searched → `CheckIn` recorded → attendance count updated
- Cancellation → spot released → next waitlisted auto-notified
- Event close → financial reconciliation

**Key Business Rules:**
- Capacity enforced server-side — excess goes to waitlist
- Waitlist order FIFO by default (configurable)
- Cancellation deadline enforced — refunds only before deadline
- Check-in idempotent per registration
- QR code per registration (non-rotating — rotating QR is Training-only, Domain 39)
- Paid events require Invoice settled before registration is confirmed
- Double-registration detected on `(memberId, eventId)`

**State Machine:**  
`Event`: `draft` → `published` → `registration_open` → `full` | `registration_closed` → `in_progress` → `completed` | `cancelled`  
`EventRegistration`: `pending_payment` | `confirmed` → `checked_in` | `cancelled` | `no_show`  
`WaitlistEntry`: `waiting` → `promoted` | `cancelled`

**Key Endpoints:**
- `listEvents`
- `createEvent`
- `getEventById`
- `publishEvent`
- `openRegistration`
- `registerForEvent`
- `getRegistrationById`
- `cancelRegistration`
- `listWaitlist`
- `promoteFromWaitlist`
- `checkInAttendee`
- `getCheckInQR`
- `getEventAttendanceReport`
- `cancelEvent`
- `closeEvent`

---

### 39. Training & Learning Activities

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Credit-bearing learning activities (seminars, workshops, conventions, live webinars) with enrollment, HMAC-rotating QR check-in, completion marking, and automatic CE credit award. Integrates with Accredited Provider Registry (Domain 30) for auto-credit from approved sponsors.

**Key Entities:** `Training`, `TrainingEnrollment`, `QRCheckInSecret`, `CompletionRecord`, `TrainingCredit`

**Key Workflows:**
- Training created → credit category and value assigned → enrollment opens → Member enrolls → attends → HMAC-rotating QR scanned → `CheckIn` recorded → completion threshold met → `CompletionRecord` created → `CreditEntry` (AUTO) awarded in same transaction (see Domain 31)
- Instructor marks manual completion for late/paper attestation → `CreditEntry` (MANUAL)

**Key Business Rules:**
- HMAC-rotating QR regenerates every 60 seconds server-side (anti-sharing)
- Check-in window configurable per activity (default start time ±15 min)
- Completion threshold default 80% attendance (configurable)
- Credit award must occur in same DB transaction as check-in (see Domain 31)
- AUTO credit idempotent on `(enrollmentId, activityId)`
- Training from accredited provider auto-credited without further review
- Instructor override requires officer role
- Enrollment capacity enforced same as Events (Domain 38)

**State Machine:**  
`Training`: `draft` → `enrollment_open` → `enrollment_closed` → `in_progress` → `completed` | `cancelled`  
`TrainingEnrollment`: `enrolled` → `attended` → `completed` | `absent` | `cancelled`

**Key Endpoints:**
- `listTrainings`
- `createTraining`
- `getTrainingById`
- `openTrainingEnrollment`
- `enrollInTraining`
- `getTrainingEnrollmentById`
- `cancelTrainingEnrollment`
- `generateRotatingQR`
- `checkInTrainingAttendee`
- `markTrainingCompletion`
- `manuallyAwardTrainingCredit`
- `getTrainingCompletionReport`
- `getTrainingCredits`
- `cancelTraining`

---

### 40. Learning Management

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Asynchronous and blended learning — self-paced courses, learning paths, quizzes, and completion assessments. V1 covers native association-built content (video / document / quiz). SCORM and xAPI integration deferred to v2.

**Key Entities:** `Course`, `CourseModule`, `LearningPath`, `Enrollment`, `QuizAttempt`, `CompletionRecord`

**Key Workflows:**
- Author creates course → adds modules → publishes → learner enrolls → progresses → takes quiz → meets threshold → `CompletionRecord` → `CreditEntry` if CE-eligible (see Domain 31)
- Learning path: sequence of courses with prerequisites → completion unlocks next
- Quiz: configurable attempts, passing score, randomized questions

**Key Business Rules:**
- SCORM/xAPI support deferred to v2 — v1 native content only
- Prerequisite enforcement: later course locked until prior completed
- Quiz retake limit configurable
- Course progress stored per enrollment — not global
- CE credit award on full path completion only if all required courses complete
- Video completion tracked by watched-percentage threshold (default 80%)
- Courses cannot be un-published while active enrollments exist

**State Machine:**  
`Course`: `draft` → `published` → `archived`  
`Enrollment`: `enrolled` → `in_progress` → `completed` | `expired` | `dropped`  
`QuizAttempt`: `in_progress` → `passed` | `failed`

**Key Endpoints:**
- `listCourses`
- `createCourse`
- `publishCourse`
- `getCourseById`
- `listLearningPaths`
- `createLearningPath`
- `enrollInCourse`
- `getCourseProgress`
- `submitQuizAttempt`
- `getQuizResult`
- `completeCourse`
- `listCourseCompletionRecords`
- `getCourseCompletionReport`
- `archiveCourse`

---

### 41. Conference & Session Management

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Multi-day conferences and conventions — tracks, concurrent sessions, speaker management, session-level CE credits, speaker honoraria and travel reimbursement, and session scheduling. Conference registration delegates to Events (Domain 38).

**Key Entities:** `Conference`, `ConferenceTrack`, `Session`, `Speaker`, `SpeakerContract`, `Honorarium`, `TravelReimbursement`, `W9OrBIR2307`

**Key Workflows:**
- Create conference → define tracks → build session schedule → invite speakers → `SpeakerContract` sent → countersigned → session assigned → registration opens
- Attendee selects sessions → session capacity enforced → check-in at session → CE credit awarded per session (see Domain 31)
- Post-conference: honoraria processed → travel reimbursements reviewed → tax documents collected

**Key Business Rules:**
- Session conflicts detected across concurrent tracks for same attendee
- CE-eligible sessions must link to accredited provider or pre-approved (see Domain 30)
- Speakers cannot present concurrent sessions
- `SpeakerContract` signature required before session publishes
- `Honorarium` configurable per speaker-session agreement
- `W9OrBIR2307` (jurisdiction-tagged) required for honoraria above configurable threshold
- Session capacity enforced independently of conference capacity
- Session-level CE idempotent on `(attendeeId, sessionId)`

**State Machine:**  
`Conference`: `draft` → `published` → `registration_open` → `in_progress` → `post_conference` → `closed`  
`Session`: `draft` → `scheduled` → `in_progress` → `completed` | `cancelled`  
`SpeakerContract`: `draft` → `sent` → `signed` | `declined` | `expired`

**Key Endpoints:**
- `listConferences`
- `createConference`
- `getConferenceById`
- `listTracks`
- `createTrack`
- `listSessions`
- `createSession`
- `inviteSpeaker`
- `getSpeakerById`
- `countersignSpeakerContract`
- `checkInForSession`
- `awardSessionCredit`
- `processHonorarium`
- `requestTravelReimbursement`
- `approveReimbursement`
- `getConferenceSchedule`

---

### 42. Abstracts & Peer Review

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Call-for-abstracts workflow for conferences and journals — submission, blind reviewer assignment, scoring, acceptance/rejection decisions, and scheduling of accepted abstracts into sessions.

**Key Entities:** `AbstractSubmission`, `AbstractReview`, `ReviewerAssignment`, `AbstractDecision`, `AbstractCategory`

**Key Workflows:**
- CFP published → author submits → anonymized → reviewer pool notified → reviewers assigned (load-balanced) → scores submitted → average computed → program chair reviews borderline → accept/reject → author notified → accepted abstract scheduled into a Session (see Domain 41)

**Key Business Rules:**
- Submissions anonymized before review — author identity hidden
- Reviewer and submitter from same Organization are excluded by conflict check (configurable)
- Minimum two reviewers per submission (configurable)
- Scores average-computed; ties escalated to program chair
- Revisions allowed before deadline only
- Accepted abstracts scheduled manually by program committee (not automated)
- Rejection notifications not reversible after sent
- Abstract PDFs stored via Document Management (Domain 10)

**State Machine:**  
`AbstractSubmission`: `draft` → `submitted` → `under_review` → `revision_requested` → `accepted` | `rejected` | `withdrawn`  
`ReviewerAssignment`: `invited` → `accepted` | `declined` → `submitted_score`

**Key Endpoints:**
- `listAbstractSubmissions`
- `createAbstractSubmission`
- `submitAbstract`
- `requestAbstractRevision`
- `listAbstractReviews`
- `assignAbstractReviewer`
- `submitAbstractReviewScore`
- `makeAbstractDecision`
- `notifyAbstractDecision`
- `scheduleAcceptedAbstract`
- `listAbstractCategories`
- `createAbstractCategory`
- `exportAbstractReport`

---

### 43. Exhibitors & Sponsorship

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Conference and event exhibitor management — booth sales, floor plan assignment, lead retrieval, and sponsorship package fulfillment. Covers both virtual and in-person configurations.

**Key Entities:** `ExhibitorProfile`, `BoothAssignment`, `FloorPlan`, `SponsorshipPackage`, `SponsorshipFulfillment`, `LeadCapture`

**Key Workflows:**
- Sponsorship packages published → sponsor selects → invoice generated → payment → fulfillment checklist created → deliverables tracked
- Exhibitor books booth → `FloorPlan` slot reserved → confirmed on payment → pre-event materials submitted
- On-site: exhibitor scans attendee badge → `LeadCapture` created → post-event lead report

**Key Business Rules:**
- Booth assignments require payment confirmation
- Floor plan slots cannot be double-booked
- Lead capture requires attendee consent (REQUIRES_DECISION on implied vs explicit consent at badge scan)
- Sponsorship fulfillment items configurable per package
- Unfulfilled items flagged for sponsor relations team
- Virtual booths have separate capacity and digital-asset requirements
- Refunds on cancellation follow configurable cancellation policy
- Lead export restricted to exhibitor's own captured leads

**State Machine:**  
`BoothAssignment`: `reserved` → `confirmed` | `cancelled` | `expired`  
`SponsorshipPackage`: `draft` → `available` → `sold_out` | `archived`  
`SponsorshipFulfillment`: `pending` → `in_progress` → `completed` | `overdue`

**Key Endpoints:**
- `listSponsorshipPackages`
- `createSponsorshipPackage`
- `purchaseSponsorshipPackage`
- `listBoothAssignments`
- `reserveBooth`
- `confirmBoothAssignment`
- `cancelBoothAssignment`
- `getFloorPlan`
- `captureExhibitorLead`
- `exportLeadReport`
- `listFulfillmentItems`
- `updateFulfillmentItem`
- `completeFulfillment`
- `getExhibitorProfile`
- `updateExhibitorProfile`

---

### 44. Volunteer Management

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Volunteer program lifecycle — opportunity posting, volunteer applications, hour tracking, recognition milestones, and skill-matching for opportunities.

**Key Entities:** `VolunteerOpportunity`, `VolunteerApplication`, `VolunteerHours`, `VolunteerRecognition`, `SkillTag`

**Key Workflows:**
- Staff posts opportunity → skill tags and time commitment specified → Members apply → manager reviews → volunteers assigned → hours logged → supervisor verifies → accumulated hours trigger recognition
- Annual volunteer report generated

**Key Business Rules:**
- Volunteer hours require supervisor verification before counting toward recognition
- Opportunity capacity enforced
- Skill-match recommendations non-binding (REQUIRES_DECISION on algorithm)
- Recognition milestones configurable per tenant (e.g., 10h / 25h / 50h / 100h)
- Hours cannot be retroactively adjusted after annual cycle closes
- Opportunities expire automatically after end date
- Volunteers may withdraw applications before confirmed
- Prior volunteer history retained permanently

**State Machine:**  
`VolunteerOpportunity`: `draft` → `open` → `filled` | `closed`  
`VolunteerApplication`: `submitted` → `approved` | `rejected` | `withdrawn`  
`VolunteerHours`: `logged` → `verified` | `disputed`

**Key Endpoints:**
- `listVolunteerOpportunities`
- `createVolunteerOpportunity`
- `applyForVolunteerOpportunity`
- `approveVolunteerApplication`
- `rejectVolunteerApplication`
- `logVolunteerHours`
- `verifyVolunteerHours`
- `disputeVolunteerHours`
- `getVolunteerSummary`
- `listVolunteerRecognitions`
- `awardRecognitionMilestone`
- `getVolunteerHistory`
- `exportVolunteerReport`

---

### 45. Job Board & Career Services

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Member career services — employer job postings, application workflow, resume bank, salary-survey ingestion, and career resources. Restricted to active Members and verified employers.

**Key Entities:** `JobPosting`, `JobApplication`, `ResumeProfile`, `SalarySurveyEntry`, `EmployerProfile`

**Key Workflows:**
- Employer registers → verified → posts job (free or paid tier) → published → Members apply → application routed to employer → employer manages pipeline externally
- Member creates `ResumeProfile` → uploads resume → opts into bank → employers with granted access search
- Salary survey opens → Members submit compensation → aggregate report published (anonymized)

**Key Business Rules:**
- Job postings expire after configurable days (default 30)
- Employers require verified `EmployerProfile` before posting
- Member resumes visible only to employers with explicit access grant (opt-in)
- Salary survey responses anonymized — individual data never exposed
- Aggregate published only when minimum response threshold met (default 25)
- Lapsed Members cannot apply for jobs or access resume bank
- Application notifications sent to both Member and employer on submission

**State Machine:**  
`JobPosting`: `draft` → `pending_review` | `active` → `expired` | `filled` | `closed`  
`JobApplication`: `submitted` → `viewed` | `interviewing` | `offered` | `rejected` | `withdrawn`  
`ResumeProfile`: `hidden` | `active` | `bank_opt_in`

**Key Endpoints:**
- `listJobPostings`
- `createJobPosting`
- `getJobPostingById`
- `applyForJob`
- `getJobApplicationById`
- `listApplicationsByPosting`
- `updateApplicationStatus`
- `createResumeProfile`
- `updateResumeProfile`
- `searchResumeBank`
- `submitSalarySurveyEntry`
- `getSalarySurveyAggregate`
- `listEmployerProfiles`
- `verifyEmployer`
- `expireJobPosting`

---

### 46. Mentorship Matching

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Formal mentorship program — mentor and mentee profile configuration, pairing (manual or algorithm-assisted), session goal tracking, and program completion recognition.

**Key Entities:** `MentorProfile`, `MenteeProfile`, `MentorshipPair`, `MentorshipSession`, `MentorshipGoal`, `ProgramCycle`

**Key Workflows:**
- Program cycle opens → eligible Members express interest → profiles completed → matching run (manual by coordinator or algorithm-assisted) → pairs confirmed → kick-off session scheduled → goals set → regular check-ins logged → program cycle closes → completion survey → recognition awarded

**Key Business Rules:**
- Matching algorithm REQUIRES_DECISION — v1 manual coordinator matching with algorithm suggestions
- Mentor capacity configurable (default max 3 mentees)
- Pairing requires both parties' acceptance
- Goals set at program start — evaluated at midpoint and close
- Session logs require both parties to confirm (or mentor submits with 24h mentee objection window)
- Mentors must meet minimum seniority (configurable — e.g., 3 years active membership)
- Program cycle length configurable (default 6 months)
- Pair dissolution requires coordinator approval

**State Machine:**  
`MentorshipPair`: `proposed` → `accepted` | `declined` → `active` → `completed` | `dissolved`  
`ProgramCycle`: `enrollment_open` → `matching` → `active` → `closing` → `completed`  
`MentorshipSession`: `scheduled` → `completed` | `cancelled`

**Key Endpoints:**
- `listMentorProfiles`
- `createMentorProfile`
- `listMenteeProfiles`
- `createMenteeProfile`
- `listMentorshipPairs`
- `proposeMentorshipPair`
- `acceptMentorshipPair`
- `declineMentorshipPair`
- `dissolveMentorshipPair`
- `scheduleMentorshipSession`
- `logMentorshipSession`
- `setMentorshipGoal`
- `updateMentorshipGoalStatus`
- `completeProgramCycle`
- `getPairingReport`

---

### 47. Publications & Journal Management

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Association publications and journal access for existing content — digital issues, article-level gating by membership tier, and publication metadata. Full submission and peer-review workflow plus DOI minting deferred to v2.

**Key Entities:** `Publication`, `PublicationIssue`, `Article`, `ArticleAccess`, `AccessTier`

**Key Workflows:**
- Publication configured → issues created → articles uploaded → access tier set per article → Members access based on tier
- Open-access articles available to public
- Issue archive searchable → Member accesses article → access logged
- Embargo period enforced — articles become open-access after configurable delay

**Key Business Rules:**
- Full submission workflow and DOI minting deferred to v2 — v1 provides access gating only
- Article access tiers mirror Document tiers: `public` | `member_only` | `subscriber`
- Embargo period configurable per issue (default 12 months)
- Access log retained for 2 years
- Search index updated within 1 hour of publish
- Back-issue gating REQUIRES_DECISION on separate subscription
- PDFs stored via Document Management (Domain 10)

**State Machine:**  
`Article`: `draft` → `embargoed` → `published` | `retracted`  
`PublicationIssue`: `draft` → `published` | `archived`

**Key Endpoints:**
- `listPublications`
- `getPublicationById`
- `listPublicationIssues`
- `getPublicationIssueById`
- `listArticles`
- `getArticleById`
- `setArticleAccessTier`
- `accessArticle`
- `searchArticles`
- `listArticleAccessLog`
- `embargoArticle`
- `retractArticle`
- `exportPublicationIndex`

---

### 48. Community Forums & SIGs

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Special Interest Group (SIG) management and community forum foundation — SIG formation, membership, and integration hooks for embedded forum platforms (Discourse, Circle). Native threaded forum engine deferred to v2.

**Key Entities:** `SpecialInterestGroup`, `SIGMembership`, `ForumIntegration`, `ForumSyncEvent`

**Key Workflows:**
- SIG proposed → board approved → SIG created → open or invite-only membership → Member joins → granted forum access in integration platform → SIG content moderated externally
- Integration webhook → `ForumSyncEvent` → actions reflected in the tenant (ban, post-count milestone)
- SIG dissolved → members notified → forum archived

**Key Business Rules:**
- Native forum engine deferred to v2 — v1 SIG lifecycle + integration hooks only
- SIG membership requires active Membership (see Domain 18)
- Moderation decisions in the integration platform override SIG status
- Public-facing SIG creation requires board approval
- Private SIGs are invite-only
- SIG membership contributes to engagement score (see Domain 3)
- Integration credentials stored encrypted
- Dissolution requires 30-day notice (configurable)

**State Machine:**  
`SpecialInterestGroup`: `proposed` → `approved` → `active` → `dormant` | `dissolved`  
`SIGMembership`: `invited` | `applied` → `active` → `resigned` | `removed`

**Key Endpoints:**
- `listSpecialInterestGroups`
- `createSIG`
- `approveSIG`
- `getSIGById`
- `listSIGMembers`
- `joinSIG`
- `leaveSIG`
- `inviteToSIG`
- `removeSIGMember`
- `dissolveSIG`
- `listForumIntegrations`
- `createForumIntegration`
- `syncForumEvent`

---

### 49. Member Benefits Marketplace

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Curated catalog of Member-exclusive benefits — discount programs with affinity partners, group-insurance referrals, professional-service negotiated rates, and benefit redemption tracking. Acts as a referral hub — the Association is not the underwriter.

**Key Entities:** `BenefitPartner`, `BenefitOffer`, `OfferCategory`, `BenefitRedemption`, `BenefitEligibilityRule`

**Key Workflows:**
- Partner agreement signed → `BenefitPartner` created → `BenefitOffer`s configured with promo codes or affiliate links → published → Member browses → eligible Member redeems offer → redemption tracked
- Partner reporting → redemption counts shared per agreement
- Expiry → offer deactivated → Member notified

**Key Business Rules:**
- Benefits visible only to Active Members — not Grace or Lapsed
- Eligibility rules configurable per offer (tier, chapter, specialty)
- Group-insurance offers display referral info only — Association does not underwrite
- Promo codes single-use per Member unless configured otherwise
- Redemption tracking is best-effort where affiliate cannot provide webhook
- Partner agreements stored via Document Management (Domain 10)
- Inactive partners' offers hidden

**State Machine:**  
`BenefitOffer`: `draft` → `active` → `expired` | `paused` | `discontinued`  
`BenefitRedemption`: `initiated` → `confirmed` | `unconfirmed`

**Key Endpoints:**
- `listBenefitPartners`
- `createBenefitPartner`
- `listBenefitOffers`
- `createBenefitOffer`
- `getBenefitOfferById`
- `redeemBenefitOffer`
- `listMemberRedemptions`
- `listBenefitCategories`
- `updateBenefitEligibility`
- `deactivateBenefitOffer`
- `getPartnerRedemptionReport`
- `manageBenefitExpiry`

---

### 50. Knowledge Library & Resource Hub

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Member-gated resource library — practice guidelines, policy templates, clinical protocols, industry reports, and educational materials organized by topic and access tier. Search-indexed; supports bookmarks and reading history. Distinct from Document Management (Domain 10), which is operational file storage.

**Key Entities:** `Resource`, `ResourceCategory`, `ResourceTag`, `Bookmark`, `ReadingHistory`, `AccessTier`

**Key Workflows:**
- Staff publishes resource → tags by category and specialty → access tier set → indexed → Member browses or searches → views → reading history logged
- Member bookmarks → synced to personal library
- Resource updated → prior version archived → Members with bookmarks notified
- AI chatbot (Domain 57) queries index to answer Member questions

**Key Business Rules:**
- Access tier mirrors Document tiers: `public` | `member_only` | `chapter_only`
- Lapsed Members lose `member_only` and `chapter_only` access
- Reading history retained 2 years
- Resources cannot be deleted while bookmarked — deactivate instead
- Search index updated within 5 minutes of publish
- External links validated on publish (broken link check)
- Resource PDFs stored via Document Management (Domain 10)
- AI chatbot access limited to `public` + `member_only` — not `chapter_only` or `privileged`

**State Machine:**  
`Resource`: `draft` → `published` | `scheduled` → `archived` | `deleted` (soft)  
`Bookmark`: `active` | `removed`

**Key Endpoints:**
- `listResources`
- `createResource`
- `getResourceById`
- `updateResource`
- `archiveResource`
- `searchResources`
- `listResourceCategories`
- `createResourceCategory`
- `bookmarkResource`
- `removeBookmark`
- `listBookmarks`
- `getReadingHistory`
- `publishResource`
- `scheduleResource`
- `getResourceAccessLog`

---

### 51. Member Portal & Self-Service

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Member-facing portal layer — distinct auth boundary, inbox, self-service dues payments, event registration, profile management, CE transcript download, and credential access. `PortalUser` is portal-specific, backed by Person (Domain 1) with separate session management.

**Key Entities:** `PortalUser`, `PortalSession`, `PortalInbox`, `OnlinePaymentRequest`, `PortalIntakeForm`

**Key Workflows:**
- Member activates portal → `PortalUser` linked to Person → portal session established → Member views dashboard → pays dues (`OnlinePaymentRequest` triggers Billing flow, Domain 9) → registers for events → downloads CE transcript → views credentials
- Portal inbox: notifications surfaced → read/dismissed
- Intake form presented on first login or re-consent trigger (see Domain 13)

**Key Business Rules:**
- `PortalUser` session expires independently of staff sessions (separate idle timeout — default 2 hours)
- Portal scoped permissions — Member sees only own data
- `OnlinePaymentRequest` creates Invoice (Domain 9) and awaits gateway confirmation
- Intake forms surfaced on consent re-prompt (see Domain 13)
- Portal MFA optional at Member tier; configurable to mandatory
- Portal session tokens not reusable with staff API
- CE transcript is a generated PDF — not the same as a `CredentialDocument` (Domain 27)

**State Machine:**  
`PortalUser`: `pending_activation` → `active` → `locked` | `deactivated`  
`PortalSession`: `active` → `expired` | `invalidated`

**Key Endpoints:**
- `activatePortalAccount`
- `portalLogin`
- `portalLogout`
- `getPortalDashboard`
- `getPortalInbox`
- `markPortalMessageRead`
- `initiateOnlinePayment`
- `getPortalPaymentStatus`
- `downloadCETranscript`
- `viewMyCredentials`
- `downloadMyCredential`
- `updateMyProfile`
- `viewMyMembership`
- `listMyEvents`
- `registerForEventFromPortal`
- `getMyAnnouncements`

---

### 52. Marketing Automation & Campaigns

**Category:** Association Operations  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Drip campaigns, audience segmentation, A/B content testing, open/click tracking, and suppression list management for Member acquisition and retention. Delegates transactional send mechanics to Communication (Domain 11); feeds prospect pipeline to Prospect CRM (Domain 35).

**Key Entities:** `MarketingCampaign`, `CampaignSequence`, `SegmentRule`, `AudienceSegment`, `CampaignSendRecord`, `ABVariant`, `SuppressionList`

**Key Workflows:**
- Create campaign → define audience segment via `SegmentRule` → configure sequence (immediate / drip / trigger-based) → A/B variants → launch → sends dispatched via Communication (Domain 11) → open/click events tracked → engagement fed to Interaction Timeline (Domain 3)
- Prospect response → `ProspectActivity` created in CRM (Domain 35)
- Unsubscribe → `SuppressionList` entry → honored by Communication

**Key Business Rules:**
- Audience segments re-evaluated at send time (not at campaign creation)
- A/B tests require minimum segment size (configurable, default 100 per variant)
- Send cadence limits enforced to prevent spam (REQUIRES_DECISION on per-Member daily limits)
- Suppression list checked before every send
- Open/click tracking requires pixel or link wrapping (configurable per campaign)
- Transactional messages bypass suppression (see Domain 11)
- Send records retained 2 years
- Segmentation engine build vs integrate REQUIRES_DECISION

**State Machine:**  
`MarketingCampaign`: `draft` → `scheduled` | `active` → `paused` → `completed` | `cancelled`  
`CampaignSendRecord`: `queued` → `sent` → `delivered` | `bounced` | `unsubscribed`  
`ABVariant`: `active` → `winner` | `loser`

**Key Endpoints:**
- `listMarketingCampaigns`
- `createMarketingCampaign`
- `launchMarketingCampaign`
- `pauseMarketingCampaign`
- `listAudienceSegments`
- `createSegmentRule`
- `previewAudienceSegment`
- `listCampaignSendRecords`
- `getCampaignEngagementReport`
- `createABVariant`
- `selectABWinner`
- `listSuppressionList`
- `addToSuppressionList`
- `removeFromSuppressionList`

---

## Integration & Interoperability

> External surface of the platform — FHIR export, webhooks to third-party systems, pre-built connectors, automation engine, and AI agents. Most are `association-native`; FHIR is the exception.

---

### 53. FHIR / HL7 Interoperability

**Category:** Integration & Interoperability  
**FHIR Mapping:** Multiple R4 resources

**Purpose:** Export and exchange of tenant data in FHIR R4 format — `Practitioner`, `Organization`, `Person`, and credential documents. Enables integration with health information exchanges, licensing boards, and hospital credentialing systems.

**Key Entities:** `FhirExportJob`, `FhirResourceMapping`, `FhirBundle`, `FhirSubscription`, `CapabilityStatement`

**Key Workflows:**
- Requesting system authenticates → FHIR scope granted in API key (see Domain 15) → resource queried → mapping applied → FHIR resource returned
- Bulk export → `FhirExportJob` → `$export` operation streams NDJSON → signed download URL
- Organization hierarchy exported as `Organization.partOf` chain
- Credentials exported as `DocumentReference` with HMAC signature in extension

**Key Business Rules:**
- Only resources with FHIR R4 mappings exported — association-native domains not exportable as FHIR
- FHIR scope required in API key (separate from standard scopes)
- `Person` (not `Patient`) is the base resource for AMS Members
- Credentials exported as `DocumentReference` with tenant-specific extension (R5 `VerifiableCredential` deferred)
- `CapabilityStatement` served at `/metadata`
- FHIR API rate-limited separately from REST API
- PII fields redacted for requestors without clinical scope

**State Machine:**  
`FhirExportJob`: `pending` → `running` → `completed` | `failed` | `expired`  
`FhirSubscription`: `requested` → `active` | `error` | `off`

**Key Endpoints:**
- `getFhirCapabilityStatement`
- `getFhirPerson`
- `getFhirPractitioner`
- `getFhirOrganization`
- `getFhirDocumentReference`
- `getFhirBundle`
- `createFhirExportJob`
- `getFhirExportStatus`
- `downloadFhirExport`
- `createFhirSubscription`
- `listFhirSubscriptions`
- `deleteFhirSubscription`

---

### 54. Webhook & Event Subscriptions

**Category:** Integration & Interoperability  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Outbound event delivery to third-party systems — configurable webhooks triggered by platform events (Membership activated, Dues paid, Credit Entry awarded, Election certified) with signed payloads, retry logic, and delivery monitoring.

**Key Entities:** `WebhookSubscription`, `WebhookDelivery`, `EventTopic`, `WebhookSecret`

**Key Workflows:**
- Subscriber configures URL + event topics + secret → `WebhookSubscription` created → event occurs → payload signed with HMAC-SHA256 → delivery attempted → retried on failure → dead-lettered after max retries

**Key Business Rules:**
- Payloads signed with HMAC-SHA256 using subscriber's `WebhookSecret`
- Delivery timeout: 10 seconds
- Retry schedule: exponential backoff (5s / 30s / 5m / 30m / 2h)
- Max 5 retries before marked failed
- Dead-letter queue retained 7 days
- Test delivery available before activation
- Subscriptions paused automatically after 100 consecutive failures
- Sensitive PII fields redacted in webhook payloads (configurable per topic)
- Event topics versioned — v1 and v2 topics coexist during migration

**State Machine:**  
`WebhookSubscription`: `active` → `paused` | `revoked`  
`WebhookDelivery`: `pending` → `delivered` | `failed` | `dead_lettered`

**Key Endpoints:**
- `listWebhookSubscriptions`
- `createWebhookSubscription`
- `getWebhookSubscriptionById`
- `updateWebhookSubscription`
- `deleteWebhookSubscription`
- `listEventTopics`
- `testWebhookDelivery`
- `listWebhookDeliveries`
- `retryWebhookDelivery`
- `pauseWebhookSubscription`
- `resumeWebhookSubscription`

---

### 55. External System Connectors

**Category:** Integration & Interoperability  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Pre-built connectors to commonly integrated external systems — payment gateways, messaging providers, accounting platforms, SSO providers, automation platforms, and academic identifier registries. Connectors are configuration objects; logic lives in corresponding functional domains.

**Key Entities:** `Connector`, `ConnectorConfig`, `ConnectorCredential`, `ConnectorSyncLog`, `ConnectorHealthCheck`

**Connector Type Examples:**
- Payment: Stripe, PayMongo [PH], Paystack [NG/GH]
- Messaging: SendGrid, OneSignal, Twilio
- Accounting: QuickBooks Online, Xero
- SSO: SAML 2.0, OIDC (Okta, Azure AD, Google Workspace)
- Automation: Zapier, Make
- Academic: CrossRef (if Publications Domain 47 enabled)

**Key Workflows:**
- Admin configures connector → credentials stored encrypted → health check → activation
- Sync event → data mapped → external call made → sync log entry created
- Error → alert sent → auto-retry with backoff

**Key Business Rules:**
- `ConnectorCredential`s stored encrypted at rest (AES-256)
- Health check on configurable schedule (default hourly)
- Failing connector does not block core platform operations
- Connector-specific rate limits respected
- SSO connector maps external identity to Person (Domain 1) by email
- Accounting connector sync is idempotent
- One active connector per type per tenant (REQUIRES_DECISION on multi-connector)

**State Machine:**  
`Connector`: `configured` → `active` → `degraded` | `error` | `disabled`  
`ConnectorSyncLog`: `running` → `success` | `partial` | `failed`

**Key Endpoints:**
- `listConnectors`
- `createConnector`
- `getConnectorById`
- `updateConnectorConfig`
- `activateConnector`
- `disableConnector`
- `testConnector`
- `listConnectorSyncLogs`
- `forceConnectorSync`
- `getConnectorHealthStatus`
- `rotateConnectorCredentials`

---

### 56. Task & Workflow Automation

**Category:** Integration & Interoperability  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** Rule-based automation for background tasks and triggered workflows — scheduled jobs, condition-based actions, event-driven rules. V1 uses API or admin UI with a predefined action catalog; visual workflow builder deferred to v2.

**Key Entities:** `WorkflowTrigger`, `TriggerCondition`, `AutomationAction`, `ScheduledJob`, `WorkflowRun`, `AutomationRule`

**Key Workflows:**
- Admin creates `WorkflowTrigger` (event type + conditions) → binds `AutomationAction`s → activates
- Event fires → conditions evaluated → matched actions queued → executed in order → `WorkflowRun` created
- `ScheduledJob` with cron expression → executes → result logged
- Failed action → retried per policy → `WorkflowRun` marked failed if exhausted

**Key Business Rules:**
- Maximum 3 levels of chained actions (prevent infinite loops)
- Actions may not directly modify audit logs or security records
- `ScheduledJob`s run in background process
- `WorkflowRun` logs retained 90 days (configurable)
- Visual workflow builder deferred to v2
- Trigger conditions use field comparisons and boolean operators — no arbitrary code
- Actions include: send notification, create task, update record, call webhook (Domain 54), assign role
- Actions run as system actor with audit attribution

**State Machine:**  
`WorkflowTrigger`: `draft` → `active` → `paused` | `deleted`  
`WorkflowRun`: `queued` → `running` → `completed` | `failed`  
`ScheduledJob`: `active` → `running` → `completed` | `failed` | `disabled`

**Key Endpoints:**
- `listWorkflowTriggers`
- `createWorkflowTrigger`
- `updateWorkflowTrigger`
- `deleteWorkflowTrigger`
- `activateWorkflowTrigger`
- `pauseWorkflowTrigger`
- `testWorkflowTrigger`
- `listWorkflowRuns`
- `getWorkflowRunById`
- `listScheduledJobs`
- `createScheduledJob`
- `updateScheduledJob`
- `disableScheduledJob`
- `runScheduledJobNow`
- `getAutomationActionCatalog`

---

### 57. AI Agents & Copilots

**Category:** Integration & Interoperability  
**FHIR Mapping:** `association-native (no direct FHIR mapping)`

**Purpose:** AI-native capabilities on top of the platform, scope-capped to four v1 functions — (a) smart audience segmentation, (b) announcement and email draft assistance, (c) event/meeting transcription and summary, (d) Member Q&A chatbot over the Knowledge Library (Domain 50). Human-in-loop gating required for Member-facing and money-moving agent actions.

**Key Entities:** `AIAgentTask`, `AgentPrompt`, `HumanReviewGate`, `TranscriptionJob`, `AgentCostLog`, `CopilotSession`

**Key Workflows:**
- Segmentation: officer defines goal → AI suggests `SegmentRule`s → officer reviews → approves → segment created in Marketing Automation (Domain 52)
- Draft assist: officer provides topic → AI generates announcement draft → officer edits → publishes via Communication (Domain 11)
- Transcription: audio/video uploaded → `TranscriptionJob` → transcript + summary generated → meeting minutes draft offered (see Domain 24)
- Chatbot: Member query → Knowledge Library (Domain 50) searched → response with citations → conversation logged

**Key Business Rules:**
- Human-in-loop gate required for: Member-facing communications, any action modifying dues or payments, Member status changes
- AI-generated content never published without officer approval
- AI actions attributed in audit log as `actor: ai-agent + approver: officerId`
- Agent model hosting REQUIRES_DECISION (Anthropic API direct / Bedrock / self-hosted)
- Prompt versions tracked in `AgentPrompt`
- Cost attribution tracked per Organization in `AgentCostLog`
- Chatbot access limited to `public` + `member_only` Knowledge Library content
- Transcription supported formats REQUIRES_DECISION on codecs
- All AI interactions logged for compliance (see Domain 14)

**State Machine:**  
`AIAgentTask`: `queued` → `running` → `requires_review` → `approved` | `rejected` → `completed` | `failed`  
`TranscriptionJob`: `queued` → `transcribing` → `summarizing` → `completed` | `failed`  
`CopilotSession`: `active` | `ended`

**Key Endpoints:**
- `listAIAgentTasks`
- `submitSegmentationRequest`
- `approveAgentTask`
- `rejectAgentTask`
- `requestAnnouncementDraft`
- `editDraftContent`
- `approveDraftContent`
- `createTranscriptionJob`
- `getTranscriptionJobStatus`
- `getTranscriptionResult`
- `getMeetingMinutesDraft`
- `sendChatbotMessage`
- `getChatbotHistory`
- `getAgentCostReport`
- `listAgentPromptVersions`

---

## Appendix

### A. Open Questions / REQUIRES_DECISION

| # | Domain | Question | Default / Assumption |
|---|---|---|---|
| 1 | 18 Membership | Membership category taxonomy (student / active / retired / honorary / life / associate) — hard-coded enum or configurable per tenant? | Configurable per-tenant with seed template |
| 2 | 18 Membership | Grace period length and lapsed→expired threshold | Per-tenant, default 30-day grace / 90-day lapsed |
| 3 | 20 Dues | Fund allocation fund names/enum per tenant | REQUIRES_DECISION per tenant at onboarding |
| 4 | 22 Elections | Ballot cryptography depth (homomorphic / signed / plain) | Signed ballots with audit trail for v1 |
| 5 | 36 Advocacy/PAC | PAC reporting jurisdiction (FEC [US] / COMELEC [PH] / Elections Canada [CA] / none) | REQUIRES_DECISION per deployment jurisdiction |
| 6 | 27 Credentials | FHIR mapping for verifiable digital IDs — R4 `DocumentReference` vs R5 `VerifiableCredential` preview | association-native + optional `DocumentReference` export v1 |
| 7 | 47 Publications | Journal DOI minting and full submission workflow | Deferred to v2; v1 access gating only |
| 8 | 37 Fundraising | Tax receipt jurisdiction (BIR 2322 [PH] / IRS 501(c)(3) [US] / T3010 [CA] / multi) | REQUIRES_DECISION per tenant |
| 9 | 13 Consent | Data privacy regime (DPA 2012 [PH] / GDPR / HIPAA / CCPA) | REQUIRES_DECISION per deployment |
| 10 | 25 Board | Board-only document permission granularity (doc-level vs folder-level) | Folder-level with inheritance v1 |
| 11 | 40 Learning Management | SCORM/xAPI integration | Deferred to v2; native content only v1 |
| 12 | 22 Elections | Ballot cryptography upgrade path to homomorphic | REQUIRES_DECISION post-v1 |
| 13 | 52 Marketing | Marketing automation engine — build in-house vs integrate (Mailchimp/HubSpot) | In-house rules engine, SendGrid as delivery |
| 14 | 57 AI | AI agent model hosting (Anthropic direct / Bedrock / self-hosted) | REQUIRES_DECISION; default Anthropic API |
| 15 | 57 AI | Human-in-loop gate — required for all agent actions or opt-out per type? | Required for Member-facing and money-moving actions |
| 16 | 9 Billing | Revenue recognition depth (schedule only vs full GL close) | Schedule only; GL export via Connectors |
| 17 | 5 Organization | i18n model — tenant-default locale + per-member override | Tenant default v1; per-member override v2 |
| 18 | 45 Job Board | Resume storage ownership — member-uploaded vs hosted bank | Member-owned uploads only v1 |
| 19 | 29 Certification | Proctoring provider for exam delivery | Deferred to v2; v1 captures result from external proctor |
| 20 | 5 Organization | Multi-tier branding / microsites — per-chapter theming and custom domains | REQUIRES_DECISION; v1 = chapter public page config only |
| 21 | 29 Certification | CME accreditation body interface (ACCME [US] / PRC [PH]) | REQUIRES_DECISION per deployment jurisdiction |
| 22 | 19 Institutional | Group-membership billing address routing (corporate HR vs member email) | Corporate for invoice; individual for notifications |

### B. Domain-to-Category Quick Reference

| # | Domain | Category | Endpoints (est.) |
|---|---|---|---|
| 1 | Person & Member Identity Profile | Core Shared | 10 |
| 2 | Forms, Surveys & Questionnaires | Core Shared | 10 |
| 3 | Interaction & Engagement Timeline | Core Shared | 8 |
| 4 | Practitioner | Core Shared | 10 |
| 5 | Organization & Multi-Tier Hierarchy | Core Shared | 10 |
| 6 | Staff Workforce | Core Shared | 10 |
| 7 | Calendar & Scheduling | Core Shared | 12 |
| 8 | Fee Schedules & Pricing | Core Shared | 11 |
| 9 | Billing & Financial | Core Shared | 13 |
| 10 | Document Management | Core Shared | 12 |
| 11 | Communication | Core Shared | 11 |
| 12 | Notifications | Core Shared | 12 |
| 13 | Consent & Preferences | Core Shared | 12 |
| 14 | Audit & Compliance | Core Shared | 9 |
| 15 | Auth & Access Control | Core Shared | 15 |
| 16 | Reporting & Analytics | Core Shared | 12 |
| 17 | Data Import / Export | Core Shared | 13 |
| 18 | Individual Membership & Lifecycle | Lifecycle | 14 |
| 19 | Group & Institutional Memberships | Lifecycle | 13 |
| 20 | Dues, AR & Dunning | Lifecycle | 14 |
| 21 | Chapter Affiliations | Lifecycle | 13 |
| 22 | Elections & Ballots | Lifecycle | 15 |
| 23 | Officer Terms & Succession | Lifecycle | 13 |
| 24 | Committees & Working Groups | Lifecycle | 16 |
| 25 | Board Governance | Lifecycle | 13 |
| 26 | Member Directory | Lifecycle | 11 |
| 27 | Credentials & Digital IDs | Lifecycle | 11 |
| 28 | Professional Licensing | Lifecycle | 12 |
| 29 | Certification Programs | Lifecycle | 14 |
| 30 | Accredited Provider Registry | Lifecycle | 13 |
| 31 | CE Credits & Credit Cycles | Lifecycle | 14 |
| 32 | Ethics, Discipline & Attestations | Lifecycle | 13 |
| 33 | Awards, Scholarships & Recognition | Lifecycle | 14 |
| 34 | Grants Management | Lifecycle | 16 |
| 35 | Prospect & Non-Member CRM | Lifecycle | 14 |
| 36 | Advocacy, PAC & Action Center | Lifecycle | 14 |
| 37 | Fundraising, Donations & Tax Receipts | Lifecycle | 16 |
| 38 | Events Management | Operations | 15 |
| 39 | Training & Learning Activities | Operations | 14 |
| 40 | Learning Management | Operations | 14 |
| 41 | Conference & Session Management | Operations | 16 |
| 42 | Abstracts & Peer Review | Operations | 13 |
| 43 | Exhibitors & Sponsorship | Operations | 15 |
| 44 | Volunteer Management | Operations | 13 |
| 45 | Job Board & Career Services | Operations | 15 |
| 46 | Mentorship Matching | Operations | 15 |
| 47 | Publications & Journal Management | Operations | 13 |
| 48 | Community Forums & SIGs | Operations | 13 |
| 49 | Member Benefits Marketplace | Operations | 12 |
| 50 | Knowledge Library & Resource Hub | Operations | 15 |
| 51 | Member Portal & Self-Service | Operations | 16 |
| 52 | Marketing Automation & Campaigns | Operations | 14 |
| 53 | FHIR / HL7 Interoperability | Integration | 12 |
| 54 | Webhook & Event Subscriptions | Integration | 11 |
| 55 | External System Connectors | Integration | 11 |
| 56 | Task & Workflow Automation | Integration | 15 |
| 57 | AI Agents & Copilots | Integration | 15 |

**Total estimated endpoints: ~740**

---

*Association Management API Spec v1.0.0-draft — 57 domains, lightweight PRD format — ready for AI-assisted API generation*
