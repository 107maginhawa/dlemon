/**
 * Central UUID registry for all seed entities.
 *
 * Pattern: xx000000-0000-1000-8000-{zero-padded-seq}
 * All prefixes use valid hex characters only (0-9, a-f).
 *
 *   a0 = org, b0 = branch, c0 = owner person
 *   c1 = memberships
 *   d0 = patient persons, d1 = patient records, d2 = patient contacts
 *   e0 = visits, e1 = charts, e2 = appointments
 *   f0 = invoices, f1 = payments, f2 = payment plans
 *   f3 = treatments, f4 = templates, f5 = visit notes
 *   f6 = prescriptions, f7 = lab orders, f8 = medical history
 *   f9 = invoice line items, fa = plan installments, fb = sync logs
 */

// ── Existing IDs (re-exported) ──────────────────────────────────────
export const ORG_ID    = 'a0000000-0000-1000-8000-000000000001';
export const BRANCH_ID = 'b0000000-0000-1000-8000-000000000001';
export const OWNER_PERSON_ID = 'c0000000-0000-1000-8000-000000000001';

// ── Memberships (c1) ───────────────────────────────────────────────
export const DR_REYES_MEMBERSHIP_ID    = 'c1000000-0000-1000-8000-000000000001';
export const ANA_SANTOS_MEMBERSHIP_ID  = 'c1000000-0000-1000-8000-000000000002';

// ── Patient person IDs (d0) ─────────────────────────────────────────
export const PERSON_JUAN_ID   = 'd0000000-0000-1000-8000-000000000001'; // Juan dela Cruz
export const PERSON_ROSA_ID   = 'd0000000-0000-1000-8000-000000000002'; // Rosa Reyes
export const PERSON_CARLOS_ID = 'd0000000-0000-1000-8000-000000000003'; // Carlos Santos
export const PERSON_LIZA_ID   = 'd0000000-0000-1000-8000-000000000004'; // Liza Manalang
export const PERSON_BEN_ID    = 'd0000000-0000-1000-8000-000000000005'; // Ben Aquino
export const PERSON_SOFIA_ID  = 'd0000000-0000-1000-8000-000000000006'; // Sofia Dela Cruz (minor)
// Extended patients (scenarios 7-20)
export const PERSON_PEPE_ID   = 'd0000000-0000-1000-8000-000000000007'; // Pepe Cruz (allergy: penicillin)
export const PERSON_MIA_ID    = 'd0000000-0000-1000-8000-000000000008'; // Mia Santos (ortho case)
export const PERSON_RICO_ID   = 'd0000000-0000-1000-8000-000000000009'; // Rico dela Torre (new patient)
export const PERSON_ABBY_ID   = 'd0000000-0000-1000-8000-00000000000a'; // Abby Tan (recall overdue)
export const PERSON_MARCO_ID  = 'd0000000-0000-1000-8000-00000000000b'; // Marco Lopez (geriatric 70+)
export const PERSON_CELIA_ID  = 'd0000000-0000-1000-8000-00000000000c'; // Celia Ramos (insurance)
export const PERSON_NENA_ID   = 'd0000000-0000-1000-8000-00000000000d'; // Nena Garcia (special medical notes)
export const PERSON_LUKE_ID   = 'd0000000-0000-1000-8000-00000000000e'; // Luke Rivera (pediatric, 8y)
export const PERSON_ED_ID     = 'd0000000-0000-1000-8000-00000000000f'; // Ed Torres (ongoing Rx)
export const PERSON_TINA_ID   = 'd0000000-0000-1000-8000-000000000010'; // Tina Bautista (extensive history)
export const PERSON_PHIL_ID   = 'd0000000-0000-1000-8000-000000000011'; // Phil Fernan (offline-created sync)
export const PERSON_CINDY_ID  = 'd0000000-0000-1000-8000-000000000012'; // Cindy Ocampo (complex medical hx)
export const PERSON_JEROME_ID = 'd0000000-0000-1000-8000-000000000013'; // Jerome Medrano (inactive)
export const PERSON_GINA_ID   = 'd0000000-0000-1000-8000-000000000014'; // Gina Villanueva (payment plan)

