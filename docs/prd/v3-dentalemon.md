# Dentalemon — Product Requirements Document

**Version 3.0 · Phase 1 · May 2026**

---

## 1. Executive Summary

### 1.1 Product Vision

Dentalemon is a dental-native practice management system that makes browsing patient dental history as intuitive as flipping through album covers. Built for solo dentists and small practices worldwide, it combines a revolutionary Timeline Carousel for visual visit browsing with a Per-Tooth Timeline for longitudinal tooth history — all running offline-first on iPad and desktop with zero-friction multi-device sync and PMD (Portable Medical Document) compliance for health record interoperability.

### 1.2 Problem Statement

No dental-native practice management system serves the global market affordably. Dentrix (the market leader) is US-only and subscription-locked. Competitors in emerging markets (MYCURE, Mediks, Molarsoft) are general clinic systems adapted for dental use — they lack dental-native charting, the #1 purchase driver. Dentists compensate with workarounds: hiring extra staff, maintaining parallel paper records, and memorizing patient charts because their software has no visual chart navigation.

### 1.3 Key Differentiators

| Differentiator | What It Means |
|---|---|
| **Timeline Carousel** (UX differentiator) | Browse dental visit history like album covers — instant visual comparison across visits. No other dental software does this. |
| **Per-Tooth Timeline** (technical differentiator) | Tap any tooth to see its complete history across all visits — conditions, treatments, images. The coded data model behind this is the defensible moat. |
| **Patient Cabinet** | Records organized like a file cabinet — patient (cabinet) → visit (folder) → records (files). Intuitive, shareable in Phase 2. |
| **PMD-Compliant** | Generates portable medical documents per visit. Patient carries their dental records on their phone. Works with any PMD-compatible provider. |
| **Local-First** | Works fully offline. Data lives on your device. Cloud is backup, not dependency. Zero downtime from network issues. |
| **Global-Ready** | Generic core + localization layer. Philippines first, extensible to any country's regulations, currency, and tooth notation. |
| **Enterprise-Ready Architecture** | Multi-branch, multi-dentist data model from day one. Solo dentist today, dental group tomorrow — no migration needed. |

---

## 2. Product Overview

### 2.1 Product Description

Dentalemon is a cross-platform dental clinic management system. It runs as a native app on iPad and Mac, with optional browser access via a facility server. It covers the complete clinical and operational workflow: charting, treatment planning, scheduling, billing, reporting, practice administration, and health record portability via PMD.

### 2.2 Target Market and Personas

**Primary market:** Solo dentists and small practices (1-5 dentists). Philippines first launch, global expansion planned.

#### Persona 1: Solo Dentist (Primary User)

- **Profile:** Independent dental practitioner, owns or leases a single clinic, works with 1-2 assistants
- **Pain points:** Current software is either too expensive (Dentrix), too generic (general clinic systems), or paper-based. Spends unnecessary time on record management instead of patient care.
- **Goals:** Fast charting, visual patient history, simple billing, no IT overhead
- **Tech comfort:** Uses iPhone/iPad daily, prefers touch-first interfaces

#### Persona 2: Dental Assistant / Staff

- **Profile:** Front-desk or chairside assistant, handles scheduling, patient registration, payment collection, follow-ups
- **Pain points:** Switches between multiple systems (paper calendar, spreadsheet, notebook). Can't quickly find patient records or check who owes money.
- **Goals:** One system for all operational tasks. Quick patient search. Clear follow-up lists.

#### Persona 3: Practice Owner (Multi-Dentist)

- **Profile:** Owns a practice with 2+ dentists, multiple staff. May have multiple branches.
- **Pain points:** No visibility across the practice. Can't see daily production, outstanding receivables, or staff performance from one screen.
- **Goals:** Dashboard-level visibility, role-based access, multi-branch support (Phase 2+).

#### Persona 4: Software Switcher

- **Profile:** Currently using another dental or clinic management system. Considering switching.
- **Pain points:** Afraid of data loss during migration. Needs to import existing patient records.
- **Goals:** Easy data import, familiar workflows, better charting than current system.

### 2.3 Key Constraints

| Constraint | Detail |
|---|---|
| Local-first / offline-first | All data stored on-device. App works fully offline. Cloud is backup and sync relay, not source of truth. |
| iPad-first, desktop-functional | Primary device is iPad (tablet for dentist chairside use). Desktop (Mac) for assistant operational work. Same layout for both — iPad landscape and Mac desktop viewports are equivalent. |
| iPad-native interactions | Apple Pencil support (annotation, e-signatures). Gesture shortcuts for gloved hands (two-finger tap to undo, pinch-to-zoom on chart, three-finger swipe for patient switch). Split View multitasking support. |
| Multi-user, multi-device | Dentist + assistant minimum from day one. Multiple devices sync via CRDT-based conflict-free replication. |
| PMD-compliant | All clinical data uses standard medical codes (ICD-10, CDT, SNOMED CT, RxNorm). Visit records exportable as PMD files. |
| Data privacy compliance | Localization layer handles per-country regulations. PH: RA 10173 (DPA). US: HIPAA readiness. EU: GDPR. Encryption at rest. |
| Clinical records compliance | Past records immutable. Corrections via additive amendments. Full audit trail. |
| Touch-optimized | All interactive elements ≥ 44×44px. Gesture support (swipe, tap, long press). Works with gloved/damp hands. |
| Accessibility | WCAG 2.1 AA compliance. Screen reader support for navigation and forms. Reduced-motion mode. |

### 2.4 Deployment Model

Dentalemon supports three deployment modes:

| Mode | Setup | Best For |
|---|---|---|
| **Standalone** | Native app (Mac, iPad) with local storage. Syncs to cloud. | Solo dentist, single device. |
| **Facility Server** | Dedicated machine runs a server app with local database and APIs. Other devices connect via browser over LAN. | Practice with multiple devices. No app install on client devices. |
| **Cloud Server** | Server app hosted in cloud. Browser clients connect over internet. | Web access, remote teams. |

The app works identically across all modes. Sync, API, and server infrastructure are handled by the platform layer.

### 2.5 Phase Roadmap

| Phase | Scope | Key Additions |
|---|---|---|
| **Phase 1 — Core Product** (this PRD) | Solo/Practice end-to-end | Charting, scheduling, billing, reporting, offline-first, PMD compliance, smart attachments, per-tooth timeline |
| **Phase 2 — Growth** | Sharing, voice, multi-branch | Voice-activated charting, record sharing, patient communication, insurance claims, multi-branch UI, periodontal charting, PMD merge + multi-PMD timeline, QR/NFC sharing |
| **Phase 3 — Scale** | Enterprise, marketplace | Multi-branch management, advanced analytics, third-party integrations, Android tablet |

---

## 3. Design Innovation: Timeline Carousel

### 3.1 The Problem

Standard dental software uses table/list views to navigate visit history. The dentist sees a list of dates and has to click into each one to see what happened. There's no visual context — every row looks the same. Comparing tooth states across visits requires opening multiple records and mentally assembling the picture.

This is slow, contextless, and forces dentists to rely on memory instead of their software.

### 3.2 The Solution: Visit-Centric Visual Timeline

