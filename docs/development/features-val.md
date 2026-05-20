---
title: "Product Requirements Document — Dentalemon"
product: dentalemon
category: prd
tags: [prd, dental, clinic-management, ipad, tablet, philippines, local-first, solo-practice]
---

# Product Requirements Document: Dentalemon

---

## 1. Product Overview

### What This Is

A **dental-native, iPad-first practice management system** for solo and small-group dental practices in the Philippines. Dentalemon replaces generic clinic management systems (MyMeds, MYCURE, Mediks) and paper-based workflows with a purpose-built workspace designed around how dentistry works — starting from the tooth, not a patient list. It is the first product in the Philippine market to combine dental-specific clinical features with a tablet-native interface and a stand-alone license model.

### What This Is Not

- Not a general clinic or hospital management system (that is MYCURE and Ospitalis)
- Not an association management platform (that is the PDA Platform)
- Not a patient-facing booking or telemedicine app
- Not a dental supply chain or inventory management system
- Not a multi-location DSO management platform (group practices are supported, DSO-scale is out of scope)
- Not a Dentrix clone — Dentalemon is built for the Philippine market from day one, not localized from a US product

### Product Classification

**Vertical SaaS — Dental Practice Management**

Purpose-built for dental workflows (charting, treatment planning, billing, scheduling) in solo-to-small-group practices. Positioned in the top-right quadrant of dental-nativeness and UX quality where no Philippine competitor currently operates.

### Positioning Statement

> For **Philippine solo and small-group dental practice owners** who are frustrated with generic clinic software that wasn't designed for dental work, Dentalemon is a **dental practice management system** that provides a chart-first, iPad-native workspace they own permanently. Unlike **MyMeds, MYCURE, Mediks, and Molarsoft**, our product offers **dental-native charting with tooth legends and procedure hierarchies, a tablet-first workspace with Apple-quality UX, and a stand-alone license with no recurring subscription for the core product** — because dentists shouldn't rent their tools.

---

## 2. Problem Statement

### Surface Problem

Philippine dental practitioners manage patient records, treatment plans, billing, and scheduling using generic clinic management systems that were not designed for dental workflows. These systems lack dental charting, tooth legends, procedure hierarchies, and dental-specific reporting. Dentists compensate with workarounds: hiring extra staff to cover software gaps, maintaining parallel paper records, and memorizing patient charts because the software has no search function.

### Root Problem

No dental-native practice management system exists in the Philippine market. Dentrix — the most feature-complete dental software globally — is effectively blocked from the Philippines due to IRS system linkage. Every Philippine competitor (MyMeds, MYCURE, Mediks, Molarsoft) is a general clinic management system adapted for dental use, not built dental-native. The dentist who knows what good dental software looks like (because they evaluated Dentrix and were blocked) has no local option that meets their expectations.

### Who Is Affected

| Stakeholder | Pain |
|---|---|
| **Solo practice dentist-owners (software switchers)** | Paying for generic software that lacks dental charting, searchable records, and procedure hierarchy. Workarounds include hiring staff and using external tools. |
| **Solo practice dentist-owners (paper-based)** | 10-30 years on paper. Growing external pressure (patients asking for digital records, data vulnerability from floods/theft/fire). No software simple enough to justify the switch. |
| **Staff / dental secretaries** | Managing dual systems (software + paper), manual data entry, no reliable scheduling, no staff-appropriate access controls. |
| **Patients** | Cannot access their own records digitally, schedule appointments online, or receive automated reminders. |

### Evidence

- D-009 (MyMeds user, 5-chair solo practice): Calls MyMeds "just an ordinary database compared to practice." No dental charting, no search function, unlabeled patient files. Evaluated Dentrix specifically for dental features, blocked by regulation. Explicit switch willingness.
- D-004 (MYCURE user, ~400 patients): Gaps in MYCURE significant enough that she hired a dedicated secretary to compensate — a measurable hidden cost. Google Calendar sync failures cause double bookings.
- D-010 (paper-based, 22 years): Two patients already asking to go digital. Flood data loss experience. Husband pushing for digital transition. Uses iPad and GCash daily — not tech-resistant, just tool-resistant.
- Scheduling confirmed as universal pain point across all research participants (7/7 in cross-validation matrix; structurally confirmed across the entire participant base).
- Debt and payment tracking confirmed as top pain point (5/8 participants).
- Phase 1 Type A research batch: 8 interviews scored against evaluation matrix v3.0.0. Mean score 74.0%, 4 HIGH quality interviews. Cross-interview thematic patterns confirmed: dental charting is the #1 purchase driver.

### Impact of Inaction

- Dentists continue using generic systems with dental-specific gaps, absorbing hidden costs (extra staff, lost time, workarounds)
- Paper-based practices face growing data vulnerability with no acceptable digital alternative
- The Dentrix-shaped gap in the Philippine market remains open for a competitor to fill first
- Dentists who evaluated Dentrix and were blocked continue settling for lesser alternatives

---

## 3. Target Users

### 3.1 Software Switcher (SW) — Phase 1

**Role:** Solo dental practice owner already paying for clinic management software (MyMeds, MYCURE, Practo, or similar). 1-5 chairs, owner-operator.

**Goals:**

- Replace generic software with a dental-native system that has charting, tooth legends, and procedure hierarchy
- Track patient debt and balances reliably
- Generate date-range revenue reports
- Manage appointments without Google Calendar sync failures
- Own the software permanently — no recurring subscription for core access

**Context:**

- Mid-to-high income clientele; mid-range to premium practice
- Tech-Embracing to Transitional: already paying for software, uses GCash/iPad daily
- Switch trigger is capability gap, not price — they want better, not cheaper
- Deliberate evaluators: D-009 evaluated Dentrix; D-004 evaluated Practo and Mediks before settling
- Every practice has at least 1 staff (secretary, dental assistant, or family member handling front desk)
- Price elasticity ~1.2 (low sensitivity — values quality over cost)

**Platform:** iPad (primary). Desktop/web access is a Phase 2 addition.
**Minimum viewport:** 1024px (iPad landscape)
**Adoption profile:** Tech-Embracing (fast close if demo lands)

### Adoption Segment Note

The Philippine dental market splits into three adoption profiles: Tech-Embracing (~25-30%), Transitional (~45-50%), and Tech-Resistant (~20-25%). The Software Switcher persona maps to Tech-Embracing; the Paper-Pending persona maps to Transitional. **Design rule: build the onboarding experience for the Transitional majority.** If the onboarding requires Tech-Embracing confidence, 45% of the market is lost before they start.

### 3.2 Paper-Pending (PP) — Phase 1

**Role:** Experienced solo dental practice owner who has never adopted clinic software. 1-2 chairs, 10-30 years in practice, paper/filing cabinet/pen-and-paper calendar.

**Goals:**