// ── Patient record IDs (d1) ─────────────────────────────────────────
export const PATIENT_JUAN_ID   = 'd1000000-0000-1000-8000-000000000001';
export const PATIENT_ROSA_ID   = 'd1000000-0000-1000-8000-000000000002';
export const PATIENT_CARLOS_ID = 'd1000000-0000-1000-8000-000000000003';
export const PATIENT_LIZA_ID   = 'd1000000-0000-1000-8000-000000000004';
export const PATIENT_BEN_ID    = 'd1000000-0000-1000-8000-000000000005';
export const PATIENT_SOFIA_ID  = 'd1000000-0000-1000-8000-000000000006';
// Extended patients (scenarios 7-20)
export const PATIENT_PEPE_ID   = 'd1000000-0000-1000-8000-000000000007';
export const PATIENT_MIA_ID    = 'd1000000-0000-1000-8000-000000000008';
export const PATIENT_RICO_ID   = 'd1000000-0000-1000-8000-000000000009';
export const PATIENT_ABBY_ID   = 'd1000000-0000-1000-8000-00000000000a';
export const PATIENT_MARCO_ID  = 'd1000000-0000-1000-8000-00000000000b';
export const PATIENT_CELIA_ID  = 'd1000000-0000-1000-8000-00000000000c';
export const PATIENT_NENA_ID   = 'd1000000-0000-1000-8000-00000000000d';
export const PATIENT_LUKE_ID   = 'd1000000-0000-1000-8000-00000000000e';
export const PATIENT_ED_ID     = 'd1000000-0000-1000-8000-00000000000f';
export const PATIENT_TINA_ID   = 'd1000000-0000-1000-8000-000000000010';
export const PATIENT_PHIL_ID   = 'd1000000-0000-1000-8000-000000000011';
export const PATIENT_CINDY_ID  = 'd1000000-0000-1000-8000-000000000012';
export const PATIENT_JEROME_ID = 'd1000000-0000-1000-8000-000000000013';
export const PATIENT_GINA_ID   = 'd1000000-0000-1000-8000-000000000014';

// ── Patient contact IDs (d2) ────────────────────────────────────────
export const CONTACT_SOFIA_GUARDIAN_ID = 'd2000000-0000-1000-8000-000000000001'; // Jose Dela Cruz (guardian)
export const CONTACT_LUKE_GUARDIAN_ID  = 'd2000000-0000-1000-8000-000000000002'; // Alma Rivera (guardian of Luke)

// Convenience map: person -> patient
export const PERSON_TO_PATIENT: Record<string, string> = {
  [PERSON_JUAN_ID]:   PATIENT_JUAN_ID,
  [PERSON_ROSA_ID]:   PATIENT_ROSA_ID,
  [PERSON_CARLOS_ID]: PATIENT_CARLOS_ID,
  [PERSON_LIZA_ID]:   PATIENT_LIZA_ID,
  [PERSON_BEN_ID]:    PATIENT_BEN_ID,
  [PERSON_SOFIA_ID]:  PATIENT_SOFIA_ID,
  [PERSON_PEPE_ID]:   PATIENT_PEPE_ID,
  [PERSON_MIA_ID]:    PATIENT_MIA_ID,
  [PERSON_RICO_ID]:   PATIENT_RICO_ID,
  [PERSON_ABBY_ID]:   PATIENT_ABBY_ID,
  [PERSON_MARCO_ID]:  PATIENT_MARCO_ID,
  [PERSON_CELIA_ID]:  PATIENT_CELIA_ID,
  [PERSON_NENA_ID]:   PATIENT_NENA_ID,
  [PERSON_LUKE_ID]:   PATIENT_LUKE_ID,
  [PERSON_ED_ID]:     PATIENT_ED_ID,
  [PERSON_TINA_ID]:   PATIENT_TINA_ID,
  [PERSON_PHIL_ID]:   PATIENT_PHIL_ID,
  [PERSON_CINDY_ID]:  PATIENT_CINDY_ID,
  [PERSON_JEROME_ID]: PATIENT_JEROME_ID,
  [PERSON_GINA_ID]:   PATIENT_GINA_ID,
};

