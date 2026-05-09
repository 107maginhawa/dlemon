# Feature Landscape

**Domain:** Dental practice management — workspace wiring and gap-filling for web MVP
**Researched:** 2026-05-06
**Overall confidence:** HIGH (features well-established in Dentrix/Open Dental/CareStack; codebase already has 87 handlers + 22 wireframes)

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| # | Feature | Why Expected | Complexity | Depends On | Notes |
|---|---------|--------------|------------|------------|-------|
| 1 | **Workspace action bar** (Rx, Consent, Lab, PMD buttons) | Every dental PMS has a toolbar row giving one-tap access to clinical actions from the patient chart. Dentrix Patient Chart toolbar is the canonical example. Without it, 5 orphaned components are dead code. | **Low** | `rx-sheet.tsx`, `consent-sheet.tsx`, `lab-orders-sheet.tsx`, `pmd-viewer.tsx`, `pmd-import.tsx` (all built) | Wire as icon buttons in a horizontal bar between WorkspaceTabs and TimelineCarousel. Each opens a Sheet/Drawer overlay. No new data fetching — components already call API internally. |
| 2 | **Treatment Plan tab** (live data view) | Practitioners need to see all diagnosed/planned treatments aggregated across visits, grouped by priority/phase, with accept/decline status. Currently a placeholder ("coming in PR2"). | **Med** | `useTreatments` hook, treatments table in workspace route, `dental-billing` handlers | Must show: tooth, CDT code, description, fee, insurance estimate (if available), status. Group by urgency (urgent/recommended/elective). Show total and patient responsibility. |
| 3 | **Patient Profile screen** (demographics + insurance + history) | Registration data and insurance info are the first things staff look up. Every PMS has a dedicated patient demographics screen with contact info, DOB, insurance cards, medical alerts, and visit history summary. | **Med** | `person` feature (4 form components exist: `address-form`, `contact-info-form`, `personal-info-form`, `preferences-form`), `dental-patient` handlers, `medical-history-form` | Compose existing person forms into tabbed sections. Add insurance panel (subscriber info, group number, carrier). Add visit history summary (count, last visit date, outstanding balance). |
| 4 | **Quick payment capture modal** | Front desk must record payments at checkout without navigating away from the workspace. Tap "Continue to Payment" -> modal with amount, method selector, receipt generation. Standard in all PMS checkout flows. | **Low-Med** | `invoice-detail.tsx` (built), `use-invoices.ts` hook, `dental-billing` backend handlers | Footer button already exists. Modal needs: pre-filled amount from treatments total, payment method radio (cash/card/GCash/bank), optional notes, submit -> POST payment -> show receipt number. |
| 5 | **Clinical file attachments** (X-rays, photos) | Attaching clinical images to visits is universal. Dental software stores intraoral photos, periapical X-rays, panoramic images linked to specific teeth/visits. Without this, clinical records are incomplete. | **Med-High** | `storage` handler module (S3/MinIO), new upload component, visit linkage | Upload widget in workspace (drag-drop or camera capture). Display as thumbnail grid grouped by visit. Link attachments to tooth number when relevant. Backend `storage` module exists but needs dental-specific metadata (tooth number, image type: xray/photo/scan). |
| 6 | **Revenue report with drilldown** | Practice owners need production vs. collection reports with ability to drill into individual invoices. `RevenueReport` component exists but is summary-only — no row click -> detail. | **Low** | `revenue-report.tsx` (built), `invoice-detail.tsx` (built) | Add click handler on invoice rows to open `InvoiceDetail` in a sheet. Add KPI cards: gross production, net production (after adjustments), collections, collection rate %. Date range filter already exists. |

---

## Differentiators

Features that set product apart. Not expected but valued.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| 1 | **Treatment plan presentation mode** | Patient-facing view with layman descriptions, annotated images, cost breakdown with insurance, and digital signature for acceptance. Industry average case acceptance is 42%; visual presentations with financial transparency push it to 78%. | **High** | Defer to post-MVP. Requires: patient-facing language mapping for CDT codes, e-signature component (consent-sheet pattern reusable), PDF/email export. Not needed for internal clinical use. |
| 2 | **AI-assisted X-ray annotation** | Auto-detect caries, bone loss on periapical X-rays. Overjet/Pearl are market leaders. Doubles case acceptance per industry data. | **Very High** | Out of scope — requires ML model integration, FDA compliance considerations. Note as future differentiator. |
| 3 | **Smart action bar context** | Action bar buttons change based on visit state (e.g., hide Rx for completed visits, highlight unsigned consents). Dentrix does this; most competitors show all buttons always. | **Low** | Easy win during action bar wiring. Check `isReadOnly` and visit status to conditionally enable/disable buttons. |
| 4 | **Treatment plan phasing** | Split treatments into Phase 1 (urgent), Phase 2 (recommended), Phase 3 (elective) with separate cost totals. Helps patients prioritize and improves acceptance rates. | **Med** | Treatment status enum already has `diagnosed`/`planned`/`in_progress`/`completed`. Add a `priority` or `phase` field. Group in treatment plan tab. |
| 5 | **Attachment annotations** | Draw arrows, circles, text on X-rays to highlight findings for patient education. | **High** | Canvas-based annotation layer. Defer — nice but not MVP. |
| 6 | **Payment plan creation** | Split large treatment costs into installment plans. `payment-plan-view.tsx` already exists in billing feature. | **Med** | Component exists but needs wiring. Could be added to quick payment modal as "Set up plan" option. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full imaging PACS/DICOM viewer** | Dental imaging (DEXIS, Apteryx, Romexis) is a specialized domain with hardware integrations, DICOM protocols, and FDA-cleared AI. Building a viewer is 6+ months of work. | Simple file attachment with thumbnail preview. Link to external imaging software if needed. |
| **Insurance claims submission** | EDI 837D claim generation, ERA 835 processing, clearinghouse integration (DentalXChange, Tesia) is an entire product. Requires HIPAA transaction set compliance. | Track insurance info on patient profile for manual reference. Show estimated coverage in treatment plans. Actual claims filed externally. |
| **Full accounting/ledger system** | Double-entry bookkeeping, chart of accounts, reconciliation — this is QuickBooks territory. | Invoice-based billing with production/collection reports. Export to accounting software. |
| **Appointment SMS/email reminders** | Needs OneSignal/Twilio integration, reminder scheduling, opt-out management. Separate feature vertical. | Defer to communications milestone. Backend `notifs` and `email` modules exist for future use. |
| **Multi-provider schedule view** | Complex calendar with drag-drop, resource allocation, operatory management. Separate feature. | Single-day calendar view exists in `scheduling` feature. Good enough for MVP. |
| **Real-time chat/video** | `comms` backend module exists but wiring WebRTC, chat UI is a full feature. | Defer entirely. Not needed for single-practice MVP. |