- Transition from paper to digital without disruption to established practice workflow
- Protect patient records from physical vulnerability (flood, theft, fire)
- Meet growing patient expectations for digital record-keeping
- Keep it simple — low-friction onboarding, not a learning curve

**Context:**

- Mid-tier income clientele
- Transitional tech readiness: uses iPad, GCash, Messenger, Viber — but not clinic software
- Switch trigger is external push: patients asking, family pressure, record vulnerability, possible future LTO requirement for digital dental records
- Not tech-resistant — tool-resistant. They have not found a system worthy of their experience.
- Longer conversion path but high lifetime value if activated

**Platform:** iPad (primary)
**Minimum viewport:** 1024px (iPad landscape)
**Adoption profile:** Transitional (longer conversion path; needs simplicity and low friction)

### 3.3 Small Group Practice (GP) — Phase 2

**Role:** Practice with 2-4 dentists sharing one location. Each dentist needs their own clinical workspace with PRC-linked prescriptions, individual scheduling, revenue attribution, and audit trail.

**Goals:**

- Per-dentist clinical identity (own PRC on prescriptions, own schedule, own revenue tracking)
- Shared staff access with appropriate controls
- Practice-level financial reporting across all dentists

**Context:**

- No dedicated small group practice owner in current research base — requirements inferred from structural clinical needs and regulatory requirements
- Per-dentist workspace is not a "seat management" feature — it is a clinical and regulatory necessity (PRC license numbers on prescriptions must match the prescribing dentist)

**Platform:** iPad (primary), desktop/web (secondary)
**Minimum viewport:** 1024px

---

## 4. Regulatory & Ecosystem Context

### 4.1 Philippine Dental Practice Regulation

- 9,976 dental clinics registered in the Philippines (Dec 2024), 97.6% solo-owner operations
- Estimated TAM: 11,000-15,000 dentists nationally; ~7,000-9,000 practice decision-makers; ~1,500-3,000 practices in the primary + secondary target segments (mid-to-high tier, already digitized or ready to digitize). This is a focused go-to-market, not a mass play.
- PRC (Professional Regulation Commission) governs dentist licensing
- Dentists must hold a valid PRC license number — prescriptions must carry the prescribing dentist's PRC number and signature
- Possible future national LTO (License to Operate) requirement for digital dental records adds regulatory push toward digitization

### 4.2 Dentrix Regulatory Block

Dentrix — the most feature-complete dental software globally — is effectively blocked from the Philippine market due to IRS system linkage. D-009 confirmed: the system requires connection to the US Internal Revenue Service, which is prohibited under Philippine regulations. This creates a structural gap: the highest-capability dental software cannot serve the Philippine market, leaving an opening for a purpose-built local alternative.

### 4.3 Data Privacy

| Regulation | Requirement | Impact on Platform |
|---|---|---|
| RA 10173 (Data Privacy Act 2012) | NPC oversight; consent at collection; data portability; data deletion with retention exceptions | Privacy-by-design; consent at registration; full data export always available; encryption at rest and in transit |
| PRC Regulations | PRC license numbers are professional identifiers | Validated format at registration; PRC number displayed on prescriptions and clinical documents |

### 4.4 Communication Ecosystem

- **Facebook Messenger** is the primary patient-dentist communication channel (confirmed 5/8 interview participants). Patients book, confirm, and follow up via Messenger. Dentalemon does not replace Messenger — it coexists. Peer referrals also travel through Messenger and Viber group chats.
- **Viber** is a secondary channel, particularly for PDA chapter group communications and dentist-to-dentist networking.
- Dentalemon's referral sharing mechanics must work natively in Messenger and Viber (link previews, one-tap sharing).

### 4.5 Payment Ecosystem

- GCash: 60M+ users nationally; confirmed by interview participants as common payment channel for dental services
- Maya (PayMaya): Secondary digital wallet; confirmed usage among dentists
- Bank transfer and cash remain common payment methods alongside digital wallets
- PayMongo available as payment gateway supporting GCash, Maya, cards, and QR Ph

---

## 5. Competitive Landscape

### 5.1 Active Competitors

| Factor | MyMeds | MYCURE | Mediks | Molarsoft | **Dentalemon** |
|---|:---:|:---:|:---:|:---:|:---:|
| **Dental-native charting** | No | No | Unknown | Unconfirmed | Yes |
| **Procedure hierarchy** | No | No | Unknown | Unknown | Yes |
| **iPad-first UX** | No | No | No | No | Yes |
| **Searchable records** | No | Yes | Unknown | Yes | Yes |
| **Stand-alone license** | No | No | No | No | Yes |
| **Known pricing** | Unknown ("absurd") | Unknown | ~₱1,500/mo (stale) | ₱1,499/mo | ₱25-35K one-time |
| **PH compliance** | Yes | Yes | Yes | Yes | Yes |
| **Data ownership** | Vendor-held | Vendor-held | Vendor-held | Cloud-only | Local-first, user-owned |

### 5.2 Competitive Moat (3 Layers)

1. **Product category (structural):** No Philippine competitor offers dental-native + iPad-first. Dentalemon occupies the top-right quadrant alone (dental-native x high UX quality).
2. **Dentrix-shaped gap (regulatory):** Dentrix is blocked from PH. Every dentist who evaluated Dentrix and was turned away is a high-intent prospect with an explicit feature wish list. D-009 is exactly this profile.
3. **Pricing model (strategic):** Every Philippine competitor uses subscription. Stand-alone license is uncontested. Break-even vs. Molarsoft at ~13-23 months depending on tier; zero core cost after that.

### 5.3 Dentrix Feature Benchmark

Features D-009 valued in Dentrix that are unavailable in any Philippine product and represent the target capability set:

- Bank system (cheque/reference/branch tracking)
- Prescription printing with clinic letterhead + e-signature + PRC number
- X-ray email integration
- Dental charting with tooth legend and procedure hierarchy

---

## 6. Development Phases

The product is built solo-practice-first. Phase 1 targets Software Switchers (SW) and Paper-Pending (PP) only. Group Practice (GP) is deferred to Phase 2. This aligns with the bottom-up GTM strategy — prove value at the solo level before expanding to multi-dentist practices.

### Phase Overview

| Phase | Name | Target Users | Goal |
|---|---|---|---|
| **Phase 1** | Core Product | SW + PP (Solo/Practice tiers) | Single-screen dental workspace: chart, treat, bill, schedule — one dentist fully operational on iPad |
| **Phase 2** | Growth | + GP (Group tier) | Multi-dentist workspace, web access, advanced integrations, version upgrades |
| **Phase 3** | Scale | All | Multi-location support, advanced analytics, native mobile companion, Android tablet support |

### Phase Roadmap