// ── Visits (e0) ─────────────────────────────────────────────────────
export const VISIT_01 = 'e0000000-0000-1000-8000-000000000001'; // Juan V1
export const VISIT_02 = 'e0000000-0000-1000-8000-000000000002'; // Juan V2
export const VISIT_03 = 'e0000000-0000-1000-8000-000000000003'; // Rosa V1
export const VISIT_04 = 'e0000000-0000-1000-8000-000000000004'; // Rosa V2 (active)
export const VISIT_05 = 'e0000000-0000-1000-8000-000000000005'; // Carlos V1
export const VISIT_06 = 'e0000000-0000-1000-8000-000000000006'; // Carlos V2
export const VISIT_07 = 'e0000000-0000-1000-8000-000000000007'; // Liza V1
export const VISIT_08 = 'e0000000-0000-1000-8000-000000000008'; // Ben V1
export const VISIT_09 = 'e0000000-0000-1000-8000-000000000009'; // Ben V2
export const VISIT_10 = 'e0000000-0000-1000-8000-000000000010'; // Ben V3
export const VISIT_11 = 'e0000000-0000-1000-8000-000000000011'; // Juan V3
export const VISIT_12 = 'e0000000-0000-1000-8000-000000000012'; // Rosa V3
export const VISIT_13 = 'e0000000-0000-1000-8000-000000000013'; // Rosa V4
export const VISIT_14 = 'e0000000-0000-1000-8000-000000000014'; // Carlos V3
export const VISIT_15 = 'e0000000-0000-1000-8000-000000000015'; // Carlos V4
export const VISIT_16 = 'e0000000-0000-1000-8000-000000000016'; // Liza V2
export const VISIT_17 = 'e0000000-0000-1000-8000-000000000017'; // Liza V3
export const VISIT_18 = 'e0000000-0000-1000-8000-000000000018'; // Ben V4
export const VISIT_19 = 'e0000000-0000-1000-8000-000000000019'; // Juan V4
export const VISIT_20 = 'e0000000-0000-1000-8000-000000000020'; // Rosa V5 (active)

// ── Dental Charts (e1) ──────────────────────────────────────────────
export const CHART_01 = 'e1000000-0000-1000-8000-000000000001';
export const CHART_02 = 'e1000000-0000-1000-8000-000000000002';
export const CHART_03 = 'e1000000-0000-1000-8000-000000000003';
export const CHART_04 = 'e1000000-0000-1000-8000-000000000004';
export const CHART_05 = 'e1000000-0000-1000-8000-000000000005';
export const CHART_06 = 'e1000000-0000-1000-8000-000000000006';
export const CHART_07 = 'e1000000-0000-1000-8000-000000000007';
export const CHART_08 = 'e1000000-0000-1000-8000-000000000008';
export const CHART_09 = 'e1000000-0000-1000-8000-000000000009';
export const CHART_10 = 'e1000000-0000-1000-8000-000000000010';
export const CHART_11 = 'e1000000-0000-1000-8000-000000000011';
export const CHART_12 = 'e1000000-0000-1000-8000-000000000012';
export const CHART_13 = 'e1000000-0000-1000-8000-000000000013';
export const CHART_14 = 'e1000000-0000-1000-8000-000000000014';
export const CHART_15 = 'e1000000-0000-1000-8000-000000000015';
export const CHART_16 = 'e1000000-0000-1000-8000-000000000016';
export const CHART_17 = 'e1000000-0000-1000-8000-000000000017';
export const CHART_18 = 'e1000000-0000-1000-8000-000000000018';
export const CHART_19 = 'e1000000-0000-1000-8000-000000000019';
export const CHART_20 = 'e1000000-0000-1000-8000-000000000020';