---

## Feature Dependencies

```
Workspace Action Bar ─┬─> Rx Sheet (built)
                      ├─> Consent Sheet (built)
                      ├─> Lab Orders Sheet (built)
                      ├─> PMD Viewer (built)
                      └─> PMD Import (built)

Treatment Plan Tab ──> useTreatments hook (built)
                   ──> Treatment status grouping (new logic, no backend change)

Patient Profile ──┬─> personal-info-form (built)
                  ├─> contact-info-form (built)
                  ├─> address-form (built)
                  ├─> preferences-form (built)
                  ├─> medical-history-form (built)
                  └─> Insurance panel (NEW — needs dental-patient insurance fields)

Quick Payment Modal ──> dental-billing handlers (built)
                    ──> use-invoices hook (built)
                    ──> invoice-detail.tsx pattern (built)

Clinical Attachments ──> storage handler module (built)
                     ──> New upload component (NEW)
                     ──> Visit-attachment linkage (NEW — may need schema addition)

Report Drilldown ──> revenue-report.tsx (built)
                 ──> invoice-detail.tsx (built)
                 ──> Click handler wiring (NEW — trivial)
```

---

## MVP Recommendation

### Must Ship (Phase 1-2 of milestone)

1. **Workspace action bar** — Pure wiring, unlocks 5 orphaned components. Highest ROI, lowest effort.
2. **Treatment Plan tab** — Fills the most visible placeholder. Uses existing data.
3. **Report drilldown** — Trivial wiring of existing components. Ship alongside action bar.

### Ship Next (Phase 3-4)

4. **Patient Profile screen** — Compose existing form components. New route or modal.
5. **Quick payment modal** — Upgrade existing footer button to in-context payment capture.

### Ship Last (Phase 5)

6. **Clinical attachments** — Highest complexity, requires upload component + storage integration + possible schema changes. Most likely to surface unexpected work.

### Defer to Post-MVP

- Treatment plan presentation mode (patient-facing)
- AI X-ray annotation
- Attachment annotations
- Payment plans (component exists, wire later)

---

## Complexity Budget

| Feature | New Components | New Hooks | Backend Changes | Estimated Effort |
|---------|---------------|-----------|-----------------|-----------------|
| Action bar | 1 (ActionBar) | 0 | 0 | 2-4 hours |
| Treatment Plan tab | 1 (TreatmentPlanView) | 0 (reuse useTreatments) | 0 | 4-6 hours |
| Report drilldown | 0 (wire existing) | 0 | 0 | 1-2 hours |
| Patient Profile | 1 (PatientProfile route) + 1 (InsurancePanel) | 1 (usePatientProfile) | 0 (fields exist) | 6-8 hours |
| Quick payment modal | 1 (PaymentCaptureModal) | 1 (useRecordPayment) | 0 | 4-6 hours |
| Clinical attachments | 2 (AttachmentUpload + AttachmentGrid) | 1 (useAttachments) | Maybe (metadata schema) | 8-12 hours |

**Total estimate: 25-38 hours of implementation**

---

## Sources

- [Dentrix Patient Chart Toolbars](https://hsps.pro/Dentrix/Help/mergedProjects/Chart/The_Patient_Chart_Window/The_Patient_Chart_toolbars_overview.htm) — action bar patterns
- [BrightPlans Treatment Presentation](https://bright-plans.com/) — treatment plan presentation features
- [Dental Intelligence Treatment Plans](https://www.dentalintel.com/treatment-plans) — case acceptance metrics
- [Open Dental Imaging Module](https://www.opendental.com/manual/images.html) — clinical attachment patterns
- [Stripe Dental Payments](https://stripe.com/resources/more/dental-payment-processing-systems) — payment capture patterns
- [Open Dental Production & Income](https://opendental.com/manual/productionincome.html) — financial report structure
- [DrillDown Solution KPIs](https://drilldownsolution.com/financial-kpis-and-metrics-for-dentists/) — dental financial metrics
- [CareStack Digital Imaging](https://carestack.com/dental-software/features/digital-imaging) — imaging integration patterns
- [Dentalcare Clinical Records](https://www.dentalcare.com/en-us/ce-courses/ce532/clinical-components-of-the-dental-record) — patient profile data requirements