| Phase | Scope | New Personas | Key Additions |
|---|---|---|---|
| **1 — Core** | Solo/Practice end-to-end | SW, PP | Charting, scheduling, billing, debt tracking, reporting, prescriptions, cloud backup |
| **2 — Growth** | Group tier + web + integrations | GP | Per-dentist workspace, desktop/web, GCash/Maya deep integration, Success Suite, patient reminders |
| **3 — Scale** | Multi-location + expansion | Enterprise | Multi-location management, advanced analytics, Android tablet, inventory management |

### Forward-Compatible Data Model

The data model must support Phase 2+ from day one. The following must be present in the schema even if Phase 1 only surfaces solo-dentist views:

- Multi-dentist identity support (per-dentist PRC, scheduling, revenue attribution)
- Per-tooth treatment history with full audit trail
- Payment transaction records supporting future GCash/Maya integration
- Cloud backup metadata for storage expansion tracking

---

## 7. User Privacy Layer

> **Principle:** Patient data lives on the dentist's device. The dentist owns their data. Cloud is a backup, not the source. If the vendor shuts down, the data persists on the device.

### 7.1 What the Product Protects

| Data | Protection | Why |
|---|---|---|
| Patient clinical records | Local-first storage on device; cloud is a backup copy, not the primary store | Data survives vendor shutdown; no internet required for access |
| Patient personal information | Encrypted at rest and in transit; DPA 2012 compliant | Regulatory requirement; clinical data is sensitive |
| PRC license credentials | Validated format; stored per-dentist | Professional regulatory data |
| Payment information | Never stored in the app; hosted checkout handles all card processing | PCI compliance; reduces risk surface |

### 7.2 Privacy Defaults

- Patient records are stored locally on the iPad first, synced to cloud backup automatically
- Full CSV/JSON data export always available — no vendor lock-in at any tier
- Cloud backup is optional for operation — the app works completely offline
- Staff access is role-scoped: secretary/receptionist cannot access clinical notes or financial analytics (Phase 1: 1 staff login scoped to scheduling + patient lookup for Solo tier; up to 3 full-access staff for Practice tier)

---

## 8. Feature Requirements

### 8.1 Phase 1: Core Product

**Goal:** One dentist with a solo or small-team practice fully operational on a single iPad — charting, treating, billing, scheduling, and reporting without leaving the workspace.

**Target users:** Software Switcher (SW) + Paper-Pending (PP). Solo and Practice license tiers.

#### FR1: Dental Workspace — Timeline Carousel Shell | P0 | Must

The workspace is the single screen where the dentist spends their entire patient session. This is the bread and butter of the product — the revolutionary interaction model that differentiates Dentalemon from every competitor. The dentist should never need to navigate away from this screen during active patient care. Admin and secretarial workflows (scheduling, patient list, reporting) live outside this shell; all clinical dentist work lives inside it.

The workspace has three zones stacked vertically:
- **Top bar:** Patient selector, session date, and quick-access action icons (prescriptions, signatures, attachments, view options)
- **Timeline carousel (center):** The dental chart rendered as a horizontally swipeable timeline of visit snapshots — inspired by Apple's Cover Flow album carousel. Each "card" is one visit date's chart. Swiping navigates through the patient's treatment history. The front-most card is the active session.
- **Breakdown table (bottom):** Treatment rows for the active session showing tooth, surface, condition, treatment plan, work done status, and price.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR1.1 | Single-screen patient session workspace combining timeline carousel, treatment breakdown table, and top bar actions | Dentist can open a patient, view their chart history, add treatments, adjust pricing, and process payment without navigating to a separate screen |
| FR1.2 | Patient context bar (top) showing patient name/avatar, session date (picker), and quick-access action icons | Patient identity and date are visible at all times; switching patients or dates requires explicit action via the selector. Changing the date via the picker navigates the carousel to that date's card (if a visit exists) or creates a new active session card (if no visit exists for that date). |
| FR1.2a | Top bar action icons open as overlays/modals over the workspace — the workspace dims but remains visible behind | Tapping prescriptions, signatures, attachments, or view options opens the corresponding overlay without leaving the workspace. These are not separate screens — they are workspace-integrated panels. |
| FR1.3 | **Timeline carousel** displaying the dental chart as horizontally swipeable visit cards — each card is a full-mouth chart snapshot for one visit date | Swiping left/right navigates through the patient's visit history chronologically; the front-most (center) card is the current/active session; past cards show historical chart state as read-only; visual depth cue (stacked cards behind the active one) conveys timeline depth |
| FR1.4 | Active session chart displaying all teeth with visual status indicators (healthy, treated, needs treatment, missing) | Chart renders adult (32 teeth, FDI notation) and pediatric (20 teeth) dentitions; tooth status updates in real-time when treatments are applied; tapping a tooth opens the right slideout |
| FR1.5 | Quadrant and full-arch chart views within the carousel card | Dentist can toggle between quadrant-focused and full-mouth views; both views are tappable for tooth selection |
| FR1.6 | Treatment breakdown table (below carousel) showing all treatments for the active session | Each row displays: tooth number · surface letters (e.g., "14 · MDB"), condition with icon, arrow, treatment with icon, price (₱), "Mark Done" action, and overflow menu (⋮). Table header shows "Treatment Breakdown" with estimated total and a "View Completed (N)" link showing the count of completed treatments. |
| FR1.7 | Dual footer totals: Estimated vs Checkout | Footer left shows "Estimated · ₱X" (sum of ALL treatments — planned + completed). Footer right shows "Checkout · ₱Y" as a primary action button (sum of COMPLETED treatments only). The Checkout amount is what the patient is billed for — you only charge for work done, not planned work. The Checkout button opens the payment modal. |

#### FR2: Dental Charting | P0 | Must

Dental charting is the #1 purchase driver confirmed across research participants. This is the leader feature that no Philippine competitor offers. The chart lives inside the timeline carousel — each carousel card IS a chart.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR2.1 | Interactive tooth legend with dental-specific condition and treatment vocabulary | Tooth conditions (caries, fracture, missing, impacted) and treatments (filling, crown, extraction, root canal, denture, bridge, implant, braces) are rendered as visual indicators on each tooth in the chart; conditions are color-coded or icon-marked so the dentist can scan the chart at a glance |
| FR2.2 | Procedure hierarchy with specialty-based filtering in the slideout (Step 3) | Treatments are organized by dental specialty (Ortho, Endo, Perio, Prostho, Oral, Pedia, Cosmetic); the dentist filters by specialty then selects the treatment — guided ("spooned") selection, not free-text |
| FR2.3 | Per-tooth treatment history accessible from the slideout (Step 1 — Tooth Overview) | Tapping any tooth opens the slideout showing recent records for that tooth across all sessions: what was done, when, with condition + treatment badges. "View All" expands the full history. |
| FR2.4 | Surface-level charting via the 5-surface interactive diagram in the slideout (Step 2 — Select Surface & Condition) | Treatments can be assigned to specific tooth surfaces (mesial, distal, buccal, lingual, occlusal) or to the whole tooth via the "All" toggle |
| FR2.5 | Adult and pediatric dentition support | System supports FDI notation for both adult (32 teeth, numbered 11-48) and pediatric (20 teeth, numbered 51-85) charting; dentist can switch between adult and pediatric for the same patient; the carousel chart adapts accordingly |
| FR2.6 | Chart-as-timeline: each carousel card captures the dental chart state at that visit date | Past visit cards show the chart as it was on that date (conditions discovered, treatments applied); this creates a visual treatment history the dentist can literally swipe through |