// ── Appointments (e2) ───────────────────────────────────────────────
export const APPT_01 = 'e2000000-0000-1000-8000-000000000001';
export const APPT_02 = 'e2000000-0000-1000-8000-000000000002';
export const APPT_03 = 'e2000000-0000-1000-8000-000000000003';
export const APPT_04 = 'e2000000-0000-1000-8000-000000000004';
export const APPT_05 = 'e2000000-0000-1000-8000-000000000005';
export const APPT_06 = 'e2000000-0000-1000-8000-000000000006';
export const APPT_07 = 'e2000000-0000-1000-8000-000000000007';
export const APPT_08 = 'e2000000-0000-1000-8000-000000000008';
export const APPT_09 = 'e2000000-0000-1000-8000-000000000009';
export const APPT_10 = 'e2000000-0000-1000-8000-000000000010';
export const APPT_11 = 'e2000000-0000-1000-8000-000000000011';
export const APPT_12 = 'e2000000-0000-1000-8000-000000000012';
export const APPT_13 = 'e2000000-0000-1000-8000-000000000013';
export const APPT_14 = 'e2000000-0000-1000-8000-000000000014';
export const APPT_15 = 'e2000000-0000-1000-8000-000000000015';
export const APPT_16 = 'e2000000-0000-1000-8000-000000000016';
export const APPT_17 = 'e2000000-0000-1000-8000-000000000017';
export const APPT_18 = 'e2000000-0000-1000-8000-000000000018';
export const APPT_19 = 'e2000000-0000-1000-8000-000000000019';
export const APPT_20 = 'e2000000-0000-1000-8000-000000000020';

// ── Invoices (f0) ───────────────────────────────────────────────────
export const INVOICE_01 = 'f0000000-0000-1000-8000-000000000001';
export const INVOICE_02 = 'f0000000-0000-1000-8000-000000000002';
export const INVOICE_03 = 'f0000000-0000-1000-8000-000000000003';
export const INVOICE_04 = 'f0000000-0000-1000-8000-000000000004';
export const INVOICE_05 = 'f0000000-0000-1000-8000-000000000005';
export const INVOICE_06 = 'f0000000-0000-1000-8000-000000000006';
export const INVOICE_07 = 'f0000000-0000-1000-8000-000000000007';
export const INVOICE_08 = 'f0000000-0000-1000-8000-000000000008';

// ── Payments (f1) ───────────────────────────────────────────────────
export const PAYMENT_01 = 'f1000000-0000-1000-8000-000000000001';
export const PAYMENT_02 = 'f1000000-0000-1000-8000-000000000002';
export const PAYMENT_03 = 'f1000000-0000-1000-8000-000000000003';
export const PAYMENT_04 = 'f1000000-0000-1000-8000-000000000004';
export const PAYMENT_05 = 'f1000000-0000-1000-8000-000000000005';
export const PAYMENT_06 = 'f1000000-0000-1000-8000-000000000006';
export const PAYMENT_07 = 'f1000000-0000-1000-8000-000000000007';

// ── Payment Plans (f2) ──────────────────────────────────────────────
export const PLAN_01 = 'f2000000-0000-1000-8000-000000000001';

// ── Treatments (f3) ─────────────────────────────────────────────────
export const TREATMENT_01 = 'f3000000-0000-1000-8000-000000000001';
export const TREATMENT_02 = 'f3000000-0000-1000-8000-000000000002';
export const TREATMENT_03 = 'f3000000-0000-1000-8000-000000000003';
export const TREATMENT_04 = 'f3000000-0000-1000-8000-000000000004';
export const TREATMENT_05 = 'f3000000-0000-1000-8000-000000000005';
export const TREATMENT_06 = 'f3000000-0000-1000-8000-000000000006';
export const TREATMENT_07 = 'f3000000-0000-1000-8000-000000000007';
export const TREATMENT_08 = 'f3000000-0000-1000-8000-000000000008';
export const TREATMENT_09 = 'f3000000-0000-1000-8000-000000000009';
export const TREATMENT_10 = 'f3000000-0000-1000-8000-000000000010';
export const TREATMENT_11 = 'f3000000-0000-1000-8000-000000000011';
export const TREATMENT_12 = 'f3000000-0000-1000-8000-000000000012';
export const TREATMENT_13 = 'f3000000-0000-1000-8000-000000000013';
export const TREATMENT_14 = 'f3000000-0000-1000-8000-000000000014';
export const TREATMENT_15 = 'f3000000-0000-1000-8000-000000000015';
export const TREATMENT_16 = 'f3000000-0000-1000-8000-000000000016';
export const TREATMENT_17 = 'f3000000-0000-1000-8000-000000000017';
export const TREATMENT_18 = 'f3000000-0000-1000-8000-000000000018';
export const TREATMENT_19 = 'f3000000-0000-1000-8000-000000000019';
export const TREATMENT_20 = 'f3000000-0000-1000-8000-000000000020';
export const TREATMENT_21 = 'f3000000-0000-1000-8000-000000000021';
export const TREATMENT_22 = 'f3000000-0000-1000-8000-000000000022';
export const TREATMENT_23 = 'f3000000-0000-1000-8000-000000000023';
export const TREATMENT_24 = 'f3000000-0000-1000-8000-000000000024';
export const TREATMENT_25 = 'f3000000-0000-1000-8000-000000000025';