The Timeline Carousel presents dental visit history as a horizontal carousel of cards — each card showing a dental chart preview (a visual "fingerprint" of the patient's tooth states at that visit). Swiping between cards is like flipping through album covers. The dentist instantly sees how the patient's dental status has changed over time without opening a single record.

**Interaction model:**
- **Swipe** left/right to browse visits. Spring-physics animation provides tactile feedback.
- **Focal card** (center) shows an interactive dental chart — teeth are tappable even at card size.
- **Flanking cards** (left/right of focal) are scaled down with perspective tilt, creating a Cover Flow depth effect.
- **Dock magnification** — cards near the center scale up smoothly as they approach focus (inspired by macOS Dock).
- **"+" card** at the rightmost position creates a new visit for today. If the dentist adds nothing, the empty visit auto-discards.
- **Tap a tooth** on the focal card to open the slideout wizard for condition/treatment recording.

### 3.3 Analogues and References

| Reference | What We Borrow |
|---|---|
| Apple Cover Flow (iTunes, Finder) | 3D perspective cards with focal center, flanking cards tilted and receded |
| macOS Dock magnification | Proximity-based scaling — cards grow as they approach the center |
| Medical chart comparison | Side-by-side visual comparison of clinical states across time points |

### 3.4 Scalability: Year-Based Grouping

For patients with long visit histories, year-based tabs keep the carousel manageable:

- Tab bar above the carousel: `[2026] [2025] [2024] [All]`
- Current year selected by default
- Each year tab shows only visits from that year
- "All" tab shows the complete history
- Tabs appear when visit history spans more than 1 year

### 3.5 Acceptance Criteria

- AC3.1: Swiping between visits feels smooth with spring-physics animation (60fps minimum)
- AC3.2: Dental chart preview on each card shows recognizable tooth state patterns (color-coded conditions)
- AC3.3: Tapping a tooth on the focal card opens the condition recording slideout
- AC3.4: Year tabs appear when history spans more than 1 year
- AC3.5: "+" card creates a new visit; empty visits auto-discard on workspace close
- AC3.6: Reduced-motion mode replaces 3D transforms with a flat 2D layout
- AC3.7: Tap vs. swipe disambiguation works reliably (10px threshold)
- AC3.8: Maximum 5 cards visible simultaneously (focal + 2 left + 2 right); cards beyond ±2 removed from render tree for performance

---

## 4. Design Innovation: Per-Tooth Timeline

### 4.1 The Problem

Visit-level browsing answers "what happened on March 5?" Per-tooth browsing answers "what has ever happened to tooth #14?" No competitor does this well. Dentists currently rely on memory or manual chart review to build a tooth's longitudinal history.

### 4.2 The Solution: Tooth-Level Longitudinal View

Tapping a tooth in the workspace opens a chronological history of everything that has happened to that specific tooth across all visits:

- **Conditions** diagnosed at each visit (with dates and ICD-10 codes)
- **Treatments** performed or planned (with CDT codes and status)
- **Images** tagged to that tooth (x-rays, intraoral photos — see Smart Attachments §5.1.FR1.21)
- **Lab orders** related to that tooth (crowns, bridges — see §5.1.FR1.24)

### 4.3 Interaction Model

- Tap any tooth on the dental chart → slideout panel opens
- If tooth has history across multiple visits, "History" tab appears in the slideout
- History tab shows reverse-chronological list: most recent visit first
- Each entry shows: visit date, condition, treatment, status, treating dentist
- Tap an entry to jump to that visit's card in the carousel
- Images tagged to this tooth shown as thumbnails; tap to open in lightbox

### 4.4 Acceptance Criteria

- AC4.1: Per-tooth history shows all visits where this tooth had any recorded activity
- AC4.2: History entries link back to the visit card in the carousel
- AC4.3: Images tagged to this tooth display as thumbnails in the history
- AC4.4: History loads in under 1 second for patients with up to 100 visits
- AC4.5: Empty state: "No history for this tooth" with option to record first condition

---

## 5. Information Architecture: Patient Cabinet Model

### 5.1 The Metaphor

Dentalemon organizes patient records using a file cabinet metaphor:

```
PATIENT (Cabinet) — all records for one patient
  └── VISIT (Folder) — one encounter's records
        ├── Dental Chart — tooth conditions at this visit
        ├── Treatments — conditions, plans, work done
        ├── Visit Notes — clinical observations (optional)
        ├── Prescriptions — medications prescribed
        ├── Consent Forms — signed consent documents
        ├── Attachments — x-rays, photos, documents (smart-tagged)
        ├── Lab Orders — prosthetic work orders
        ├── Invoice/Payment — billing for this visit
        └── PMD — portable medical document (auto-generated)
```

### 5.2 Navigation Flow

```
Patient List (grid of compact folder cards)
  → Tap patient card
    → Workspace opens (inside this patient's cabinet)
      → Timeline Carousel (browse visit folders)
        → Tap tooth / record treatment (work with files inside a folder)
        → Tap tooth → History tab (per-tooth timeline across folders)
```

The Workspace IS the view inside an open cabinet. The Timeline Carousel IS the way you browse folders in that cabinet.

### 5.3 Data Model Principles

- Every record has ownership fields: `created_by`, `owned_by`, `visibility`
- Permissions and ACLs are part of the schema from day one
- Phase 2 adds sharing UI on top of this foundation:
  - Share a cabinet = referral (entire patient record to a specialist)
  - Share a folder = second opinion (one visit's records)
  - Share a file = send an x-ray to insurance

### 5.4 Patient Folder Card — Compact + Expand Spec

Each patient is represented by a compact folder-shaped card in the Patient List grid:

**Compact view (default):**

| Element | Content |
|---|---|
| **Folder tab** | Patient photo (or initials avatar) |
| **Name** | LAST NAME (prominent), First Name + Middle Initial |
| **Status badge** | Active (green), Pending (amber), Archived (gray), In Session (blue pulse) |
| **Visit summary** | Visit count + last visit date (e.g., "12 visits · Last: Mar 5") |
| **Overdue alert** | Red badge with amount (only shown if balance > 0, e.g., "₱5,000 overdue") |

**Expanded view (on long-press):**

| Element | Content |
|---|---|
| All compact elements | Plus: |
| **Demographics** | Gender icon + age (calculated from DOB) |
| **Allergy badge** | ⚠ icon (only shown if patient has recorded allergies) |
| **Recall status** | "Due: Jun 2026" or "Recall overdue" (if next visit date has passed) |
| **Active meds count** | "3 active medications" (Safety Floor indicator) |
| **Overflow menu** (⋮) | Open Workspace, View Profile, Archive, Export |

**Interactions:**
- Tap card → opens Workspace for that patient
- Long press → shows expanded view with overflow menu
- Overdue badge → navigates to patient billing detail

**Layout description:** Cards arranged in a responsive grid. 3 columns on iPad landscape, 2 columns on iPad portrait. Cards are fixed height in compact mode. Expanded card overlays adjacent cards (does not reflow grid).

### 5.5 Patient List View Modes

- **Grid view** (default): compact folder cards in responsive grid
- **"Needs Follow-Up" filter**: shows only patients with overdue balances, missed appointments, or pending payment plan installments
- **Search**: real-time partial match across name, contact, notes (< 1s response, 300ms debounce)
- **Sort**: by name, last visit date, status, outstanding balance

---

## 6. User Stories and Functional Requirements

**Priority tiers for epic sequencing:**
- **P0 (Core):** Must ship for the product to function. Build first. Dental Workspace (FR1.x), Patient Records (FR2.1-2.4), Auth (FR9.x), Sync (FR10.x).
- **P1 (Important):** Daily workflow features. Build second. Scheduling (FR3.x), Billing (FR4.x), Dashboard (FR0.x), Staff & Roles (FR6.x).
- **P2 (Complete):** Polish, compliance, analytics. Build third. Reports (FR5.x), Onboarding (FR7.x), Settings (FR8.x), Localization (FR11.x), PMD (FR12.x), empty states, accessibility, print support.

### 6.0 Dashboard (Morning Briefing / End-of-Day)

The Dashboard is the dentist's default landing page. It provides a morning briefing and end-of-day summary in one view.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR0.1 | Today's Schedule summary | Shows appointment count, next patient name + time, time gaps in schedule |
| FR0.2 | Overdue Alerts | Lists patients with overdue balances or missed appointments, sorted by amount |
| FR0.3 | Pending Treatments | Shows accumulated carry-over count across all patients with pending treatments |
| FR0.4 | Daily Collections | Total payments received today, with comparison to yesterday |
| FR0.5 | Tomorrow Preview | Next day's appointment count and first appointment time |
| FR0.6 | Quick Actions | Buttons: + New Patient, + New Appointment, Open Workspace (shows recent patient) |
| FR0.7 | Active Payment Plans | Summary of all active payment plans: count, total outstanding, any plans behind schedule |
| FR0.8 | Lab Order Status | Count of pending lab orders with expected delivery dates this week |

**Role-based Dashboard views:**
- **Dentist-Owner / Dentist:** Full dashboard (schedule, overdue alerts, pending treatments, daily collections, tomorrow preview, quick actions, payment plans, lab orders)
- **Staff - Full Operations:** Simplified dashboard (today's schedule, patients needing follow-up, recent registrations. No financial totals.)

**Layout description:** Dashboard uses a card grid layout. Each metric is a card with a large number, label, and optional trend indicator. Quick Actions is a horizontal button row at the top. Cards reflow based on viewport width. iPad landscape: 3 columns. iPad portrait: 2 columns.

---

### 6.1 Module 1: Dental Workspace

The Workspace is the centerpiece of Dentalemon. It's a full-screen clinical environment where the dentist examines, diagnoses, treats, and records everything about a patient visit — without ever navigating to another screen.

#### Workspace Shell

The Workspace uses a two-zone layout with a draggable divider and persistent footer:

| Zone | Content |
|---|---|
| **Top bar** (56px) | Patient selector ▼ · **Safety Floor** (allergies, meds, conditions — see FR12.3) · Date/baseline picker · Action icons: Rx, Consent, Attachments, Lab Orders · View toggle |
| **Top zone** (draggable) | Timeline Carousel — interactive dental chart cards |
| **Draggable divider** | Horizontal drag handle between zones. User sets preferred ratio. Persists per user. Default: 50/50. |
| **Bottom zone** | Visit Notes (collapsible) + Breakdown Table |
| **Persistent footer** | Pending count + Grand Total + "Continue to Payment" CTA |

**Never-navigate rule:** All clinical interactions happen as overlays (slideouts, modals, sheets) on the Workspace. The dentist never leaves this screen during a patient visit.

**Draggable divider:** User can drag the divider up (more table space) or down (more carousel space). Position persists per user preference. Double-tap divider to reset to 50/50. Minimum zone height: 150px (prevents either zone from being fully collapsed via drag — use the collapse toggle instead).

**Collapsible carousel:** A toggle collapses the top zone to a thin strip (showing visit date + selected tooth info), giving the bottom zone full height. Expand to resume carousel browsing. This is separate from the draggable divider — collapse hides the carousel entirely.

**Full-screen chart overlay:** Tapping the dental chart on the focal card opens it in a full-screen overlay with pinch-to-zoom, pan, and Apple Pencil annotation support. Dismiss (tap outside or swipe down) returns to the workspace. This provides detailed examination without permanently enlarging the carousel zone.

**Layout description:** Full viewport, no sidebar. Top bar uses glass effect (translucent background with blur). Footer is sticky bottom. When slideout panel is open (320px on iPad Pro, 380px adjustable), workspace content shrinks horizontally — slideout is not an overlay. In narrow viewports (iPad portrait, Split View), slideout becomes a bottom sheet instead of side panel.

#### Functional Requirements

| ID | Requirement | Detail |
|---|---|---|
| FR1.1 | Timeline Carousel | Visit browsing with year tabs, interactive focal card, "+" to create new visit. See Section 3 for full spec. |
| FR1.2 | Collapsible Carousel Zone | Expand/collapse toggle. Collapsed state shows visit date + selected tooth as a thin strip. |
| FR1.3 | Draggable Divider | Horizontal divider between carousel and breakdown table. User-adjustable, persists per user. Default 50/50. Double-tap to reset. |
| FR1.4 | Interactive Dental Chart | SVG rendering of all teeth (adult 32 / pediatric 20). Per-tooth, per-surface condition tracking. Tappable on focal card (tap target = whole tooth, not individual surfaces — surfaces selected in full-size slideout). Tooth numbers displayed per configured notation system (FDI/Universal/Palmer). Full-screen overlay on tap for detailed view with pinch-to-zoom and Apple Pencil annotation. |
| FR1.5 | Tooth State Machine | **Tooth states** (per-tooth cumulative status): Healthy → Condition Present → Treated/Restored → Extracted → Missing. Color coding: amber = has active condition, blue = treated, gray = missing, X = extracted. **Note:** Tooth state and treatment lifecycle are parallel but distinct. Tooth state tracks the physical condition of the tooth. Treatment lifecycle (see data model §11.2) tracks what's been planned/performed. A tooth can be "Treated" (state) while having a new treatment "Diagnosed" (lifecycle). |
| FR1.6 | Tooth Condition Recording | Right-side slideout panel (320-380px based on device). **Shrinks** workspace (not overlay) so chart remains visible. Adaptive stepper: 3 steps (new tooth) or 4 steps (tooth with history adds Overview). Steps: Condition (grouped) → Surface selector → Treatment Plan (grouped by specialty) → Review. **Surface selector:** 5 standard surfaces adapt labels based on tooth position — anterior teeth: Buccal, Mesial, Distal, Incisal, Palatal/Lingual. Posterior teeth: Buccal, Mesial, Distal, Occlusal, Lingual. **Cervical toggle:** enables selection of cervical zone (gum-line region) for conditions like cervical caries, abrasion, abfraction. When ON, cervical region becomes selectable alongside standard surfaces. Per-tooth notes field. All conditions and treatments are recorded with standard codes (ICD-10 for conditions, CDT for treatments) — mapped automatically from the user-facing labels. |
| FR1.7 | Per-Tooth Timeline | "History" tab in the slideout panel. Shows chronological history of all activity on this tooth across all visits. See Section 4 for full spec. |
| FR1.8 | Treatment Templates | Pre-configured multi-tooth procedures (e.g., "Full Mouth Prophylaxis" auto-populates all 32 teeth). Configurable in Settings. Triggered from a "Quick Actions" button in the workspace. |
| FR1.9 | Bottom Zone Content | Visit Notes: collapsible free-text field (optional, configurable as SOAP template in Settings). Breakdown Table: Tooth, Surface, Condition, Treatment Plan, Work Done, Status, Total. No tabs — single scrollable surface. |
| FR1.10 | Persistent Payment Footer | Always visible: pending treatment count + grand total amount + "Continue to Payment" button. |
| FR1.11 | Treatment Carry-Over | Pending treatments from past visits appear on the current visit's breakdown table. Dentist can dismiss with clinical reason: patient declined, no longer indicated, treated elsewhere, resolved. Dismissed items stay in record with reason. **Dismissals are reversible** — dentist can restore a dismissed treatment to pending status. **Edge case:** If tooth with pending treatments is extracted, pending treatments are auto-dismissed with reason "Tooth extracted" (logged in audit trail). |
| FR1.12 | Prescriptions (Rx) | Top bar icon opens Rx sheet overlay. Fields: drug name (with RxNorm code lookup), dosage, frequency, duration, instructions. Prescribing dentist info auto-populated (locale-dependent: PRC number for PH). **Allergy check:** if prescribing a drug the patient is allergic to, show blocking warning requiring explicit override acknowledgment. |
| FR1.13 | Consent Forms | Top bar icon opens consent sheet. Configurable templates per procedure type. E-signature capture (canvas with undo/clear — Apple Pencil supported). Signed consent stored as document in visit folder. |
| FR1.14 | Payment Recording | "Continue to Payment" opens payment modal overlay. Line items from breakdown table. Discount application (locale-dependent: PWD/Senior for PH). Receipt generation (print, email). |
| FR1.15 | Historical/Read-Only Mode | Past visits show as read-only snapshots (what was diagnosed, performed, and pending at that visit). Visual distinction (read-only indicator). "Work on this tooth" link jumps to current visit with that tooth pre-selected. |
| FR1.16 | Clinical Records Compliance | Past records immutable. Corrections via additive amendments (linked to original, both visible). Full audit trail: who, when, what, why. |
| FR1.17 | Visit Lifecycle Management | **Draft:** auto-created when dentist taps "+" or when patient checks in. Discards if empty on workspace close. **Active:** transitions when first record is added (condition, treatment, note, Rx). **Completed:** dentist explicitly closes visit or completes payment. Generates/finalizes invoice. Auto-generates PMD (see FR12.1). **Locked:** 48 hours after status transitions to Completed. Becomes immutable, amendments only. Review period configurable in Settings. |
| FR1.18 | Patient Switching Guard | If current visit has unsaved changes: confirmation dialog "Save changes to [Patient]'s visit?" with Save & Switch, Discard, Cancel. If visit is Draft with no records: auto-discard silently. One active workspace at a time (Phase 1). |
| FR1.19 | Dentition Management | Always show 32-position adult chart layout for ALL patients. Each tooth position has dentition state: Permanent (default), Deciduous, Unerupted, Missing, Extracted. Patients under 12: auto-pre-populate deciduous/unerupted states based on standard eruption patterns. Deciduous teeth shown with distinct visual (smaller, different outline). Manual override available. FDI: positions 11-48, deciduous internally tracked as 51-85. |
| FR1.20 | Baseline Picker | Date picker in the top bar. Selects which visit's dental chart is the "baseline" (reference point). Defaults to today's visit. Selecting a past date navigates the carousel to that visit's card and enters read-only mode (FR1.15). Label shows "Today's Baseline - [date]" for current visit or "[date]" for historical. Syncs with carousel position (swiping carousel updates the picker, changing the picker scrolls the carousel). |
| FR1.21 | Smart Attachments | Top bar icon opens attachments sheet. Upload images (x-rays, intraoral photos, documents). **Smart tagging:** each attachment has: image type (periapical, bitewing, panoramic, intraoral photo, document, other), tooth number(s) it relates to (multi-select from dental chart). **Lightbox viewer:** tap image to view full-screen with pinch-to-zoom, pan, and Apple Pencil annotation. **Per-tooth image links:** when viewing a tooth's slideout panel, shows "N images across M visits" with thumbnails. Tap thumbnail to open in lightbox. **Supported formats:** JPEG, PNG, PDF. **Storage:** warn at 90% device capacity, block new attachments at 95%. Clinical recording continues regardless. |
| FR1.22 | Treatment Plan Presentation | Aggregate pending treatments into a patient-facing treatment plan: list of planned procedures, affected teeth, estimated cost per item, total estimate. Dentist can generate and present to patient. Patient acceptance status tracked (Presented / Accepted / Declined). Accepted plans feed into the carry-over workflow. Print/email the plan as a cost estimate document. |
| FR1.23 | iPad Interactions | **Apple Pencil:** annotate dental chart and x-rays in full-screen overlay. Pen strokes saved per image/chart. **Gestures:** two-finger tap to undo last action, pinch-to-zoom on dental chart, three-finger swipe to switch patient (with save guard). **Split View:** workspace functions in 50/50 and 70/30 iPad Split View. In narrow viewport, slideout panel becomes bottom sheet. Carousel may auto-collapse to thin strip. |
| FR1.24 | Lab Order Tracking | Top bar icon opens lab orders sheet. Create lab order linked to a treatment (e.g., crown for tooth #14). Fields: lab name, order date, expected delivery date, notes. **Status state machine:** Ordered → In Fabrication → Delivered → Fitted. Also: Ordered → Cancelled (with reason). Cannot skip states. Cannot go backward (defective work = new order linked to original). Lab orders visible in per-tooth timeline. Dashboard shows pending lab orders with expected deliveries this week. |

**Edge cases:**
- **EC2:** Pending treatments on extracted tooth → auto-dismiss with reason "Tooth extracted." Logged in audit trail.
- **EC4:** Treatment fee changes mid-visit → price at time of treatment recording is locked. Fee schedule changes apply prospectively only.
- **EC7:** Maximum 1 active visit per patient. Second device attempting new visit gets "Visit already active on [device name]." Two devices CAN edit the same patient record simultaneously (e.g., assistant updates address while dentist has workspace open) — the restriction is on creating a NEW visit.

**Technical risks:**
- **Timeline Carousel** is the highest-risk custom component. Fallback: if full Cover Flow with 3D perspective doesn't meet 60fps targets, ship with flat card carousel (horizontal scroll with snap) and add visual effects iteratively.
- **CRDT sync** for clinical dental records requires careful conflict resolution. Target latency: < 5s on LAN, < 30s via cloud. Define sync failure handling: if sync fails, data stays local, user sees "sync pending" indicator. Never block clinical workflow for sync.

**User stories:**
- As a dentist, I want to swipe through past dental charts to visually compare how my patient's teeth have changed over time, so I can identify trends without opening individual records.
- As a dentist, I want to tap a tooth and see its complete history across all visits, so I can make informed treatment decisions based on the full longitudinal picture.
- As a dentist, I want pending treatments from past visits to carry over automatically, so I don't forget what was planned for this patient.
- As a dentist, I want to tap a tooth on the chart and immediately start recording conditions without leaving the workspace, so my clinical flow is uninterrupted.
- As a dentist, I want to tag x-rays to specific teeth so I can see all images for a tooth when reviewing its history.
- As a dentist, I want to track lab orders for crowns and bridges so I know when prosthetics are expected to arrive.

---

### 6.2 Module 2: Patient Records

| ID | Requirement | Detail |
|---|---|---|
| FR2.1 | Patient List | Responsive grid of compact Patient Folder Cards (see Section 5.4). Default view for staff role. |
| FR2.2 | Patient Search | < 1s response, 300ms debounce, partial name match, full-text indexed across name + contact + notes. |
| FR2.3 | Patient Registration | Modal: progressive form with minimal required fields (name, contact, DOB). Optional expandable sections: demographics (gender, address, email), emergency contact (name, relationship, phone), communication preferences (preferred contact method, consent for communications), medical history (can be deferred to first visit), **patient photo** (camera capture or upload). **Data processing consent** checkbox required before first record can be created. Completable in < 2 minutes. "Save" returns to list. "Save + Start Session" opens workspace. |
| FR2.4 | Patient Profile | Demographics, dental history overview (visit count, last visit, active conditions), debt summary (total owed, last payment). Tabs: Overview, Payment History. |
| FR2.5 | Duplicate Detection | On create: fuzzy name match against existing records. Warning dialog if match score > 80%. |
| FR2.6 | Duplicate Patient Merge | Select two patient records to merge. Preview combined records (visits, billing, history, attachments, PMDs). Choose primary record. Merge creates a combined record — no data loss. Audit logged. All PMDs from duplicate patient linked to merged record. |
| FR2.7 | Archive/Restore | Soft archive with confirmation dialog. **Edge case EC1:** Cannot archive patient with active payment plan — show "Patient has ₱X outstanding. Settle or write off before archiving." Archived patients hidden from default list view. "Archived" filter tab to view and restore. |
| FR2.8 | Data Export | Per-patient CSV/JSON export of all records. Compliance requirement (RA 10173, GDPR). |
| FR2.9 | Status Management | Statuses: Active, Pending, Archived. Automatic "In Session" badge when patient has open workspace. |
| FR2.10 | Follow-Up Indicators | Overdue badge on patient cards (red, shows amount). "Needs Follow-Up" filter tab on patient list. |
| FR2.11 | In Session Badge | Blue pulsing badge on patient card when that patient has an active workspace session on any device. |
| FR2.12 | Follow-Up Notes | Per-patient follow-up log: date, action taken (called, SMS, email), outcome (left message, patient promised to pay, no answer). Visible in patient profile and in the "Needs Follow-Up" filter view. |
| FR2.13 | Bulk Archive | Select multiple patients → archive with single confirmation. Blocked for patients with active payment plans (EC1). |
| FR2.14 | Medical History Form | Structured health questionnaire. **Sections:** Medical Conditions (diabetes, heart disease, hypertension, blood disorders, HIV/Hepatitis — with ICD-10 codes), Current Medications (blood thinners, bisphosphonates, immunosuppressants — with RxNorm codes), Allergies (drugs, latex, materials — with SNOMED CT codes), Surgical History, Pregnancy Status, Lifestyle (smoking, alcohol). Updateable at any visit. Last-updated date visible on profile. Pre-configured templates per locale. **This is a legal requirement in virtually every country.** |
| FR2.15 | Allergy & Medical Alert System | Part of the Safety Floor (see FR12.3). Allergies from Medical History shown as **always-visible alerts**: (1) Safety Floor in Workspace top bar: "⚠ ALLERGIES: Penicillin, Latex | MEDS: Warfarin | CONDITIONS: Diabetes" — visible during entire treatment session. (2) Alert badge on Patient Folder Card — visible before opening workspace. (3) Prescription blocking: if prescribing a drug patient is allergic to, show blocking warning requiring explicit override acknowledgment. (4) Medical conditions affecting treatment (blood thinners, diabetes) shown as secondary alerts. **This is a patient safety feature.** |
| FR2.16 | Emergency Contact | Emergency contact fields in patient registration and profile: name, relationship, phone number. Optional but prominently placed. |
| FR2.17 | Communication Preferences | Preferred contact method: Phone, SMS, Email, WhatsApp (multi-select). Consent for communications (opt-in). Data model ready for Phase 2 automated reminders. |
| FR2.18 | Recall / Next Visit Tracking | Dentist sets "next visit recommended by [date]" at end of visit or in patient profile. Presets: 1 week, 2 weeks, 1 month, 3 months, 6 months. If date passes with no visit → patient appears in "Recall Overdue" filter on Patient List. Recall status visible on Patient Folder Card (expanded view). Phase 2: drives automated reminder system. |
| FR2.19 | Patient Data Anonymization | Patient can request data erasure. Clinical records RETAINED for legally required retention period (configurable per locale). Personal data (name, contact, address, photo) anonymized → "Anonymous Patient #[ID]". Clinical data (charts, treatments, notes) preserved but de-identified. Anonymization is irreversible and logged in audit trail. Consent withdrawal triggers this flow. |
| FR2.20 | Data Processing Consent | Consent checkbox at patient registration: "I consent to the storage and processing of my health data by [Clinic Name] for dental care purposes." Required before first record can be created. Consent timestamp stored. For patients under 16 (or locale-specific age): parent/guardian consent captured with guardian name. **Edge case EC9:** When patient turns 16, system prompts "Patient is now 16. Update consent to self-consent?" at next visit check-in. |
| FR2.21 | Itemized Statement Generation | Generate itemized billing statement for patient: all visits, procedures, charges, payments, outstanding balance. Includes dates, treating dentist names, tooth numbers, CDT procedure codes. Printable/emailable. For bill dispute resolution (Journey J52). |

---

### 6.3 Module 3: Scheduling

| ID | Requirement | Detail |
|---|---|---|
| FR3.1 | Calendar Views | **Day:** vertical time grid, 30-min slots (configurable), 7AM-7PM range. **Week:** 7-column grid, compressed appointment blocks showing patient first name + time. **Month:** standard calendar with appointment count badges per day. **Multi-dentist:** when practice has 2+ dentists, dentist filter/toggle on calendar views to show appointments per dentist or all dentists combined. |
| FR3.2 | Appointment Create | Patient search (autocomplete), date, time, duration (30min/1hr/1.5hr/2hr), procedure type, notes. **Validation:** appointment end time must not exceed working hours end time (warning if it does). **Multi-dentist:** when practice has 2+ dentists, appointment is assigned to a specific dentist. Phone booking flow: assistant creates on behalf of patient. |
| FR3.3 | Appointment Reschedule | Opens modal with patient + procedure pre-filled. Updates original record. |
| FR3.4 | Appointment Cancel | Soft cancel: stays visible with "Cancelled" badge (muted). Confirmation required. |
| FR3.5 | Appointment Edit | Update details in-place (unlike reschedule which changes date/time). |
| FR3.6 | Appointment Status Lifecycle | Scheduled (default) → Checked In (blue) → Completed (green). Alternative: → Cancelled (muted) · → No-Show (red, reversible via "Revert No-Show"). |
| FR3.7 | Double-Booking Warning | Non-blocking amber border on overlapping appointments. Warning text, not blocking creation. |
| FR3.8 | Walk-In Flow | "Walk-In" button on calendar → redirects to Patient List. If new: registration modal auto-opens. After save: auto-redirect to calendar with New Appointment modal pre-filled. |
| FR3.9 | Check-In → Workspace | Tap "Check In" → appointment status changes → patient workspace opens **with a new visit auto-created in Draft state** (linked to the appointment). Cross-device notification to dentist iPad via sync. If dentist opens workspace without check-in (from patient list), workspace shows history only — dentist taps "+" to create visit manually. |
| FR3.10 | Configurable Working Hours | Start/end time, slot duration. Default: 8AM-6PM, 30-min slots. Configured in Settings. |

**Layout description:** Calendar takes full content area width. Day view: single column time grid. Week view: 7-column grid. Month view: standard calendar grid. Appointment cards are color-coded by status. Calendar header has view toggle buttons (Day / Week / Month) and date navigation arrows.

---

### 6.4 Module 4: Billing (Phase 1 Scope)

| ID | Requirement | Detail |
|---|---|---|
| FR4.1 | Invoice Generation | One invoice per visit. Created when "Continue to Payment" is first tapped OR when visit is completed (whichever comes first). Updated if treatments change after initial creation. Finalized when visit reaches Completed status. Itemized by treatment with CDT procedure codes. |
| FR4.1b | Invoice Status Lifecycle | Statuses: **Draft** (auto-created during visit) → **Issued** (visit completed, invoice finalized) → **Partial** (some payment received) → **Paid** (fully paid) → **Overdue** (past due date, auto-transitions) → **Voided** (cancelled with reason, requires dentist-owner authorization). |
| FR4.2 | Payment Recording | Methods: cash, card, bank transfer. Partial payments supported (apply to specific invoice). **Payment void/reversal:** wrong payment can be voided (creates a reversal record, not deletion). Original payment + void both visible in history. Requires dentist-owner authorization. Overpayment creates credit balance on patient account. **Edge case EC5:** Voided payment receipt shows "VOIDED" watermark on reprint. Original receipt preserved in payment history. |
| FR4.3 | Payment Plans | Create installment schedule for expensive treatments (e.g., braces ₱60,000 over 6 months). **Frequency:** weekly, bi-weekly, or monthly (configurable per plan). **Fields:** total amount, number of installments, frequency, start date, per-installment amount (auto-calculated or manual). Record installment payments. View remaining balance and next due date. **Plan status tracking:** On Track (all installments current), Behind (installment 7+ days past due), Completed (fully paid), Defaulted (90+ days behind). "Behind" status triggers overdue badge on patient card. **Edge case EC6:** Multiple payment plans per patient are allowed. Each plan is independent. Dashboard shows all active plans with aggregate status. |
| FR4.4 | Outstanding Balance | Per-patient total owed. Overdue indicator when past due date. |
| FR4.5 | Collections Summary | Daily and monthly totals: total billed, total collected, outstanding. |
| FR4.6 | Receipt Generation | Official receipt per payment. Print and email delivery. Locale-compliant format. |
| FR4.7 | Discounts | Locale-dependent automatic discounts (PWD/Senior for PH per RA 7277/9994). Manual discounts with reason. **Edge case EC3:** When patient qualifies for multiple discounts (e.g., both PWD and Senior in PH), only the highest applies. Rule: "One discount per line item, highest eligible." |
| FR4.8 | Overdue Badges | Visible on patient cards in Patient List. Staff can filter by "Needs Follow-Up" to see all overdue patients. |
| FR4.9 | Billing List Screen | The `/billing` route shows: all invoices (filterable by status: paid, partial, outstanding, overdue), filterable by date range and patient. Summary cards: total outstanding, total collected this month, overdue amount. Tap invoice → view detail with payment history for that invoice. |
| FR4.10 | Tax Configuration | Tax rate configurable per locale (e.g., PH VAT 12%, AU GST 10%). Tax-exempt treatment categories (configurable). Tax displayed as line item on invoices and receipts. Tax amount included in Grand Total. |
| FR4.11 | Receipt Numbering | Sequential receipt numbers per branch. Each device gets a prefix (device ID or assigned block, e.g., Device A = "A-0001", Device B = "B-0001"). Within a device, numbers are strictly sequential. On sync, receipts are ordered by timestamp. Branch-level sequence reconciled on next cloud sync. **Edge case EC11:** Invoice number gaps from device prefix are accepted. Per-device prefix ensures uniqueness. Gaps are expected in distributed systems. |
| FR4.12 | Currency Rounding | **Edge case EC8:** All currency amounts rounded to nearest centavo (2 decimal places). Banker's rounding (round half to even). Applied to discount calculations, tax calculations, and payment splits. |

**Phase 2 additions:** aging buckets (30/60/90/120+ days), write-off capability, financial trend charts, automated payment plan reminders, revenue by treatment type/payment method, multi-visit patient statements, interest on payment plans.

---

### 6.5 Module 5: Reports and Analytics

| ID | Requirement | Detail |
|---|---|---|
| FR5.1 | Revenue Reports | Date-range filtering (Today, This Week, This Month, Custom). Summary cards: Total Revenue, Treatments Performed, Patients Seen, Outstanding. Daily detail view: time-ordered sessions. Export: CSV + PDF (client-side, offline-capable). |
| FR5.2 | Treatment Reports | Frequency by type (most common procedures, with CDT codes). Revenue by treatment type. Treatment completion rate (planned vs performed). |
| FR5.3 | Patient Reports | New patients per period. Active vs inactive counts. Patient retention (returning vs one-time). |
| FR5.4 | Analytics Dashboard | Revenue trends line chart (collections vs outstanding). Top treatments bar chart (grouped: frequency + revenue). Payment method breakdown donut chart. Period toggles (weekly, monthly, quarterly). |
| FR5.5 | Offline Reports | All reports generated from local data. Fully functional without internet. |
| FR5.6 | Access Control | Dentist-Owner access only. Staff cannot access Reports and Analytics. |

---

### 6.6 Module 6: Staff and Roles

| ID | Requirement | Detail |
|---|---|---|
| FR6.1 | Staff Account Management | Create: name, role, 6-digit PIN, optional photo. Edit: update details, change role, reset PIN. Deactivate/Reactivate: deactivated accounts don't count toward tier limits. |
| FR6.2 | Role-Based Access Control | See access matrix below. |

**Role Access Matrix:**

| Module | Dentist-Owner | Dentist (Associate) | Staff - Full Operations | Staff - Scheduling Only |
|---|---|---|---|---|
| Dashboard | Full | Own patients' data only | Simplified (schedule + follow-ups, no financials) | No access |
| Workspace | Full (read + write) | Full (read + write) | **View-only** (see chart/treatments, cannot add/edit clinical data) + process payments via payment modal | No access |
| Patient Records | Full CRUD | Read + Register | Read + Register | Read only |
| Scheduling | Full | Full | Full | Full |
| Billing | Full | Own patients' billing + record payments | Record payments only | No access |
| Reports | Full | No access | No access | No access |
| Staff & Roles | Full | No access | No access | No access |
| Settings | Full | No access | No access | No access |

**Note:** "Own patients" for Associate Dentist = patients with visits where the associate is the treating dentist. Staff - Scheduling Only default landing page is Calendar (not Patient List).

| FR6.3 | Tier-Based User Limits | Solo: 2 users. Practice: 5 users. Configurable per license tier (managed in Accounts App). |
| FR6.4 | Activity Visibility | Staff list shows: last login, current session status, active device. |
| FR6.5 | Staff List View | Table: name, role, status badge, last login, actions (edit, deactivate). Dentist-Owner row always first, not editable by others. |

---

### 6.7 Module 7: Onboarding

| ID | Requirement | Detail |
|---|---|---|
| FR7.1 | First-Run Wizard | 4 steps, completable in < 10 minutes. **Step 1:** Clinic Setup (name, address, contact). **Step 2:** Dentist Profile (name, license number per locale, optional e-signature, security question for PIN recovery). **Step 3:** Treatment Fee Schedule (pre-populated with common procedures and CDT codes for locale, inline editable). **Step 4:** First Patient (optional, skippable). Completion: celebration screen → redirects to Patient List. |
| FR7.2 | Data Import | CSV bulk patient import for Software Switchers. Drag-and-drop upload. CSV validation with per-row status (Valid/Error/Warning). Error rows highlighted, skipped. Batch-commit with rollback. Download template button. Progress indicator for large imports (500+). **Limitation:** Phase 1 imports patient demographics only (name, contact, DOB, gender, notes). Clinical history (visits, treatments, charts) is not imported — must be re-entered at first visit. Recommend keeping old system as read-only reference during transition period. |
| FR7.3 | Contextual In-App Hints | First-use tooltips on complex features (carousel, dental chart, slideout wizard, surface selector). Dismissible with "Don't show again." Reset all hints in Settings. |
| FR7.4 | Progress Persistence | Wizard state saved locally, resumable after interruption. |
| FR7.5 | First-Time Detection | No accounts exist → auto-redirect to onboarding. |
| FR7.6 | Path Selection | "Starting Fresh" vs "Migrating from another system" — determines whether data import step appears. |

---

### 6.8 Module 8: Settings

| ID | Requirement | Detail |
|---|---|---|
| FR8.1 | Clinic Configuration | Name, address, contact info, logo. |
| FR8.2 | Dentist Profile | Name, license number (per locale), e-signature canvas (undo/clear, Apple Pencil supported), license expiry date. |
| FR8.3 | Treatment Fee Schedule | Editable table with CDT codes. Add/remove/edit treatments with prices and CDT/ICD-10 code mappings. Changes apply prospectively (existing invoices unaffected). Categories: General, Orthodontics, Endodontics, Periodontics, Prosthodontics, Oral Surgery, Pediatric, Cosmetic. |
| FR8.4 | Treatment Templates Editor | Create/edit/delete templates for Quick Actions. Template: name, description, list of tooth/condition/treatment combinations. |
| FR8.4b | Consent Form Templates Editor | Create/edit/delete consent form templates. Template: name, procedure type(s) it applies to, body text (with merge fields for patient name, date, procedure), signature field placement. Default templates provided per locale. |
| FR8.5 | Cloud Backup | Status (last backup, next scheduled), storage used/limit, manual backup trigger. Restore from backup flow (new device → Accounts App login → restore → resume). |
| FR8.6 | Working Hours | Start time, end time, slot duration. Feeds Scheduling module. Default: 8AM-6PM, 30-min slots. |
| FR8.7 | Visit Notes Format | Toggle: free text (default) vs SOAP template (Subjective, Objective, Assessment, Plan). |
| FR8.8 | Locale Settings | Language, currency, date format, tooth notation system (FDI/Universal/Palmer). |
| FR8.9 | Notification Preferences | Toggles: overdue alerts, payment plan reminders. |
| FR8.10 | Send Feedback | Opens email client with pre-filled template + auto-captured device info. |
| FR8.11 | Data Export | Full practice data: patients, visits, treatments, billing. CSV/JSON. Compliance requirement. |
| FR8.12 | Reset In-App Hints | Re-enable all dismissed contextual tooltips. |
| FR8.13 | Access Control | Dentist-Owner only. Staff see access denied. |
| FR8.14 | Data Retention Policy | Configurable retention period per locale (default values from regulatory requirements: PH 15 years, US 6-10 years, EU 10 years, AU 7 years). Data cannot be permanently deleted before retention period expires. After retention: option to archive or anonymize. Retention policy visible in Settings. |
| FR8.15 | PMD Signing Certificate | Facility-level signing credential for PMD generation. Self-signed for initial setup. Certificate status and expiry visible. |

---

### 6.9 Cross-Cutting: Authentication and Security

| ID | Requirement | Detail |
|---|---|---|
| FR9.1 | Local PIN Authentication | 6-digit PIN per user. No cloud auth dependency. |
| FR9.2 | User Selection Screen | Cards: avatar (large), name, role badge. Single user: auto-selected. |
| FR9.3 | Brute-Force Protection | 5 failed attempts → 30s lockout. 10 failures → 5-minute lockout. Progressive. |
| FR9.4 | Auto-Lock on Sleep | Device sleep triggers re-authentication. |
| FR9.5 | Inactivity Timeout | Configurable (default 5 minutes). Auto-locks, requires PIN. |
| FR9.6 | State Preservation | On re-auth: resume exact screen, scroll position, form state, open modals, carousel position. |
| FR9.7 | PIN Recovery | Security question set during onboarding. After 3 failed PINs, "Forgot PIN?" link. Correct answer → reset PIN form. |
| FR9.8 | First-Time Detection | No accounts → redirect to onboarding. |

### 6.10 Cross-Cutting: Sync and Offline

| ID | Requirement | Detail |
|---|---|---|
| FR10.1 | Full Offline Operation | All modules functional without internet. |
| FR10.2 | Multi-Device Sync | CRDT-based conflict-free replication. Multiple devices merge automatically. |
| FR10.3 | Conflict Resolution | **Field-level merge:** concurrent edits to different fields on the same record merge automatically. **Same-field conflict:** last-write-wins with full audit trail (both values preserved in history). **Clinical safety — treatments:** treatment records are append-only. Two devices recording treatments on the same tooth = both records kept, flagged for clinician review. **Clinical safety — Safety Floor:** allergies, medications, and active conditions use add-only merge. A deletion on one device does NOT remove an allergy added on another device. Removals require explicit clinician confirmation after sync. **PMD immutability:** PMD is generated when visit status transitions to "Completed." After PMD generation, the visit's clinical data is locked (amendments only). CRDT merges that arrive after PMD generation create amendment records, not overwrites. |
| FR10.4 | Cloud Backup | Scheduled sync to cloud database. **Edge case EC10:** If restoring a backup to a device with newer local data, sync engine merges automatically. If no sync engine available, restore warns "Local data is newer than backup. Overwrite?" |
| FR10.5 | P2P Sync | Direct device-to-device sync when on same network. |
| FR10.6 | Sync Status | Indicator in app shell: synced, syncing, offline, error. |
| FR10.7 | Cross-Device Notifications | Events propagate across devices (e.g., patient check-in on assistant iPad → notification on dentist iPad). |
| FR10.8 | Backup Restore | New device → Accounts App login → select backup → restore → resume working. |
| FR10.9 | Visit Completion Notification | When a visit with unpaid treatments is completed, assistant devices receive a "Payment pending for [Patient Name]" notification. Enables clinical-to-billing handoff without verbal coordination. |
| FR10.10 | Simultaneous Device Edit | Two devices can edit the same patient record concurrently (e.g., assistant updates address while dentist records treatment). CRDT merge handles this automatically. **Edge case EC7:** Only 1 active visit per patient — second device attempting to create a new visit gets "Visit already active on [device name]." |

### 6.11 Cross-Cutting: Localization

| ID | Requirement | Detail |
|---|---|---|
| FR11.1 | Locale Configuration | Language, currency (symbol, decimal separator, thousands separator, symbol position prefix/suffix, decimal places), date format, timezone. Set at Organization level, overridable per Branch. All timestamps stored in UTC, displayed in branch timezone. |
| FR11.2 | Regulatory Layer | Pluggable per country. Defines: required license fields, mandatory discounts, data privacy rules, receipt format. |
| FR11.3 | Philippines Locale | PRC license number validation. PWD (RA 7277) and Senior (RA 9994) automatic discounts. RA 10173 data privacy. Philippine peso (₱). |
| FR11.4 | Tooth Notation | FDI (default, international), Universal (US), Palmer (UK). Configurable per branch. |
| FR11.5 | Fee Schedule Currency | Treatment prices displayed in branch locale currency. |

### 6.12 Cross-Cutting: PMD (Portable Medical Document)

| ID | Requirement | Detail |
|---|---|---|
| FR12.1 | PMD Generation | When a visit transitions to "Completed" status, auto-generate a PMD file containing: patient identity (name, DOB, sex, identifiers), Safety Floor (allergies, current medications, active conditions), visit details (diagnoses with ICD-10 codes, procedures with CDT codes, prescriptions with RxNorm codes, clinical notes). PMD is digitally signed by the facility. Stored in visit folder. Regenerable if amendments are added (new PMD supersedes previous, linked via provenance). |
| FR12.2 | PMD Reading | Open a PMD file from another facility and display its contents to the clinician. Read-only view. Safety Floor data from imported PMDs renders in under 3 seconds. |
| FR12.3 | Safety Floor Display | Always-visible panel in Workspace top bar showing patient's critical information at a glance: known allergies, current medications, active medical conditions. Data comes from: (1) the app's own patient records (FR2.14, FR2.15), and (2) any imported PMDs from other providers. If no PMDs imported, Safety Floor shows own data only. **Responsive behavior:** Full panel on viewports ≥ 1024px. On narrower viewports (portrait, Split View), collapses to warning icon — tap expands to full panel as overlay. Safety icon always visible regardless of viewport width. |
| FR12.4 | Digital Signature | Every PMD generated by the app is digitally signed using the facility's signing credential (FR8.15). For initial setup and pilots: self-signed certificate. Production: proper trust framework (defined externally). Offline signing: facility certificate is pre-loaded on device; no network required to sign. |
| FR12.5 | Basic PMD Import | Accept a PMD file (via file share or device transfer). Preview contents. Confirm import. Link to patient record. Safety Floor data from imported PMDs is merged with existing patient data (add-only — see FR10.3 conflict resolution). |
| FR12.6 | PMD Share | "Share PMD" button available on completed visits. Exports PMD to patient via device share mechanisms (file transfer, messaging apps). Option to print a summary version. |

**Phase 2 PMD additions:** Full merge with conflict resolution and clinician review UI. Multi-PMD timeline (longitudinal view across all providers — maps to Timeline Carousel). QR code sharing. NFC tap transfer. SMART Health Links.

---

## 7. Key User Journeys

### 7.1 Dentist-Owner Journeys

| ID | Journey | Trigger | Modules Touched |
|---|---|---|---|
| J1 | First Launch | Download + open app | Onboarding → Settings |
| J2 | Morning Startup | Open app at 8 AM | Dashboard → Schedule |
| J3 | Returning Patient Visit | Patient arrives | Schedule (check-in) → Workspace → Billing |
| J4 | New Walk-In Patient | Walk-in | Schedule → Patient Records → Workspace → Billing |
| J5 | Payment Plan Setup | Expensive treatment | Workspace → Billing (create plan) |
| J6 | End of Day | Closing up | Dashboard → Billing (collections) → Schedule (tomorrow) |
| J7 | Prescribe Medication | During visit | Workspace (Rx overlay) |
| J8 | Review Finances | Monthly review | Reports and Analytics |
| J9 | Add Staff Member | Hire assistant | Staff and Roles |
| J10 | Data Migration | Switching systems | Onboarding (import) |

### 7.2 Dental Assistant Journeys

| ID | Journey | Trigger | Modules Touched |
|---|---|---|---|
| J11 | Morning Startup | Open app | Patient List → Schedule |
| J12 | Patient Check-In | Patient arrives | Schedule (check in) → notification to dentist |
| J13 | New Patient Registration | Walk-in | Patient Records (registration modal) |
| J14 | Phone Booking | Patient calls | Schedule (create appointment) |
| J15 | Process Payment | Dentist done | Workspace (payment modal) or Billing |
| J16 | Follow Up on Overdue | Morning task | Patient List (filter: Needs Follow-Up) |
| J17 | Reschedule Appointment | Patient calls | Schedule (reschedule) |

### 7.3 System-Initiated Journeys

| ID | Journey | Trigger | Behavior |
|---|---|---|---|
| J18 | Auto-Lock and Re-Auth | Inactivity / sleep | Lock → PIN → resume exact state |
| J19 | Sync Conflict Resolution | Two devices edit | CRDT merge → no user action needed (except Safety Floor removals) |
| J20 | Backup Completion | Scheduled | Sync → status update in app shell |
| J21 | Overdue Payment Alert | Due date passed | Badge appears on patient card → staff sees in list |
| J22 | Check-In Notification | Assistant checks in | Notification on dentist's device via sync |

### 7.4 Recovery Journeys

| ID | Journey | Trigger | Steps |
|---|---|---|---|
| J23 | Device Lost/Stolen | Hardware failure | New device → Accounts App login → select backup → restore → resume working |
| J24 | Wrong Treatment Recorded | Data entry error | Find record → add amendment (correction linked to original) → both visible in history |
| J25 | Accidental Patient Archive | Mistaken action | Patient List → Archived filter tab → find patient → Restore → patient active again |
| J26 | Failed Data Import | CSV validation errors | Review error report → fix CSV locally → re-upload → retry import |
| J27 | Restore Dismissed Treatment | Changed clinical judgment | Find dismissed treatment in patient history → reverse dismissal → treatment becomes pending again |

### 7.5 Configuration Journeys

| ID | Journey | Trigger | Steps |
|---|---|---|---|
| J28 | Update Fee Schedule | Price changes / new treatment | Settings → Fees → edit price or add treatment → changes apply prospectively |
| J29 | Update Working Hours | Schedule change | Settings → Working Hours → change start/end/slot → Calendar reflects immediately |
| J30 | Update Clinic Info | Address or contact change | Settings → Clinic → update fields → save |
| J31 | Update Dentist Profile | New license or signature | Settings → Profile → update license number / re-draw signature → save |
| J32 | Change Locale Settings | New market or preference | Settings → Locale → change currency / notation / date format → all views update |

### 7.6 Periodic Journeys

| ID | Journey | Trigger | Steps |
|---|---|---|---|
| J33 | License Management | Renewal or upgrade | Accounts App (web) → view current tier → upgrade or add licenses |
| J34 | Storage Upgrade | Running out of cloud storage | Settings → Backup → see storage warning → link to Accounts App → purchase storage |
| J35 | Backup Verification | Monthly check | Settings → Backup → verify last successful backup date and status |
| J36 | Archive Inactive Patients | Quarterly cleanup | Patient List → sort by last visit → select inactive patients → bulk archive |

### 7.7 Collaboration Journeys (Inter-Role Handoffs)

| ID | Journey | Trigger | Roles Involved |
|---|---|---|---|
| J37 | Clinical-to-Billing Handoff | Dentist completes treatment | Dentist finishes workspace → assistant sees notification → opens payment modal → processes payment → generates receipt |
| J38 | Schedule Coordination | Assistant books appointment | Assistant creates appointment on Calendar → dentist sees it on Dashboard and Calendar (synced) |
| J39 | Staff Reviews Patient Registration | New patient registered by assistant | Assistant registers patient → dentist sees new patient in list → opens workspace to review |

### 7.8 State Transition Journeys

| ID | Journey | State Change | Behavior |
|---|---|---|---|
| J40 | Patient Archive and Restore | Active → Archived → Active | Archive with confirmation (blocked if payment plan active — EC1). Archived patients hidden by default. Restore from Archived filter tab. |
| J41 | Appointment No-Show and Revert | Scheduled → No-Show → Scheduled | Mark No-Show (red badge). "Revert No-Show" button if patient calls back. |
| J42 | Visit Complete and Lock | Draft → Active → Completed → Locked | Draft: auto-created, discards if empty. Active: first record added. Completed: dentist explicitly closes; PMD auto-generated. Locked: after review period, becomes immutable. |
| J43 | Treatment Dismissal | Pending → Dismissed | Dentist selects clinical reason (patient declined, no longer indicated, treated elsewhere, resolved). Dismissed items stay in record. Reversible via J27. |
| J44 | Payment Plan Falls Behind | On Track → Behind | Missed installment due date → plan status changes → overdue badge on patient card → staff follows up (J16) |

### 7.9 Exit / Offboarding Journeys

| ID | Journey | Trigger | Steps |
|---|---|---|---|
| J45 | Deactivate Staff Account | Staff leaves practice | Staff module → select staff → Deactivate → confirmation → license slot freed |
| J46 | Full Practice Data Export | Closing practice or switching systems | Settings → Data Export → select format (CSV/JSON) → export all patients, visits, treatments, billing → download file |

### 7.10 New Journeys (v3)

| ID | Journey | Trigger | Steps |
|---|---|---|---|
| J47 | Mid-Visit Emergency | Patient allergic reaction or emergency | Auto-save all workspace state. Flag visit as "Emergency Exit." Visit preserved in Draft state. Resume from exact state later (FR9.6). If device loses power, last auto-save state recovers on next launch. |
| J48 | Patient Transfer Between Dentists | Patient reassigned within practice (Phase 2) | Ownership handoff via treating_dentist field. All history preserved under original treating dentist. New visit assigned to new dentist. |
| J49 | Long-Absence Patient Return | Patient returns after >2 years (Phase 2) | Normal visit workflow. Old conditions may need re-evaluation. Recall status shows "Recall overdue." |
| J50 | Duplicate Patient Merge | Staff created duplicate record | Patient Records → select two records → preview merge → choose primary → merge creates combined record. All visits, billing, attachments, PMDs consolidated. Audit logged. |
| J51 | Pediatric-to-Adult Transition | Deciduous teeth exfoliate | Chart updates as deciduous teeth marked extracted and permanent teeth erupt. Mixed dentition tracked per tooth position. Eruption timeline follows standard patterns with manual override. Tooth history carries over — deciduous tooth #51 history linked to permanent tooth #11 position. |
| J52 | Patient Bill Dispute | Patient questions charges | Generate itemized statement (FR2.21): all visits, procedures, charges, payments, tooth numbers, CDT codes, treating dentist, outstanding balance. Printable/emailable. |
| J53 | Specialist Referral Capture | Dentist refers to specialist (Phase 2) | Capture referral info (specialist name, reason, date). Track if patient followed through. Visible in patient profile. |
| J54 | Device Storage Full | Storage warning during visit | Warn at 90% device capacity ("Storage running low"). Block new attachments at 95% ("Cannot upload — free up space"). All other clinical recording (conditions, treatments, notes, Rx) continues normally. Notification suggests syncing to cloud or removing old attachments. |
| J55 | Simultaneous Device Edit | Two devices edit same patient | CRDT merge handles automatically. User sees sync status indicator (synced/syncing/offline). No manual merge required. Only constraint: 1 active visit per patient (EC7). |
| J56 | Lab Order Tracking | Dentist orders prosthetic from lab | Workspace → Lab Orders sheet → create order linked to treatment and tooth → track status (Ordered → In Fabrication → Delivered → Fitted). Status visible in workspace, per-tooth timeline, and dashboard. |
| J57 | Per-Tooth History Review | Dentist taps tooth for full history | Workspace → tap tooth → slideout opens → "History" tab → chronological list of all conditions, treatments, images across all visits. Tap entry to jump to that visit in carousel. |
| J58 | Smart Attachment Workflow | Upload x-ray or intraoral photo | Workspace → Attachments sheet → upload → tag by type (periapical/bitewing/panoramic/intraoral photo) + tooth number(s) → view in lightbox with zoom/pan/Pencil annotation. Per-tooth image links appear in slideout history. |

---

**Journey Summary: 58 total**

| Category | Count |
|---|---|
| Dentist-Owner (daily operations) | 10 |
| Dental Assistant (daily operations) | 7 |
| System-Initiated | 5 |
| Recovery | 5 |
| Configuration | 5 |
| Periodic | 4 |
| Collaboration (inter-role) | 3 |
| State Transitions | 5 |
| Exit / Offboarding | 2 |
| New v3 Journeys | 12 |

---

## 8. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | Workspace load time | < 2 seconds |
| Performance | Patient search response | < 1 second |
| Performance | Carousel animation | 60fps minimum |
| Performance | Per-tooth history load | < 1 second for patients with up to 100 visits |
| Performance | Safety Floor render | < 3 seconds (including imported PMD data) |
| Accessibility | Touch targets | ≥ 44×44px |
| Accessibility | Reduced motion | Flat 2D layout, no 3D transforms, no spring animations |
| Accessibility | Screen reader | Basic support for navigation and form fields |
| Accessibility | WCAG 2.1 AA | Color contrast ratios, keyboard navigation, focus indicators |
| Security | Encryption at rest | All patient data encrypted on device |
| Security | Encryption in transit | All data transmission encrypted (TLS). Device ↔ Cloud, Device ↔ Server, Device ↔ Device (P2P), Device ↔ Accounts App. |
| Security | PIN authentication | 6-digit, progressive lockout |
| Security | Audit logging | Both READ and WRITE operations logged. Opens (workspace, profile, medical history) = logged read. Changes = logged write. Each entry: who, when, which patient, which device, what action. |
| Security | PMD digital signatures | Facility-level signing credential. Self-signed for pilots. Offline signing via pre-loaded certificates. |
| Privacy | Compliance | Locale-specific (RA 10173 for PH, HIPAA-ready for US, GDPR for EU) |
| Privacy | Data processing consent | Required at patient registration before any records can be created. Consent timestamp stored. Withdrawal triggers anonymization. |
| Privacy | Right to erasure | Patient can request data erasure. Clinical records retained for legal period (configurable per locale). Personal data anonymized. Clinical data preserved but de-identified. Irreversible, logged. |
| Privacy | Data retention | Configurable retention period per locale. Data cannot be permanently deleted before retention period expires. |
| Privacy | Pediatric protection | Patients under 16 (GDPR) or locale-specific age: parent/guardian consent required. Guardian name captured at registration. Transition to self-consent at age threshold (EC9). |
| Reliability | Offline availability | 100% of clinical and operational features work without internet. Administrative features requiring external services (cloud backup, license validation, email delivery, feedback) degrade gracefully with offline indicators. |
| Capacity | Patient records | Up to 10,000 patients per branch |
| Capacity | Visit records | Up to 100,000 visits per branch |
| Internationalization | i18n readiness | All UI strings externalized (not hardcoded). Phase 1 ships English only. Translation-ready for: Filipino, Spanish, Mandarin, Arabic, Portuguese, French. RTL layout support planned for Phase 2+. |
| Print | Print support | Print-optimized stylesheets for: receipts, prescriptions, consent forms, treatment plan estimates, invoices, patient data export, itemized statements, PMD summaries. |
| Timezone | Timezone handling | All timestamps stored in UTC. Displayed in branch timezone (configurable per branch). |

### 8.1 Interaction States

| Feature | Loading | Error | Partial |
|---------|---------|-------|---------|
| Workspace (chart data) | Skeleton dental chart (tooth outlines, no colors) for < 2s. No spinner. | "Unable to load chart data. Your data is safe — try closing and reopening the workspace." | Chart renders immediately from local data. Sync indicator shows "syncing" if remote data pending. |
| Patient List | Skeleton card grid (gray rectangles in card shape). Appears for < 1s from local DB. | "Unable to load patients." + retry button. Should never happen with local-first. | Cards render from local data. Photos load async — show initials avatar until photo arrives. |
| Patient Search | Inline "Searching..." text below search field. Debounced 300ms. | No error state — search is local. Returns empty results if no match. | Results update incrementally as user types. |
| Sync | Status indicator in app shell: green dot (synced), orange pulse (syncing), gray (offline), red (error). | "Sync failed — your data is saved locally. Sync will retry automatically." Never blocks UI. | Partial sync shows "3 of 7 records synced" in status tooltip. |
| Photo upload (Smart Attachment) | Thumbnail shows upload progress bar overlay (percentage). | "Upload failed. Photo saved locally — will retry when connection restores." Photo stays in gallery with "pending upload" badge. | Image visible immediately from local file. Cloud sync happens in background. |
| PMD Generation | Brief "Generating health record..." toast (< 3s). | "PMD generation failed. Visit data is saved. Retry from visit menu." | N/A — PMD generation is atomic. |
| Payment Recording | "Processing payment..." spinner in modal (< 1s for local). | "Payment failed to save. Please try again." with retry. | N/A — payments are atomic transactions. |
| Data Import (CSV) | Progress bar: "Importing row 234 of 500..." | Per-row error highlights in validation view. Successful rows committed. Error rows skipped with reasons. | Partial import: X rows imported, Y rows failed. Review failed rows. |
| Calendar | Skeleton time grid loads instantly from local data. | Should never error — local-first. | Appointments from other devices may arrive via sync with brief delay. |
| Lab Order Status Update | Inline status badge change with brief fade transition. | N/A — status updates are manual, local. | N/A |

### 8.2 Empty States

Every screen must have a designed empty state for first-time users and zero-data scenarios:

| Screen | Empty State Message | Action |
|---|---|---|
| Dashboard (no appointments) | "Welcome! Set up your first appointment to get started." | Quick Action buttons visible |
| Patient List (no patients) | "No patients yet." | Prominent "+ Add First Patient" button |
| Carousel (no visits) | "No visits recorded." | "+" card is the only card, centered |
| Breakdown Table (no treatments) | "Tap a tooth on the chart to begin recording." | — |
| Calendar (no appointments) | "No appointments scheduled." | "+ New Appointment" button |
| Reports (no data) | "Reports will appear after your first completed visit." | — |
| Billing (no invoices) | "No billing history yet." | — |
| Staff List (solo, no staff added) | "Just you for now. Add staff when you're ready." | "+ Add Staff" button |
| Per-Tooth History (no activity) | "No history for this tooth." | "Record first condition" link |
| Lab Orders (none) | "No lab orders yet." | — |
| PMD imports (none) | "No imported health records." | "Import PMD" button |

---

## 9. App Shell and Navigation

### 9.1 Dual Shell Architecture

| Shell | When | Layout |
|---|---|---|
| **Navigation Shell** | Non-clinical screens (Patient List, Calendar, Reports, Staff, Settings) | Sidebar + content area |
| **Workspace Shell** | Clinical work (Dental Workspace) | Full-screen takeover, no sidebar |

### 9.2 Sidebar Navigation

| Group | Item | Route | Icon |
|---|---|---|---|
| — | Dashboard | `/dashboard` | LayoutDashboard |
| CLINICAL | Patients | `/patients` | Users |
| CLINICAL | Calendar | `/calendar` | Calendar |
| OPERATIONS | Billing | `/billing` | Receipt |
| OPERATIONS | Reports | `/reports` | BarChart3 |
| ADMIN | Staff | `/staff` | UserCog |
| ADMIN | Settings | `/settings` | Settings |

### 9.3 Role-Based Default Landing

| Role | Landing Page |
|---|---|
| Dentist-Owner | Dashboard |
| Dentist (Associate) | Dashboard (filtered to own patients) |
| Staff - Full Operations | Patient List |
| Staff - Scheduling Only | Calendar |

### 9.4 Responsive Behavior

| Viewport | Layout |
|---|---|
| ≥ 1024px (iPad landscape / desktop) | Full sidebar (200px) + content area. Workspace: full two-zone layout with draggable divider. |
| 768-1023px (iPad portrait) | Collapsed sidebar (56px icon-only) + content area. Workspace: carousel may auto-collapse to thin strip. Slideout panel becomes bottom sheet. |
| < 768px | Not supported in Phase 1. Tablet-first product. |

### 9.5 iPad Multitasking

| Mode | Behavior |
|---|---|
| Full screen | Standard layout per §9.4 |
| Split View 70/30 (Dentalemon is primary) | Same as ≥ 1024px layout |
| Split View 50/50 | Same as 768-1023px layout (collapsed sidebar, bottom sheet for slideout) |
| Split View 30/70 (Dentalemon is secondary) | Patient list or calendar only. Workspace not supported in this narrow mode — show "Expand Dentalemon for clinical workspace." |
| Slide Over | Not supported — show "Use full screen for best experience." |

---

## 10. Design System Direction

**Note:** Full design specifications are maintained in `DESIGN.md`. This section captures product-level design intent. A design agent will refine exact values.

### 10.1 Design Direction

Apple-clean, white-dominant aesthetic with warm undertones. The interface retreats so the dental chart and patient data can be the hero. Color is earned, not sprinkled.

**Palette update (v3):**
- Backgrounds: white-dominant (#FFFFFF) — color is punctuation, not paint
- Primary accent: honey gold (#D4A43A) — warmer, deeper than previous lemon gold (#E2C231)
- Secondary accent: moss green (#6B8A6B) — warmer than previous sage (#8A9E6E)
- Neutrals: standard grays
- Hover states: gold-soft (#FDF8E8) — the only warm surface in the app

### 10.2 Design Tokens (Intent)

| Token | Intent | Usage |
|---|---|---|
| Primary (Honey Gold) | Warm gold, premium feel | CTAs, accents, highlights, active states |
| Primary Text | Dark on gold backgrounds | Text on gold (never white on gold — contrast requirement) |
| Secondary (Moss Green) | Organic, natural warmth | Active navigation, success/completed states |
| Success | Green family | Completed treatments, paid badges |
| Warning | Amber family | Alerts, remaining balance (dark text only) |
| Error | Red family | Errors, destructive actions, overdue, allergy alerts |
| Background | Warm cream | Page background |
| Surface | White | Cards, modals, elevated surfaces |

**Typography:** System fonts with optical sizing. Headings at 600 weight, body at 400. Clinical data uses tabular-nums for alignment. Negative letter-spacing at all sizes.

**Custom components (not standard library):**
1. Timeline Carousel — Cover Flow + Dock magnification
2. Patient Folder Card — compact + expand folder shape
3. Interactive Dental Chart — SVG anatomical teeth with per-surface state
4. 5-Surface Selector — interactive diagram with cervical toggle
5. Safety Floor Panel — always-visible clinical alerts
6. Per-Tooth Timeline — chronological tooth history

**Animation tokens:** micro (100-150ms), enter (200-300ms), page (250-350ms), brand (300-500ms, spring physics).

**Reduced-motion:** All animations respect `prefers-reduced-motion`. Spring physics replaced with instant transitions.

---

## 11. Data Model (Conceptual — Enterprise-Ready from Day 1)

### 11.1 Multi-Tenancy Architecture

```
Person ──────── human identity (name, email, photo)
  │
  ├── License ── professional credential (type, number, expiry)
  │               A person can have multiple licenses
  │
  └── Membership ── Person ↔ Branch ↔ Role (RBAC junction)
                     A person can have MULTIPLE memberships
                     Example: Dr. Cruz is Owner at "Cruz Dental"
                              AND Associate at "Santos Dental"

Organization ── business entity (name, type, license tier)
  │              Defaults: locale, currency, regulations, tooth notation
  │
  └── Branch ── physical location (name, address, settings)
                 Inherits org defaults, can override per branch
                 ALL clinical data scoped to a Branch
```

**Phase 1:** Single organization, single branch UI. The data model supports multi-org, multi-branch from day one.

**Architectural Decision Record:** Phase 1 builds the full multi-tenant data model (Person, Organization, Branch, Membership). Phase 1 UI only exposes single-branch views. No branch-switching UI, no org-level dashboards, no cross-branch features until Phase 2. This avoids a painful data model refactor later.

**Locale at entity level:** Organization sets defaults (currency, regulations, tooth notation). Branches can override. Example: org defaults to PH (₱, PRC, FDI). A Singapore branch overrides to SG (S$, PDPA, FDI).

### 11.2 Clinical Entities

| Entity | Key Fields | Notes |
|---|---|---|
| Patient | demographics, status, branch_id | Scoped to a branch |
| Visit | patient_id, branch_id, treating_dentist_membership_id, status, date | Lifecycle: Draft → Active → Completed → Locked. treating_dentist tracks which dentist performed this visit. |
| DentalChart | visit_id, tooth_states[] (array of 32 entries: tooth_number, dentition_state, condition_state) | Snapshot of all 32 tooth positions at this visit. This is what renders on the carousel card preview. |
| ToothRecord | visit_id, tooth_number, surfaces, condition_code (ICD-10), condition_text, treatment_id, status, amount | Per-tooth per-visit SNAPSHOT. Records what was observed/done at this visit. References a Treatment (cross-visit lifecycle tracker). |
| Treatment | patient_id, tooth_number, lifecycle_status, originating_visit_id, procedure_code (CDT), procedure_text | Cross-visit lifecycle entity. Tracks a condition from diagnosis through treatment completion. Lifecycle: Diagnosed → Planned → Performed → Verified / Dismissed. Multiple ToothRecords across visits can reference the same Treatment (the carry-over mechanism). |
| TreatmentPlan | patient_id, treatments[], total_estimate, status | Aggregate of pending Treatments into a patient-facing estimate. Status: Draft / Presented / Accepted / Declined. |
| VisitNotes | visit_id, content, format | Optional free text or SOAP template |
| Prescription | visit_id, drug_code (RxNorm), drug_text, dosage, frequency, instructions, prescriber_membership_id | |
| ConsentForm | visit_id, template_id, signature_data, signed_at | |
| Attachment | visit_id, file_type, file_path, image_type (periapical/bitewing/panoramic/intraoral/document/other), tooth_numbers[], uploaded_by | Smart-tagged — see FR1.21 |
| LabOrder | visit_id, treatment_id, tooth_number, lab_name, order_date, expected_delivery, status, notes | Status: Ordered → In Fabrication → Delivered → Fitted / Cancelled |
| MedicalHistory | patient_id, conditions[] (ICD-10 coded), medications[] (RxNorm coded), allergies[] (SNOMED CT coded), surgical_history, pregnancy_status, lifestyle, last_updated | Structured health questionnaire — feeds Safety Floor |
| PMDDocument | visit_id, patient_id, file_data, signature, generated_at, supersedes_pmd_id | One per completed visit. Immutable after generation. Amendments create new PMD linked via supersedes. |
| ImportedPMD | patient_id, source_facility, file_data, imported_at, imported_by | PMDs from other facilities. Read-only. Safety Floor data extracted and merged. |

### 11.3 Financial Entities

| Entity | Key Fields | Notes |
|---|---|---|
| Invoice | visit_id, line_items (with CDT codes), total, tax, status | Auto-generated from treatments |
| Payment | invoice_id, amount, method, date | Partial payments supported |
| PaymentPlan | patient_id, total, installments, frequency, start_date | Installment schedule |
| PaymentPlanPayment | plan_id, amount, date | Individual installment |
| Discount | type, amount_or_percentage, reason, locale_rule | PWD/Senior for PH |

### 11.4 System Entities

| Entity | Purpose |
|---|---|
| Amendment | Additive correction linked to original record. Both visible. |
| AuditLog | Every read and write: who (membership_id), when, what, which patient, which device, why. |
| SyncState | CRDT metadata for conflict-free replication. |
| SigningCredential | Facility-level certificate for PMD digital signatures. |

### 11.5 Key Design Principles

- Every record: `created_by` (membership_id), `owned_by`, `visibility`, `created_at`, `updated_at`
- **Coded values:** All clinical data has both a standard code (ICD-10, CDT, SNOMED CT, RxNorm) and a free-text label. Codes enable PMD interoperability and cross-provider merge. Free text allows flexibility when codes don't match exactly.
- Sharing-ready: ownership + permissions + ACLs from day one
- CRDT-compatible: data structures designed for conflict-free replication
- Branch-scoped: all queries filtered by current branch context
- Organization aggregation: Phase 2 cross-branch dashboards

---

## 12. Edge Case Business Rules

All edge cases documented with resolutions. Referenced inline in their respective modules (FR numbers) and consolidated here for cross-reference.

| ID | Edge Case | Resolution | Module |
|---|---|---|---|
| EC1 | Archived patient with active payment plan | Block archive. Show "Patient has ₱X outstanding. Settle or write off before archiving." | Patient Records (FR2.7) |
| EC2 | Pending treatments on extracted tooth | Auto-dismiss with reason "Tooth extracted." Logged in audit trail. | Workspace (FR1.11) |
| EC3 | PWD + Senior double discount (PH) | Only highest applies. Rule: "One discount per line item, highest eligible." | Billing (FR4.7) |
| EC4 | Treatment fee changes mid-visit | Price at time of treatment recording is locked. Fee schedule changes apply prospectively only. | Workspace (FR1.6), Settings (FR8.3) |
| EC5 | Voided payment receipt reprint | "VOIDED" watermark on reprint. Original receipt preserved in payment history. | Billing (FR4.2) |
| EC6 | Multiple payment plans per patient | Allowed. Each plan independent. Dashboard shows all active plans with aggregate status. | Billing (FR4.3) |
| EC7 | Maximum open visits per patient | 1 active visit per patient. Second device gets "Visit already active on [device name]." Two devices CAN edit same patient record concurrently — restriction is on creating NEW visits only. | Sync (FR10.10) |
| EC8 | Currency rounding on discounts | Round to nearest centavo (2 decimal places). Banker's rounding (round half to even). | Billing (FR4.12) |
| EC9 | Patient turns 16 during treatment | System prompts "Patient is now 16. Update consent to self-consent?" at next visit check-in. | Patient Records (FR2.20) |
| EC10 | Backup restore vs newer local data | Sync engine merges automatically. If no sync: restore warns "Local data is newer than backup. Overwrite?" | Sync (FR10.4) |
| EC11 | Invoice number gaps from device prefix | Accepted. Per-device prefix ensures uniqueness. Gaps are expected in distributed systems. | Billing (FR4.11) |

---

## 13. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| PMD spec is v0.1, will evolve | PMD features may need rework | Design PMD integration as an adapter layer. Isolate PMD generation/parsing from core data model. |
| Scope creep from new Phase 1 features | Phase 1 delayed | 4 new features are scoped tightly. Lab orders = tracking only. Smart attachments = tagging only. iPad interactions = additive to existing touch. |
| CDT/ICD-10 code mapping is large | Data preparation delays | Ship with top 100 most common dental procedures mapped. Expand iteratively. Free-text fallback always available. |
| Carousel performance on older iPads | Core UX compromised | Fallback to flat card layout (no 3D) if frame rate drops below 60fps. Already specced as reduced-motion mode. |
| CRDT sync complexity for clinical records | Data integrity risk | Safety Floor uses add-only merge (never silently delete safety data). Treatments are append-only. Explicit clinician confirmation required for Safety Floor removals. |
| Offline digital signatures | Certificate management complexity | Pre-load facility certificate on device. No network required for signing. Self-signed certificates for initial setup. |

---

## 14. Phase Roadmap

### Phase 1 — Core Product (This PRD)

All 11 modules + 4 cross-cutting concerns as specified above. Single branch UI with enterprise-ready data model. PMD compliance (generate, read, Safety Floor, sign). Smart attachments. Per-tooth timeline. iPad-native interactions. Lab order tracking.

### Phase 2 — Growth

| Feature | Description |
|---|---|
| Voice-Activated Workspace | AI parses voice commands for charting: "mark tooth 14 mesial caries." Dentist keeps hands in patient's mouth. |
| Record Sharing | Cabinet-level (referral), folder-level (second opinion), file-level (send x-ray). Permissions + consent management. |
| Multi-Branch UI | Branch switching, org-level dashboards, cross-branch patient sharing. |
| Associate Dentist Model | Dentist works at multiple clinics, each with own membership/role. |
| Patient Communication | Appointment reminders, recall notices, post-treatment follow-ups (SMS/email). |
| Insurance Claims | Claim submission, tracking (submitted/approved/denied/paid). US market priority. |
| Advanced Imaging | DICOM support, AI-assisted diagnosis from x-rays, side-by-side comparison across visits. |
| PMD Full Merge | Import with conflict resolution and clinician review UI. Multi-PMD timeline. QR/NFC sharing. |
| Periodontal Charting | Full perio chart: probing depths (6 sites/tooth), bleeding on probing, recession measurements. Separate clinical tool from basic charting. Print layout. |
| Patient Transfer | Dentist-to-dentist handoff within and across practices. |
| Specialist Referrals | Structured referral capture, tracking, and follow-up. |

### Phase 3 — Scale

| Feature | Description |
|---|---|
| Multi-Branch Management | Location management, inter-branch transfers, consolidated reporting. |
| Advanced Analytics | Benchmarking, provider productivity, patient demographics analysis. |
| Marketplace | Third-party integrations (lab orders automation, supply management, patient communication services). |
| Android Tablet | Expand beyond Apple ecosystem. |

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Baseline** | A dental chart snapshot at a specific visit. "Today's Baseline" is the current visit. |
| **Cabinet** | All records for one patient, organized as a virtual file cabinet. |
| **Carry-over** | Pending treatments that persist across visits until resolved. |
| **CDT** | Current Dental Terminology — standard procedure codes for dental treatments (e.g., D0120 = periodic oral evaluation). |
| **FDI Notation** | International tooth numbering: adult 11-48, pediatric 51-85. |
| **Focal card** | The center card in the Timeline Carousel — fully interactive. |
| **Folder** | One visit's records within a patient's cabinet. |
| **ICD-10** | International Classification of Diseases — standard codes for diagnoses and conditions (e.g., K02.1 = dental caries). |
| **Membership** | A person's role at a specific branch (the RBAC junction). |
| **PMD** | Portable Medical Document — an open document format for portable health records. One completed visit = one PMD file. |
| **RxNorm** | Standard codes for medications (e.g., 197361 = Amlodipine 5mg). |
| **Safety Floor** | Always-visible panel showing patient's critical information: allergies, current medications, active conditions. |
| **Smart Attachment** | An image or document uploaded with dental-aware tagging: image type + tooth number(s). |
| **SNOMED CT** | Systematized Nomenclature of Medicine — standard codes for clinical findings and allergies. |
| **SOAP** | Clinical note format: Subjective, Objective, Assessment, Plan. |
| **Surface** | Part of a tooth: Buccal, Mesial, Distal, Incisal/Occlusal, Palatal/Lingual. |

---

## Appendix A: Platform Integration — Accounts App

The Accounts App is a separate cloud portal where customers manage their Dentalemon licenses, storage, and billing. It is NOT part of Dentalemon and will have its own PRD.

**Integration points with Dentalemon:**

| Touchpoint | Direction | Purpose |
|---|---|---|
| License Validation | Dentalemon → Accounts App | App checks license tier + activation on startup |
| Storage Quota | Dentalemon → Accounts App | Check available cloud storage for backup/sync |
| User Identity Sync | Accounts App → Dentalemon | Person entities synced from Accounts App |
| Feature Flags | Accounts App → Dentalemon | Which add-ons are active for this organization |
| Device Registration | Dentalemon → Accounts App | Activate/deactivate devices against license |

**Business model structure (referenced, not spec'd):**
- One-time license fee by tier (Solo, Practice, Group, Enterprise)
- Add-on purchases: extra branch, extra user slots, extra storage
- Optional annual upgrade fee (access to major version updates)
- Optional cloud storage tiers (includes sync/relay function)

All integration via standard API endpoints.

---

## Appendix B: Localization Requirements

| Country | Currency | License | Discounts | Privacy Law | Tooth Notation | Tax |
|---|---|---|---|---|---|---|
| Philippines | ₱ (PHP) | PRC license number | PWD (RA 7277), Senior (RA 9994) | RA 10173 (DPA 2012) | FDI | VAT 12% |
| United States | $ (USD) | State dental license | None standard | HIPAA | Universal | No federal (varies by state) |
| European Union | € (EUR) | Country-specific | None standard | GDPR | FDI | VAT (varies by country) |
| Singapore | S$ (SGD) | SDC registration | None standard | PDPA | FDI | GST 9% |
| Australia | A$ (AUD) | AHPRA registration | None standard | APPs | FDI | GST 10% |

**Receipt format requirements (PH — launch market):** TIN (Tax Identification Number), Business Registration Number, OR (Official Receipt) sequential number, date/time, clinic name/address, itemized services with tax, total with tax breakdown, e-signature or authorized signatory.

Additional locales added by configuring the regulatory layer in the Organization/Branch settings.

---

## Appendix C: Competitive Landscape

| Competitor | Market | Strengths | Weaknesses | Dentalemon Advantage |
|---|---|---|---|---|
| **Dentrix** | US only | Feature-complete, market leader | US-only, expensive subscription, no offline | Global, one-time fee, offline-first, PMD-compliant |
| **Open Dental** | US primarily | Open source, customizable | Complex setup, no mobile-first, US-centric | iPad-first, visual charting, zero IT overhead |
| **Curve Dental** | US | Cloud-native, modern UI | Subscription, no offline, US-only | Offline-first, global, Timeline Carousel, per-tooth timeline |
| **MYCURE** | Philippines | Local market presence | General clinic system, not dental-native | Dental-native charting, Apple-quality UX, PMD compliance |
| **Dentrix-equivalent gap** | Emerging markets | — | No dental-native option exists | First dental-native system for global emerging markets |

---

## Appendix D: Default Condition and Treatment Lists

These are the default options pre-populated in the slideout wizard. Dentists can customize (add/remove) via Settings. All entries include standard medical codes for PMD compliance.

**Conditions (grouped, with ICD-10 codes):**

| Group | Conditions | ICD-10 |
|---|---|---|
| Whole Tooth | Missing | K08.1 |
| | Unerupted | K01.0 |
| | Impacted | K01.1 |
| | Supernumerary | K00.1 |
| | Rotated | K07.3 |
| | Drifted | K07.3 |
| Surface | Caries | K02.1 |
| | Fracture | S02.5 |
| | Abrasion | K03.1 |
| | Erosion | K03.2 |
| | Attrition | K03.0 |
| | Cervical Abfraction | K03.1 |
| Existing Restoration | Amalgam Filling | Z96.5 |
| | Composite Filling | Z96.5 |
| | Ceramic Crown | Z96.5 |
| | Metal Crown | Z96.5 |
| | Veneer | Z96.5 |
| | Inlay | Z96.5 |
| | Onlay | Z96.5 |
| | Bridge Abutment | Z96.5 |
| | Implant | Z96.5 |
| Periodontal | Mobility Grade I/II/III | K05.3 |
| | Furcation | K05.3 |
| | Recession | K06.0 |
| Endodontic | Periapical Lesion | K04.5 |
| | Root Canal Treated | Z96.5 |
| | Post and Core | Z96.5 |

**Treatment Plans (grouped by specialty, with CDT codes):**

| Specialty | Treatments | CDT |
|---|---|---|
| General | Prophylaxis (Cleaning) | D1110 |
| | Fluoride Application | D1206 |
| | Sealant | D1351 |
| | Composite Filling | D2391 |
| | Amalgam Filling | D2140 |
| | Temporary Filling | D2940 |
| Endodontics | Root Canal Treatment | D3310 |
| | Pulpotomy | D3220 |
| | Pulp Capping | D3110 |
| | Re-treatment | D3346 |
| Periodontics | Scaling | D4341 |
| | Root Planing | D4341 |
| | Curettage | D4260 |
| | Gingivectomy | D4210 |
| | Flap Surgery | D4240 |
| Prosthodontics | Crown (Ceramic) | D2740 |
| | Crown (Metal) | D2790 |
| | Crown (PFM) | D2750 |
| | Bridge | D6240 |
| | Denture (Complete) | D5110 |
| | Denture (Partial) | D5213 |
| | Veneer | D2962 |
| | Inlay | D2510 |
| | Onlay | D2542 |
| Oral Surgery | Simple Extraction | D7140 |
| | Surgical Extraction | D7210 |
| | Impaction Removal | D7240 |
| | Biopsy | D7285 |
| | Frenectomy | D7960 |
| Orthodontics | Braces (Metal) | D8010 |
| | Braces (Ceramic) | D8020 |
| | Clear Aligners | D8040 |
| | Retainer | D8680 |
| | Space Maintainer | D1510 |
| Pediatric | Pulpotomy (Primary) | D3220 |
| | Stainless Steel Crown | D2930 |
| | Space Maintainer | D1510 |
| | Fluoride Varnish | D1206 |
| Cosmetic | Teeth Whitening | D9972 |
| | Bonding | D2330 |
| | Veneer | D2962 |
| | Gum Contouring | D4210 |

These lists are locale-extensible (additional procedures can be added per country). Prices are set in the Treatment Fee Schedule (Settings).

---

## Appendix E: PMD Requirements Reference

See the PMD Requirements Brief for full technical details on PMD compliance. Key requirements implemented in this PRD:

| PMD Requirement | Dentalemon Implementation | FR Reference |
|---|---|---|
| R1: Generate PMDs | Auto-generate on visit completion | FR12.1 |
| R2: Read PMDs | PMD viewer for imported records | FR12.2 |
| R3: Safety Floor Display | Always-visible panel in workspace top bar | FR12.3 |
| R4: Digital Signature | Facility-level signing credential | FR12.4, FR8.15 |
| R5: Import and Merge (basic) | Accept PMD, preview, confirm, link to patient | FR12.5 |
| R6: Export/Share | Share PMD button on completed visits | FR12.6 |
| R7: Offline Capability | All PMD operations work offline | FR10.1 |

**Terminology requirements for PMD compliance:**

| Data Type | Required Code System | Dentalemon Entity |
|---|---|---|
| Diagnoses | ICD-10 | ToothRecord.condition_code |
| Dental procedures | CDT | Treatment.procedure_code |
| Medications | RxNorm | Prescription.drug_code |
| Allergies | SNOMED CT | MedicalHistory.allergies[].code |
| Clinical findings | SNOMED CT | MedicalHistory.conditions[].code |

---

*Document owner: Product · Version 3.0 · May 2026*
*This PRD is tech-stack agnostic. Implementation decisions are made by the engineering team.*