#### FR3: Tooth Slideout — Right Sidebar Wizard | P0 | Must

The slideout is the treatment management surface — a right-side panel that slides in when the dentist taps a tooth on the carousel chart or a row in the breakdown table. It is a 4-step progressive wizard that guides condition diagnosis through treatment selection. The slideout coexists with the carousel and breakdown table (the main workspace dims but remains visible behind it).

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR3.1 | **Step 1 — Tooth Overview:** Shows the tapped tooth identity (e.g., "Tooth 14"), a stepper progress indicator, a read-only view of the tooth's surfaces for context, and the tooth's recent treatment records from previous visits | If the tooth has existing records, they are listed below with condition + treatment badges and a "View All" link to full history. "Create Record" button advances to Step 2. If no records exist, shows "There are no records on this tooth" with the "Create Record" entry point. |
| FR3.2 | **Step 2 — Select Surface & Condition:** Interactive 5-surface diagram (mesial, distal, buccal, lingual, occlusal) with "All" toggle for whole-tooth selection, combined with condition assignment per selected surface. | Dentist selects which surfaces are affected, then assigns conditions. If "All" surfaces selected, shows whole-tooth condition options. If individual surfaces, shows per-surface condition dropdowns. Conditions selectable from a structured list (Caries, Decayed, Fractured, Missing, Impacted, etc.); each surface-condition pair shows status badges (e.g., "Diagnosed"); existing conditions carried forward from previous visits with change indicators. |
| FR3.3 | **Step 3 — Select Treatment:** Treatment selection filtered by dental specialty (All, Ortho, Endo, Perio, Prostho, Oral, Pedia, Cosmetic) via a nested dropdown | Treatments are organized by specialty; selecting a specialty filters the treatment list; each treatment shows the surface-condition it addresses with status badge ("Treatment" assigned); "Apply" advances to Step 4 (Review) — does not save to database yet |
| FR3.4 | **Step 4 — Review Summary:** Shows all surfaces with their conditions and assigned treatments; includes a "Record Notes" free-text field | Dentist reviews the complete treatment record before committing; "Save & Close" writes the record and adds a row to the breakdown table; "Back" returns to Step 3 without saving |
| FR3.5 | Default pricing from a configurable treatment fee schedule | Each treatment has a default price set by the dentist; price is pre-filled when the treatment row appears in the breakdown table and editable inline |
| FR3.6 | Treatment status tracking per line item | Each treatment row has a "Mark Done" action; marking it records the treatment as completed with timestamp, moves it from the estimated pool to the checkout pool, and updates both footer totals. Completed treatments are accessible via "View Completed (N)" in the table header. |
| FR3.7 | Overflow actions per treatment row in the breakdown table | Each row supports: edit (reopens slideout at Step 4), adjust price, and remove (with confirmation); remove is visually distinct (destructive action) |
| FR3.8 | View completed treatments | "View Completed (N)" in the breakdown table header opens a centered modal listing all completed treatments with checkmark, tooth·surfaces, condition, treatment, and price. Modal shows "Completed Total" at the bottom — this total matches the Checkout amount. Close returns to the workspace. |

#### FR4: Patient Records & Search | P0 | Must

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR4.1 | Unlimited patient records with structured data: name, contact, PRC-related metadata, treatment history | No per-patient fees or record caps at any tier |
| FR4.2 | Searchable patient records by name and other identifying fields | Search returns results in <1s within the local database; partial name matching supported |
| FR4.3 | Patient profile with demographic info, dental history overview, balance/debt status, and visit history | Profile provides at-a-glance summary before opening a full session |
| FR4.4 | New patient registration with minimal required fields | Registration completable in <2 minutes; fields expand progressively — do not front-load the form |

#### FR5: Debt & Balance Tracking | P0 | Must

Debt tracking is the #1 named pain point by D-009 ("utang ng pasyente ung problema") and confirmed across 5 of 8 interview participants.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR5.1 | Per-patient outstanding balance visible on patient profile (aggregated from all unpaid/partially-paid invoices) | Balance displays total owed, last payment date, and aging (current / 30 / 60 / 90+ days). Each open invoice contributes to the total. |
| FR5.2 | Partial payment support | Patient can pay a portion of their balance; remaining balance adjusts automatically |
| FR5.3 | Payment recording (manual) for cash, bank transfer, and GCash/Maya payments processed outside the app | Manual payment entry creates a timestamped transaction record; flagged as "manual" in records |
| FR5.4 | Overdue balance alerts | Dentist is notified when patient balances exceed configurable thresholds or aging periods |
| FR5.5 | Payment history per patient | Filterable history with date range, amount, method, and associated treatments |

#### FR6: Appointment Scheduling | P0 | Must

Scheduling is a universal pain point across all research participants (7/7 cross-validated). MYCURE's Google Calendar dependency causes sync failures and double bookings.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR6.1 | Native appointment scheduling — no dependency on external calendar services | Scheduling is fully self-contained; no Google Calendar sync required or offered |
| FR6.2 | Calendar view with day/week/month views | Calendar renders all appointments with patient name, time, and procedure type |
| FR6.3 | Double-booking prevention | System warns or blocks scheduling two patients in the same time slot for the same dentist/chair |
| FR6.4 | Appointment creation from within the workspace | At the end of a patient session, the dentist can schedule the next appointment without leaving the workspace |
| FR6.5 | Walk-in support | Patients without appointments can be added to the day's schedule on the spot |

#### FR7: Revenue Reporting | P0 | Must

D-009 previously had date-range reporting, lost it when switching to MyMeds, and explicitly wants it back — a confirmed purchase driver.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR7.1 | Date-range revenue report showing total collections, treatments performed, and outstanding balances | Report generates for any custom date range; includes breakdown by treatment type |
| FR7.2 | Daily collection summary | End-of-day summary of all payments collected, treatments completed, and patients seen |
| FR7.3 | Exportable reports | Reports exportable as CSV or PDF for accounting/tax purposes |

#### FR8: Prescription & Clinical Documents | P1 | Should