// ── Treatment Templates (f4) ────────────────────────────────────────
export const TEMPLATE_01 = 'f4000000-0000-1000-8000-000000000001';
export const TEMPLATE_02 = 'f4000000-0000-1000-8000-000000000002';
export const TEMPLATE_03 = 'f4000000-0000-1000-8000-000000000003';
export const TEMPLATE_04 = 'f4000000-0000-1000-8000-000000000004';
export const TEMPLATE_05 = 'f4000000-0000-1000-8000-000000000005';
export const TEMPLATE_06 = 'f4000000-0000-1000-8000-000000000006';
export const TEMPLATE_07 = 'f4000000-0000-1000-8000-000000000007';
export const TEMPLATE_08 = 'f4000000-0000-1000-8000-000000000008';
export const TEMPLATE_09 = 'f4000000-0000-1000-8000-000000000009';
export const TEMPLATE_10 = 'f4000000-0000-1000-8000-000000000010';

// ── Visit Notes (f5) ────────────────────────────────────────────────
export const VISIT_NOTE_01 = 'f5000000-0000-1000-8000-000000000001';
export const VISIT_NOTE_02 = 'f5000000-0000-1000-8000-000000000002';
export const VISIT_NOTE_03 = 'f5000000-0000-1000-8000-000000000003';
export const VISIT_NOTE_04 = 'f5000000-0000-1000-8000-000000000004';
export const VISIT_NOTE_05 = 'f5000000-0000-1000-8000-000000000005';
export const VISIT_NOTE_06 = 'f5000000-0000-1000-8000-000000000006';
export const VISIT_NOTE_07 = 'f5000000-0000-1000-8000-000000000007';
export const VISIT_NOTE_08 = 'f5000000-0000-1000-8000-000000000008';
export const VISIT_NOTE_09 = 'f5000000-0000-1000-8000-000000000009';
export const VISIT_NOTE_10 = 'f5000000-0000-1000-8000-000000000010';
export const VISIT_NOTE_11 = 'f5000000-0000-1000-8000-000000000011';
export const VISIT_NOTE_12 = 'f5000000-0000-1000-8000-000000000012';
export const VISIT_NOTE_13 = 'f5000000-0000-1000-8000-000000000013';
export const VISIT_NOTE_14 = 'f5000000-0000-1000-8000-000000000014';
export const VISIT_NOTE_15 = 'f5000000-0000-1000-8000-000000000015';
export const VISIT_NOTE_16 = 'f5000000-0000-1000-8000-000000000016';
export const VISIT_NOTE_17 = 'f5000000-0000-1000-8000-000000000017';
export const VISIT_NOTE_18 = 'f5000000-0000-1000-8000-000000000018';
export const VISIT_NOTE_19 = 'f5000000-0000-1000-8000-000000000019';
export const VISIT_NOTE_20 = 'f5000000-0000-1000-8000-000000000020';

// ── Prescriptions (f6) ──────────────────────────────────────────────
export const RX_01 = 'f6000000-0000-1000-8000-000000000001';
export const RX_02 = 'f6000000-0000-1000-8000-000000000002';
export const RX_03 = 'f6000000-0000-1000-8000-000000000003';

// ── Lab Orders (f7) ─────────────────────────────────────────────────
export const LAB_ORDER_01 = 'f7000000-0000-1000-8000-000000000001';
export const LAB_ORDER_02 = 'f7000000-0000-1000-8000-000000000002';

// ── Medical History (f8) ────────────────────────────────────────────
export const MH_01 = 'f8000000-0000-1000-8000-000000000001';
export const MH_02 = 'f8000000-0000-1000-8000-000000000002';
export const MH_03 = 'f8000000-0000-1000-8000-000000000003';
export const MH_04 = 'f8000000-0000-1000-8000-000000000004';
export const MH_05 = 'f8000000-0000-1000-8000-000000000005';
export const MH_06 = 'f8000000-0000-1000-8000-000000000006';
export const MH_07 = 'f8000000-0000-1000-8000-000000000007'; // Pepe — penicillin allergy
export const MH_08 = 'f8000000-0000-1000-8000-000000000008'; // Pepe — NSAID allergy

// ── Invoice Line Items (f9) ─────────────────────────────────────────
export const LINE_ITEM_01 = 'f9000000-0000-1000-8000-000000000001';
export const LINE_ITEM_02 = 'f9000000-0000-1000-8000-000000000002';
export const LINE_ITEM_03 = 'f9000000-0000-1000-8000-000000000003';
export const LINE_ITEM_04 = 'f9000000-0000-1000-8000-000000000004';
export const LINE_ITEM_05 = 'f9000000-0000-1000-8000-000000000005';
export const LINE_ITEM_06 = 'f9000000-0000-1000-8000-000000000006';
export const LINE_ITEM_07 = 'f9000000-0000-1000-8000-000000000007';
export const LINE_ITEM_08 = 'f9000000-0000-1000-8000-000000000008';
export const LINE_ITEM_09 = 'f9000000-0000-1000-8000-000000000009'; // Gina overdue

// ── Invoices (f0) — extended ────────────────────────────────────────
export const INVOICE_09 = 'f0000000-0000-1000-8000-000000000009'; // Gina overdue

// ── Payment Plans (f2) — extended ───────────────────────────────────
export const PLAN_02 = 'f2000000-0000-1000-8000-000000000002'; // Gina payment plan

// ── Payment Plan Installments (fa) ──────────────────────────────────
export const INSTALLMENT_01 = 'fa000000-0000-1000-8000-000000000001';
export const INSTALLMENT_02 = 'fa000000-0000-1000-8000-000000000002';
export const INSTALLMENT_03 = 'fa000000-0000-1000-8000-000000000003';
export const INSTALLMENT_04 = 'fa000000-0000-1000-8000-000000000004';
export const INSTALLMENT_05 = 'fa000000-0000-1000-8000-000000000005'; // Gina plan installment 1
export const INSTALLMENT_06 = 'fa000000-0000-1000-8000-000000000006'; // Gina plan installment 2

// ── Sync Logs (fb) ──────────────────────────────────────────────────
export const SYNC_01 = 'fb000000-0000-1000-8000-000000000001'; // Phil — patient pending sync
export const SYNC_02 = 'fb000000-0000-1000-8000-000000000002'; // Phil — visit failed sync

// ── Audit Logs (fc) ─────────────────────────────────────────────────
export const AUDIT_01 = 'fc000000-0000-1000-8000-000000000001'; // treatment created
export const AUDIT_02 = 'fc000000-0000-1000-8000-000000000002'; // invoice issued
export const AUDIT_03 = 'fc000000-0000-1000-8000-000000000003'; // discount applied
export const AUDIT_04 = 'fc000000-0000-1000-8000-000000000004'; // visit notes signed

// ── Attachments (fd) ────────────────────────────────────────────────
export const ATTACHMENT_01 = 'fd000000-0000-1000-8000-000000000001'; // Juan — X-ray
export const ATTACHMENT_02 = 'fd000000-0000-1000-8000-000000000002'; // Rosa — consent form PDF