> Practice tier and above. Prescription printing with PRC credentials was specifically valued by D-009 from his Dentrix evaluation.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR8.1 | Prescription generation with dentist name, PRC license number, and e-signature auto-applied | Prescription renders with the logged-in dentist's PRC number and signature — no manual entry per prescription. PRC number is validated format at dentist profile setup. |
| FR8.2 | Clinic letterhead on printed/exported documents | Prescriptions and clinical documents include clinic name, address, and contact info as configured in clinic settings |
| FR8.3 | In-app electronic signature capture for consent forms, waivers, and legal documents | Patient signs directly on the iPad screen; signature stored with the associated document and timestamp |
| FR8.4 | File attachment support for diagnostic records and correspondence | Dentist can attach photos (intraoral), X-rays, referral letters, and other files to a patient record; attached files are viewable from within the workspace |

#### FR9: Billing & Payment | P0 | Must

The breakdown table IS the billing surface. The pipeline flows: treatments added → Mark Done on completed work → Checkout (completed total) → Payment modal → Receipt. Billing is never a separate screen — it emerges directly from the treatment workflow.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR9.1 | Treatment-linked billing — charges generated from the treatment breakdown, not entered separately | Each treatment row contributes to the estimated total; only "Mark Done" treatments contribute to the checkout/billable total. Billing is always traceable to a specific treatment. |
| FR9.2 | Invoice generation with auto-numbered invoice ID | Tapping "Checkout" generates an invoice (e.g., INV-2026-0312) showing the completed treatments total. Invoice status tracks: Open, Partially Paid, Paid. |
| FR9.3 | Payment modal with multi-payment support | Payment modal shows: invoice header (number + total + status), applied payments list (each with method, amount, confirmation status, and staff attribution — e.g., "Received by: Front Desk"), remaining balance (highlighted when partial), and "Add Payment" form. Multiple payments can be stacked against a single invoice (e.g., ₱5,000 cash + ₱3,500 credit card). |
| FR9.4 | Payment methods: cash, bank transfer, credit card, and "Generate Payment Link" for online collection | "Generate Payment Link" creates a shareable link for the patient to pay the remaining balance online (GCash/Maya/card via hosted checkout in Phase 2). Cash and bank transfer are recorded manually with staff attribution. |
| FR9.5 | Remaining balance tracking within the payment modal | If the patient pays partially, the remaining balance is displayed prominently. The invoice stays "Open" until the balance reaches zero. Remaining balances feed into the patient's overall debt (FR5). |
| FR9.6 | Receipt delivery: Print Receipt, Send via Email, Send via SMS | Three explicit receipt channels available from within the payment modal after any payment is recorded. |
| FR9.7 | PWD and senior citizen automatic discount application | When a patient is flagged as PWD or senior citizen, the applicable discount (per Philippine law) is automatically applied to the billing total; discount is visible as a line item on the invoice. |
| FR9.8 | Treatment fee schedule configuration | Dentist can set and modify default prices for all treatments in the procedure hierarchy; changes apply to future treatments, not retroactively. |

#### FR10: Staff Access | P0 | Must

Every Philippine dental practice has at least 1 staff member (confirmed across all research participants).

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR10.1 | Solo tier: 1 staff login with access scoped to scheduling and patient lookup | Staff can view the schedule, look up patient names and appointment history; cannot access billing analytics, financial reports, prescriptions, or clinical notes |
| FR10.2 | Practice tier: up to 3 staff logins with full operational access | Staff can access scheduling, patient records, billing, and payment recording; cannot modify clinic settings or treatment fee schedule |
| FR10.3 | Role-based access controls with clear permission boundaries | Each role (dentist-owner, staff) has a defined permission set; unauthorized access attempts are blocked at the app level |

#### FR11: Analytics Dashboard | P1 | Should

> Practice tier and above.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR11.1 | Practice overview dashboard: patients seen, revenue collected, treatments performed, outstanding balances | Dashboard loads in <2s; data reflects the current state of the local database |
| FR11.2 | Trend visualization over configurable time periods | Dentist can view weekly, monthly, and quarterly trends for key metrics |
| FR11.3 | Top treatments by frequency and revenue | Identifies the most common and most profitable procedures |

#### FR12: Offline-First Operation & Cloud Backup | P0 | Must

The app must work completely offline — internet connectivity is not required for any core clinical workflow. The #1 barrier to digital adoption in Philippine healthcare is internet reliability. Local-first architecture sidesteps this. Cloud backup is a safety net, not a dependency. "Cloud Backup" framing — never "Cloud Storage." Data lives on the iPad; cloud is an automatic copy for disaster recovery.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR12.0a | All core clinical workflows operate without internet: charting, patient records, scheduling, billing, payment recording, reporting | Dentist can complete a full patient session (open patient → chart → treat → bill → schedule next visit) with airplane mode enabled |
| FR12.0b | Data created offline syncs to cloud backup automatically when connectivity is restored | No manual "sync" action required; sync is transparent; conflicts resolved by last-write-wins with audit log |
| FR12.1 | Automatic daily backup of all clinic data to cloud | Backup runs automatically when the device has internet connectivity; no manual action required |
| FR12.2 | 20 GB cloud backup storage included with every license at no additional cost | Storage allocation active on license activation; does not expire as long as license is active |
| FR12.3 | Full restore capability to a replacement device | If the original iPad is lost, stolen, or damaged, the dentist can restore their complete clinic data to a new device |
| FR12.4 | Storage usage monitoring with clear capacity indicators | Dentist can see how much storage is used and remaining; prompted when approaching allocation limit |
| FR12.5 | Storage expansion via one-time purchase blocks (not subscription) | Additional storage purchased as fixed-price blocks; purchased blocks do not expire or require renewal |
| FR12.6 | Full data export (CSV/JSON) always available at every tier regardless of cloud status | Dentist can export their complete data at any time; export does not require cloud backup to be active |

#### FR13: Onboarding & First-Run Experience | P0 | Must

Officer turnover, tech-literacy variance, and the Paper-Pending persona all demand frictionless onboarding. D-010 profile: "Takes less time than your Friday record pull."

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR13.1 | Guided onboarding wizard: clinic setup, dentist profile (with PRC number), treatment fee schedule, first patient | First-time setup completable in <10 minutes; each step has contextual guidance |
| FR13.2 | In-app guided walkthrough (Dr. Lemon mascot) for key workflows | Dr. Lemon provides non-intrusive tips on first use of charting, scheduling, and billing; dismissable and re-accessible |
| FR13.3 | Tutorial video library accessible from within the app | Short (<3 min) walkthroughs for core workflows; searchable by topic |
| FR13.4 | Searchable in-app help center / knowledge base | Persistent access to FAQs, how-to articles, and troubleshooting guides — not just first-run onboarding. This is the free support boundary: if the answer is in the help center, no CRO charge applies. |
| FR13.5 | In-app bug reporting channel | Dentist can report a product defect directly from within the app; report includes device info and context. Bug reports are always handled at no charge — this is the hard line between free support and paid CRO. |

#### FR14: Transactional Communication | P1 | Should

The product must support behavior-triggered communication across the client lifecycle (C.A.R.E. framework: Convert, Activate, Retain, Expand). All communications are behavior-triggered — no message fires on calendar time alone.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR14.1 | Payment receipts sent automatically via email after each recorded payment | Receipt includes clinic name, patient name (anonymized if privacy settings require), amount, date, and payment method |
| FR14.2 | Appointment confirmation and reminder delivery | Confirmations sent on booking; reminders sent at configurable intervals before the appointment (e.g., 24hr, 1hr) |
| FR14.3 | Re-engagement trigger: system detects 14 consecutive days of no login after activation | Triggers outreach notification (channel: Messenger/email via integration) — the first churn inflection point |
| FR14.4 | License and payment status notifications | Installment payment reminders, license activation confirmations, and storage capacity warnings delivered via email |

#### FR15: Data Migration & Onboarding Path | P1 | Should

Data migration fear is the #1 switching cost. The launch playbook routes new users at first contact: "Are you migrating from another system, or are you setting up fresh?" The product must support both paths.

| Req | Description | Acceptance Criteria |
|---|---|---|
| FR15.1 | Onboarding routing: "migrating from another system" vs "starting fresh" | First-run wizard presents the choice; each path leads to segment-appropriate onboarding flow |
| FR15.2 | CSV/structured data import for patient records | Dentist or CRO support can import patient records from a CSV file; import validates data format and flags errors before committing |
| FR15.3 | Parallel-run support | Product does not require the dentist to abandon their existing system immediately; no exclusivity constraint — dentist can use both systems during transition |
| FR15.4 | Migration status visibility | For CRO-assisted migrations, dentist can see import progress and any records that require manual review |

---

### 8.2 Phase 2: Growth

**Adds persona:** Small Group Practice (GP) via Group license tier. Adds desktop/web access and advanced integrations.

#### FR16: Multi-Dentist Workspace (Group Tier) | P0

The Practice-to-Group boundary is a clinical and regulatory necessity, not an artificial restriction. Philippine prescriptions must carry the prescribing dentist's PRC license number and signature. A shared Practice license means one dentist's PRC credentials appear on another dentist's prescriptions — a regulatory compliance risk. Per-dentist workspace gives each dentist their own clinical identity.

| Req | Description |
|---|---|
| FR16.1 | Multiple dentist profiles per clinic, each with their own PRC-linked prescriptions |
| FR16.2 | Per-dentist scheduling with individual calendars |
| FR16.3 | Per-dentist revenue attribution and performance dashboard |
| FR16.4 | Per-dentist procedure audit trail |
| FR16.5 | Unlimited staff logins with role-based access |
| FR16.6 | Color-coding by dentist for visual differentiation across shared views (MyMeds has this — table stakes for multi-dentist) |

#### FR17: Desktop / Web Access | P1

| Req | Description |
|---|---|
| FR17.1 | Web-based access to clinic data for administrative tasks (scheduling, reporting, patient lookup) |
| FR17.2 | Data synchronized between iPad and web via cloud backup infrastructure |

#### FR18: Payment Integration | P0

| Req | Description |
|---|---|
| FR18.1 | GCash and Maya payment collection through a hosted checkout flow |
| FR18.2 | Bank transfer and QR Ph support |
| FR18.3 | Bank/cheque payment tracking with reference number and branch fields (Dentrix feature valued by D-009) |
| FR18.4 | Payment reconciliation dashboard |

#### FR19: Patient Communication | P1

| Req | Description |
|---|---|
| FR19.1 | Appointment reminder notifications (SMS or push) |
| FR19.2 | Follow-up reminders for incomplete treatment plans |

#### FR20: Referral Program | P1

Peer referral is the primary acquisition channel. The referral program must be product-integrated — not a separate system.

| Req | Description |
|---|---|
| FR20.1 | Unique referral link per clinic, shareable via Messenger/Viber in <30 seconds |
| FR20.2 | Named referral landing: referred dentist sees "Dr. [Name] invited you to Dentalemon" |
| FR20.3 | Activation-gated rewards: referral credit triggers only when the referred clinic completes activation (patient record + appointment + billing entry), not on signup |
| FR20.4 | Referral tier tracking: referrer progress visible in-app (Bronze / Silver / Gold based on activated referrals) |
| FR20.5 | Pre-written shareable messages (Tagalog and English) accessible from the referral section |

#### FR21: Version Upgrades | P1

| Req | Description |
|---|---|
| FR21.1 | Minor version updates (bug fixes, small improvements) delivered free to all license holders |
| FR21.2 | Major version upgrades available via Update Pass (annual) or per-version one-time purchase |
| FR21.3 | Current version continues to function indefinitely if the dentist chooses not to upgrade |

---

### 8.3 Phase 3: Scale

#### FR22: Multi-Location Support | P2

| Req | Description |
|---|---|
| FR22.1 | Practice-level view across multiple clinic locations |
| FR22.2 | Per-location data isolation with cross-location reporting |

#### FR23: Advanced Analytics | P2

| Req | Description |
|---|---|
| FR23.1 | Trend analysis across configurable time periods with forecasting |
| FR23.2 | Benchmarking against anonymized aggregate data (if sufficient installed base) |

#### FR24: Android Tablet Support | P2

| Req | Description |
|---|---|
| FR24.1 | Dentalemon available on Android tablets (Samsung Galaxy Tab as primary target) |
| FR24.2 | Feature parity with iPad version |

---

## 9. User Flows

### 9.1 Patient Treatment Session (Phase 1)

```
Dentist opens Dentalemon → Patient list
    ↓
Selects patient (search or browse) → Workspace shell opens
    ↓
Workspace displays:
    Top bar: patient name + date picker + action icons
    Center: Timeline carousel — active session chart in front, past visits stacked behind
    Bottom: Breakdown table (empty for new session, or with existing planned treatments)
    ↓
Dentist swipes carousel to review past visits (optional — read-only historical charts)
    ↓
Dentist taps tooth on the active (front) chart card
    ↓
Right slideout opens at Step 1:
    Step 1: Tooth overview — identity, recent records, "Create Record" to proceed
    Step 2: Select surfaces (interactive diagram + "All" toggle) + assign conditions
    Step 3: Select treatment filtered by dental specialty → "Apply"
    Step 4: Review summary + record notes → "Save & Close"
    ↓
Treatment row appears in breakdown table → grand total updates
    ↓
Dentist performs treatment → taps "Mark Done" on the row
    ↓
Row moves from estimated pool to completed pool
    Footer updates: Estimated total (all) and Checkout total (completed only)
    ↓
Session complete → Dentist taps "Checkout · ₱X" button (bottom-right)
    ↓
Payment modal opens:
    Invoice generated (e.g., INV-2026-0312) with completed treatments total
    ↓
    Record payment(s): cash / bank transfer / credit card / Generate Payment Link
    Each payment shows: method, amount, staff attribution ("Received by: Front Desk")
    Remaining balance displayed if partial payment
    ↓
    Receipt: Print Receipt / Send via Email / Send via SMS
    ↓
    "Complete" closes the payment modal
    ↓
Schedule next appointment (optional)
    ↓
Return to patient list
```

**Edge cases:**

- Patient has outstanding balance from previous visits → balance shown prominently on patient profile; current session invoice is separate
- Partial payment → remaining balance tracked on invoice (stays "Open"); feeds into patient debt (FR5)
- Treatment price changes mid-session → inline price edit on breakdown row via overflow menu
- Dentist wants to remove a treatment → overflow menu (⋮) → remove with confirmation
- Patient is PWD/Senior → discount auto-applied to billing total
- Patient is pediatric → carousel chart switches to deciduous dentition (20 teeth)
- Dentist swipes to a past visit → breakdown table updates to show that visit's treatments (read-only); swiping back to front restores the active session

### 9.2 New Patient Registration (Phase 1)

```
Dentist/staff taps "New Patient"
    ↓
Minimal required fields: name, contact, age/birthdate
    ↓
Optional: PRC-related metadata, medical history, insurance
    ↓
Patient created → option to start session immediately or return to list
```

**Edge cases:**

- Walk-in patient with no appointment → register + add to today's schedule
- Patient already exists (duplicate check by name) → system warns before creating duplicate

### 9.3 Appointment Scheduling (Phase 1)

```
Staff or dentist opens calendar view
    ↓
Selects day + time slot → "New Appointment"
    ↓
Selects patient (search) + procedure type (optional)
    ↓
Appointment created → visible on calendar
    ↓
Day of appointment: patient checked in from calendar → workspace opens
```

**Edge cases:**

- Double-booking → system warns before confirming
- Patient cancels → appointment removed; slot freed
- Walk-in during a busy day → added to day's schedule at next available slot or end of day

### 9.4 End-of-Day Summary (Phase 1)

```
Dentist opens daily summary
    ↓
Views: patients seen, treatments completed, payments collected, outstanding balances
    ↓
Reviews any unpaid balances or incomplete treatments
    ↓
Optional: export daily report as CSV/PDF
```

---

## 10. Monetization Model

### Pricing Model: Stand-Alone License (One-Time Payment)

Every Philippine dental software competitor uses subscription. Dentalemon's stand-alone license is the primary commercial differentiator — aligned with local-first principles (user ownership, data durability, no vendor dependency).

| Component | Model | Rationale |
|---|---|---|
| Stand-alone license | One-time purchase, permanent ownership; 3 tiers (Solo / Practice / Group). 6-month installment option available for all tiers. | Buyers think in "purchase" terms, not "rent." Subscription fatigue confirmed by D-009. Break-even vs. subscription competitors at 13-23 months. Installment removes upfront barrier — WTP demo participants proposed installment unprompted (6-month max preferred). |
| Cloud storage expansion | One-time fixed-price storage blocks (purchased as needed) | No monthly storage invoices. Patient records should not be subject to recurring billing. |
| CRO support | Per-request professional services (consultation, custom mods, data migration, training) | Avoids "hidden subscription" perception. Buyer pays only when they need something. |
| Version upgrades | Major versions paid (Update Pass annual or per-version one-time); minor versions free | Current version always functional. No forced upgrades. |
| Success Suite | Optional subscription bundle (Update Pass + priority support + CRO consultations) | For buyers who want "one invoice, everything covered." Requires active stand-alone license — not an alternative to the license. |

### Revenue Drivers

| Driver | Mechanism |
|---|---|
| Stand-alone license sales | Primary Year 1 revenue; demo-led sales motion through PDA peer networks |
| Cloud storage expansion | Natural demand-driven revenue as practices grow; clinics buy more when their data grows, not on a billing schedule |
| CRO professional services | Data migration from MyMeds/MYCURE, staff training, custom workflow modifications |
| Success Suite adoption | Recurring revenue from Practice/Group tier buyers who want bundled convenience |
| Version upgrades | Periodic revenue from major version releases |

---

## 11. Go-to-Market Strategy

### Recommended: Demo-Led, Peer-Referral-First, Controlled Launch

The target buyer is a deliberate evaluator who needs to see the product. Trust in the PH dental community travels through professional networks (PDA chapters, classmate networks), not through ads or self-service trials.

1. **Complete WTP validation** — 3-5 structured WTP conversations to lock pricing tiers
2. **Early Bird Member cohort (10-20 clinics)** — invite-only, selected by strategic fit (PDA involvement, practice type, geography). Discounted licensing with structured commitment: complete onboarding within 30 days of activation, monthly product feedback session for 3 months, willingness to serve as reference (opt-in). Early Bird Members receive permanent "Early Bird Member" designation in-app, direct product roadmap input, and first CRO consultation at no charge.
3. **Waitlist processing (20-50 clinics)** — invitations in batches, validate onboarding at scale
4. **Public launch** — demo-request gated (not self-serve signup)

### Key Milestones

| Milestone | When | Target |
|---|---|---|
| Pricing locked | Pre-launch | WTP validation complete; tiers confirmed |
| Early Bird Member cohort live | Phase 1 launch | 10-20 clinics, real patient data, real payments |
| Pilot validation | +2 months | Measurable improvement vs. pre-Dentalemon baseline |
| Waitlist launch | +3 months | 20-50 clinics onboarded; onboarding holds at volume |
| Public launch | +6 months | Demo-request flow live; peer referral as primary acquisition |

### Identified Champions

D-009 (Dr. Aves): Past president of PDA Mandaluyong chapter, Board of Trustee member, HOD delegate, ethics committee member. High-intent software switcher (MyMeds user, evaluated Dentrix). Direct entry point into PDA chapter networks — the highest-trust referral vector in Philippine dentistry.

---

## 12. Risks & Assumptions

### Assumptions

| # | Assumption | Impact if Wrong | Status |
|---|---|---|---|
| A1 | Mid-to-high tier solo practitioners will pay ₱25K-35K one-time for dental software | Revenue model fails; must explore alternative pricing | Directional — ₱30K sweet spot and ₱50K ceiling from 2 informal WTP participants; formal validation pending |
| A2 | Dental-native charting is a purchase-driving leader feature | Product differentiation thesis collapses | Validated — D-009, D-004 behavioral data; named as #1 purchase driver in cross-interview analysis |
| A3 | Stand-alone license is preferred over subscription in this market | Must pivot to subscription; loses pricing moat | Directional — D-009 subscription fatigue signal + WTP demo participant behavior (proposed installment unprompted) |
| A4 | PDA peer networks are the primary trust and acquisition channel | Must find alternative GTM channel; slower adoption | Validated — market structure confirms; D-009 profile provides direct PDA network access |
| A5 | Demo-led sales motion is the right approach | Must explore self-serve or other acquisition models | Validated — D-009 evaluated Dentrix; D-004 evaluated Practo + Mediks; both are deliberate evaluators |
| A6 | iPad adoption is sufficient in the target market for an iPad-first product | Addressable market is smaller than projected; must add Android earlier | Partially validated — estimated 15-35% iPad ownership in target segment (proxy data); 2/4 target-segment participants own iPads. iPad-first is a moat but also a niche constraint. |
| A7 | CRO per-request billing will be perceived as fair, not as hidden cost | Must redesign support model; possible churn risk | Unvalidated — MYCURE precedent only; needs buyer testing |
| A8 | Paper-pending is a viable secondary segment worth GTM investment | Wasted marketing/onboarding resources on low-conversion segment | Partially validated — D-010 (n=1) shows strong individual signals but segment-level patterns unconfirmed |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| iPad ownership too low in target segment for iPad-first strategy | Medium | High | iPad-first, not iPad-only — web access in Phase 2; monitor Android demand signal; consider tablet financing/bundle partnerships |
| MyMeds or MYCURE adds dental-specific features | Low | High | Move fast; the UX quality gap and pricing model gap are harder to close than individual feature gaps |
| Data migration fear prevents switching | High | Medium | Address proactively in sales motion; offer CRO migration service; parallel-run messaging ("keep both systems until you're ready") |
| Total cost stacking (iPad + license) exceeds ₱50K WTP ceiling | Medium | High | BYOD messaging for existing iPad owners; consider refurbished iPad programs; installment option for license reduces upfront shock |
| WTP validation reveals ₱30K is aspirational, not real | Medium | Very High | Run structured Van Westendorp before committing to pricing; maintain flexibility in tier structure |
| Low digital literacy in paper-pending segment slows adoption | Medium | Medium | In-app Dr. Lemon guided onboarding; tutorial videos; CRO training option; design for the transitional majority |

---

## 13. Success Metrics

### Activation Definition

A clinic is **activated** when all three milestones are complete:

1. First patient record created
2. First appointment scheduled
3. First billing entry added

These three actions represent the core dental workflow loop: clinical record, scheduling, revenue. Any two of three is insufficient. All three can be completed in a single 30-minute onboarding session with a real patient — making activation a realistic Day 1 milestone, not a Week 6 aspiration. Activation gates referral program eligibility and triggers retention sequences. During Phase 1 (Early Bird cohort), referral is handled manually via Messenger/Viber sharing of pre-written messages; product-integrated referral features (FR20: unique links, in-app tracking, tier progression) ship in Phase 2.

### MVP Success (Phase 1 Launch)

| Metric | Target |
|---|---|
| Early Bird clinics activated | >= 10 |
| Patients entered into system | >= 500 across all clinics |
| Treatments recorded | >= 1,000 |
| Payments recorded | >= 100 |
| Onboarding completion rate | >= 80% within 30 days |
| Critical bugs blocking daily use | 0 |

### Growth Success (Phase 1 + 6 months)

| Metric | Target |
|---|---|
| Total clinics on platform | >= 50 |
| Daily active clinics (weekly avg) | >= 60% of total |
| Online payment adoption | >= 20% of transactions (if Phase 2 GCash/Maya live) |
| Net promoter score | >= 40 |
| Referrals from Early Bird cohort | >= 3 per Early Bird clinic |
| Monthly churn | 0% (stand-alone license — churn = stops using, not cancellation) |

### Scale Success (Month 18)

| Metric | Target |
|---|---|
| Total clinics on platform | >= 200 |
| Group tier adoption | >= 10 multi-dentist clinics |
| Success Suite adoption | >= 20% of Practice/Group buyers |
| Cloud storage expansion purchases | >= 40% of active clinics |
| Platform revenue | Positive unit economics |

---

## 14. Implementation Roadmap

| Phase | Months | Focus | Key Deliverables |
|---|---|---|---|
| **Pre-launch** | 0-2 | Validation | WTP conversations complete, pricing locked, demo script validated, Early Bird cohort identified |
| **Phase 1** | 2-6 | Core product | Dental workspace, charting, scheduling, billing, debt tracking, reporting, cloud backup, onboarding — iPad app live |
| **Early Bird** | 6-8 | Pilot validation | 10-20 clinics live, feedback loops active, baseline metrics established |
| **Phase 2** | 8-14 | Growth | Group tier, web access, GCash/Maya integration, patient reminders, Success Suite |
| **Phase 3** | 14-24+ | Scale | Multi-location, Android support, advanced analytics, 200+ clinics |

---

## 15. References

### Research Documents

| Document | Path |
|---|---|
| Research Evidence Synthesis | `strategy/research-evidence-synthesis.md` |
| Business Model Architecture | `strategy/business-model-architecture.md` |
| Pricing Plans — Comprehensive Strategy | `strategy/pricing-plans-comprehensive.md` |
| Competitive Landscape 2026 | `strategy/competitive-landscape-2026.md` |
| Feature Comparison 2026 | `strategy/feature-comparison-2026.md` |
| GTM Strategy Sketch 2026 | `strategy/gtm-strategy-sketch-2026.md` |
| iPad/Tablet Adoption — PH Dental Practices | `research/literature/ipad-tablet-adoption-ph-dental-practices.md` |
| Interview Transcripts (D-004 through D-012) | `research/transcripts/dentists/` |
| Launch Playbook — Phase 1 Operations | `strategy/launch-playbook-phase1.md` |
| Referral Program Skeleton | `strategy/referral-program-skeleton.md` |
| Client Lifecycle Communication Plan | `strategy/client-lifecycle-communication-plan.md` |

### Legislation / Standards

| Law/Standard | Relevance |
|---|---|
| RA 10173 (Data Privacy Act 2012) | NPC compliance; data processing agreements; patient data portability |
| PRC Regulations | Dentist licensing; PRC number on prescriptions |
| Philippine PWD Act (RA 7277) / Senior Citizens Act (RA 9994) | Mandatory discount application |

### External Sources

| Source | Relevance |
|---|---|
| StatCounter (2026) | Philippine device market share data |
| IMARC Group (2024) | Philippine tablet market size and forecast |
| RenTech Digital (2024) | Philippine dental clinic count (9,976 clinics, 97.6% solo) |
| Hofer et al. (2025), Healthcare | Technology Readiness Index in dental practices (German benchmark) |
| Shin et al. (2025), SAGE | Digital dentistry adoption barriers in Southeast Asia |
| Molarsoft website (2026) | Competitor pricing reference (₱1,499/month) |
