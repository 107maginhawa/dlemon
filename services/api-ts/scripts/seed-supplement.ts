/**
 * seed-supplement.ts — DB-direct supplement for Dentalemon demo data
 *
 * Fills the gaps that API validation blocks:
 *   1. dental_invoice (+ dental_invoice_line_item) — invoices across all statuses
 *   2. dental_appointment — appointments across all statuses + relative dates
 *   3. Longitudinal multi-visit patients (P10-P15) — 3-5 completed/locked visits
 *      per patient with tooth-level evolution for the timeline carousel demo.
 *      Uses direct DB inserts to bypass completion gates (consent + treatment FSM).
 *
 * Idempotent: deterministic IDs via detUuid(), all inserts use .onConflictDoNothing().
 *
 * Usage: cd services/api-ts && bun scripts/seed-supplement.ts
 */

import { createDatabase } from '@/core/database';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { dentalVisits, type NewDentalVisit } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import {
  dentalInvoices,
  dentalInvoiceLineItems,
  type NewDentalInvoice,
  type NewDentalInvoiceLineItem,
} from '@/handlers/dental-billing/repos/dental-invoice.schema';
import {
  dentalAppointments,
  type NewDentalAppointment,
} from '@/handlers/dental-scheduling/repos/dental-appointment.schema';
import { dentalCharts, type NewDentalChart } from '@/handlers/dental-visit/repos/dental-chart.schema';
import {
  dentalTreatments, visitNotes,
  type NewDentalTreatment, type NewVisitNotes,
} from '@/handlers/dental-visit/repos/treatment.schema';
import { dentalPatientChartBaselines } from '@/handlers/dental-visit/repos/dental-chart-baseline.schema';
import { dentalPerioCharts } from '@/handlers/dental-perio/repos/perio-chart.schema';
import { dentalPerioToothReadings } from '@/handlers/dental-perio/repos/perio-reading.schema';
import {
  dentalTreatmentPlans, dentalTreatmentPlanApprovals, dentalTreatmentPlanStatusHistory,
  type NewDentalTreatmentPlan, type TreatmentPlanStatus,
} from '@/handlers/dental-patient/repos/treatment-plan.schema';
import {
  dentalCasePresentations, type NewDentalCasePresentation,
} from '@/handlers/dental-patient/repos/case-presentation.schema';
import { eq, and, inArray } from 'drizzle-orm';
import { detUuid, cpPlanSpecs } from './seed-shared';
import { workingSlotISO } from './lib/seed-clock';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase';
const db = createDatabase({ url: DATABASE_URL });

// ─── Date helpers (relative to now — never hardcoded) ────────────────────────
const daysAgo = (n: number, h = 9) => {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d;
};
const daysFromNow = (n: number, h = 10) => {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d;
};
// Appointment slots come from workingSlotISO (timezone- + working-hours-aware);
// daysAgo/daysFromNow remain for non-appointment date fields (invoice issued/due/paid).

function log(msg: string) { console.log(`  ${msg}`); }
function section(title: string) { console.log(`\n▶ ${title}`); }

async function seed() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Dentalemon Supplement Seed (invoices + appts) ║');
  console.log('╚══════════════════════════════════════════════╝');

  // ── 1. Reference existing data (READ-ONLY) ────────────────────────────────
  section('1. Resolving existing data');

  const [branch] = await db.select().from(dentalBranches).limit(1);
  if (!branch) throw new Error('No dental_branch found — run the clinical seed first.');
  log(`✓ Branch: ${branch.name} (${branch.id})`);

  // Prefer the dentist_owner; fall back to any membership on this branch.
  const branchMembers = await db
    .select()
    .from(dentalMemberships)
    .where(eq(dentalMemberships.branchId, branch.id));
  const owner =
    branchMembers.find((m) => m.role === 'dentist_owner') ?? branchMembers[0];
  if (!owner) throw new Error('No dental_membership found on branch — run the clinical seed first.');
  log(`✓ Provider: ${owner.displayName} (${owner.role})`);

  const allPatients = await db.select().from(patients);
  if (allPatients.length === 0) throw new Error('No patients found — run the clinical seed first.');
  log(`✓ Patients: ${allPatients.length}`);

  const allVisits = await db.select().from(dentalVisits);
  log(`✓ Visits: ${allVisits.length}`);

  // First visit per patient (used to link invoices to a real visit where sensible)
  const visitByPatient = new Map<string, string>();
  for (const v of allVisits) {
    if (!visitByPatient.has(v.patientId)) visitByPatient.set(v.patientId, v.id);
  }

  // ── 2. Invoices (+ line items) across all statuses ────────────────────────
  section('2. Invoices');

  type LineSpec = { cdtCode: string; description: string; toothNumber?: number; unitPriceCents: number; quantity?: number };
  type InvoiceSpec = {
    key: string;
    patientIdx: number;
    status: 'paid' | 'partial' | 'overdue' | 'draft' | 'issued';
    lines: LineSpec[];
    /**
     * FIX-011: for `overdue` invoices, how many days PAST DUE — drives the AR-aging
     * bucket (≤30 current, 31–60 days30, 61–90 days60, >90 days90Plus). Spread the
     * demo's overdue receivables across buckets so the AR-aging report demos real
     * data in every bucket instead of all-empty. Defaults to 45 (days30).
     */
    ageDays?: number;
  };

  // ~10 invoices spread across statuses: paid, partial, overdue, draft, issued.
  const invoiceSpecs: InvoiceSpec[] = [
    { key: 'INV-S0001', patientIdx: 0, status: 'paid',    lines: [
      { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', unitPriceCents: 150000 },
      { cdtCode: 'D1110', description: 'Adult prophylaxis (cleaning)', unitPriceCents: 250000 },
    ]},
    { key: 'INV-S0002', patientIdx: 1, status: 'partial', lines: [
      { cdtCode: 'D2391', description: 'Resin composite — 1 surface (#24)', toothNumber: 24, unitPriceCents: 400000 },
      { cdtCode: 'D0220', description: 'Periapical X-ray (#24)', toothNumber: 24, unitPriceCents: 80000 },
    ]},
    { key: 'INV-S0003', patientIdx: 2, status: 'paid',    lines: [
      { cdtCode: 'D2740', description: 'Crown — porcelain/ceramic (#46)', toothNumber: 46, unitPriceCents: 1800000 },
    ]},
    { key: 'INV-S0004', patientIdx: 3, status: 'overdue', ageDays: 45, lines: [
      { cdtCode: 'D7210', description: 'Surgical extraction (#48)', toothNumber: 48, unitPriceCents: 800000 },
      { cdtCode: 'D9110', description: 'Palliative treatment of pain', unitPriceCents: 120000 },
    ]},
    { key: 'INV-S0005', patientIdx: 4, status: 'draft',   lines: [
      { cdtCode: 'D6010', description: 'Implant body placement (#48 site)', toothNumber: 48, unitPriceCents: 5000000 },
      { cdtCode: 'D6065', description: 'Implant supported crown (#48)', toothNumber: 48, unitPriceCents: 2500000 },
    ]},
    { key: 'INV-S0006', patientIdx: 5, status: 'issued',  lines: [
      { cdtCode: 'D3330', description: 'Root canal treatment (#46)', toothNumber: 46, unitPriceCents: 1200000 },
    ]},
    { key: 'INV-S0007', patientIdx: 6, status: 'partial', lines: [
      { cdtCode: 'D0340', description: 'Panoramic radiographic image', unitPriceCents: 250000 },
      { cdtCode: 'D8080', description: 'Comprehensive orthodontic treatment', unitPriceCents: 8500000 },
    ]},
    { key: 'INV-S0008', patientIdx: 7, status: 'overdue', ageDays: 78, lines: [
      { cdtCode: 'D4341', description: 'Scaling and root planing — UR/UL', unitPriceCents: 500000 },
      { cdtCode: 'D0120', description: 'Periodic oral evaluation', unitPriceCents: 100000 },
    ]},
    { key: 'INV-S0009', patientIdx: 8, status: 'paid',    lines: [
      { cdtCode: 'D1206', description: 'Topical fluoride varnish', unitPriceCents: 80000 },
      { cdtCode: 'D1110', description: 'Adult prophylaxis (cleaning)', unitPriceCents: 250000 },
    ]},
    { key: 'INV-S0010', patientIdx: 9, status: 'issued',  lines: [
      { cdtCode: 'D2750', description: 'Crown prep — full cast metal (#46)', toothNumber: 46, unitPriceCents: 900000 },
    ]},
    // FIX-011: a deeply-aged receivable so the AR-aging 90+ bucket is non-empty.
    { key: 'INV-S0011', patientIdx: 3, status: 'overdue', ageDays: 120, lines: [
      { cdtCode: 'D2950', description: 'Core buildup, including any pins (#48)', toothNumber: 48, unitPriceCents: 350000 },
    ]},
  ];

  let invCount = 0;
  let lineCount = 0;
  const statusTally: Record<string, number> = {};

  for (const spec of invoiceSpecs) {
    const patient = allPatients[spec.patientIdx % allPatients.length];
    if (!patient) continue;

    const subtotalCents = spec.lines.reduce(
      (s, l) => s + l.unitPriceCents * (l.quantity ?? 1), 0,
    );
    const totalCents = subtotalCents; // no discount/tax in demo
    // Derive money fields from status (BR: amountCents >= 1).
    let paidCents = 0;
    const status = spec.status;
    if (status === 'paid') paidCents = totalCents;
    else if (status === 'partial') paidCents = Math.round(totalCents * 0.5);
    const balanceCents = totalCents - paidCents;

    const invoiceId = detUuid(`invoice:${spec.key}`);
    const issuedAt = status === 'draft' ? null : daysAgo(20);
    const dueDate =
      // FIX-011: overdue invoices are past due by spec.ageDays (default 45) so the
      // demo spreads receivables across the AR-aging buckets (days30/60/90+).
      status === 'overdue' ? daysAgo(spec.ageDays ?? 45)
      : status === 'draft' ? null
      : daysFromNow(15);
    const paidAt = status === 'paid' ? daysAgo(5) : null;

    const invoiceRow: NewDentalInvoice = {
      id: invoiceId,
      visitId: visitByPatient.get(patient.id) ?? null,
      patientId: patient.id,
      branchId: branch.id,
      dentistMemberId: owner.id,
      invoiceNumber: spec.key,
      status,
      subtotalCents,
      discountCents: 0,
      taxCents: 0,
      taxRate: '0',
      totalCents,
      paidCents,
      balanceCents,
      dueDate,
      issuedAt,
      paidAt,
      createdBy: owner.personId ?? null,
      updatedBy: owner.personId ?? null,
    };

    await db.insert(dentalInvoices).values(invoiceRow).onConflictDoNothing();

    for (let i = 0; i < spec.lines.length; i++) {
      const l = spec.lines[i];
      const qty = l.quantity ?? 1;
      const lineRow: NewDentalInvoiceLineItem = {
        id: detUuid(`line:${spec.key}:${i}`),
        invoiceId,
        cdtCode: l.cdtCode,
        description: l.description,
        toothNumber: l.toothNumber ?? null,
        unitPriceCents: l.unitPriceCents,
        quantity: qty,
        amountCents: l.unitPriceCents * qty,
        isDone: status === 'paid',
        createdBy: owner.personId ?? null,
        updatedBy: owner.personId ?? null,
      };
      await db.insert(dentalInvoiceLineItems).values(lineRow).onConflictDoNothing();
      lineCount++;
    }

    invCount++;
    statusTally[status] = (statusTally[status] ?? 0) + 1;
    log(`✓ ${spec.key} → ${status} (₱${(totalCents / 100).toFixed(0)}, paid ₱${(paidCents / 100).toFixed(0)})`);
  }
  log(`Σ ${invCount} invoices / ${lineCount} line items — ${JSON.stringify(statusTally)}`);

  // ── 3. Appointments across all statuses + relative dates ──────────────────
  section('3. Appointments');

  type ApptSpec = {
    key: string;
    patientIdx: number;
    // (dayOffset, Manila wall-clock hour:min) snapped to working hours by
    // workingSlotISO. Negative day = past (rolls back); >=0 = today/future (rolls
    // forward to the next open day). These rows are direct-inserted (no validator),
    // but snapping keeps the demo coherent: no appointments on closed days / after
    // hours, and stable regardless of the host timezone.
    day: number;
    hour: number;
    min?: number;
    durationMinutes: number;
    serviceType: string;
    status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';
    walkIn?: boolean;
    notes?: string;
  };

  const apptSpecs: ApptSpec[] = [
    // Today
    { key: 'APT-S001', patientIdx: 0, day: 0,   hour: 9,           durationMinutes: 30, serviceType: 'Routine cleaning',      status: 'scheduled' },
    { key: 'APT-S002', patientIdx: 1, day: 0,   hour: 10, min: 30, durationMinutes: 45, serviceType: 'Filling follow-up',     status: 'checked_in' },
    { key: 'APT-S003', patientIdx: 8, day: 0,   hour: 11, min: 30, durationMinutes: 30, serviceType: 'Walk-in — toothache',   status: 'scheduled', walkIn: true },
    { key: 'APT-S004', patientIdx: 2, day: 0,   hour: 14,          durationMinutes: 60, serviceType: 'Crown cementation',     status: 'scheduled' },
    // Tomorrow
    { key: 'APT-S005', patientIdx: 3, day: 1,   hour: 9,           durationMinutes: 60, serviceType: 'Surgical extraction',  status: 'scheduled' },
    { key: 'APT-S006', patientIdx: 4, day: 1,   hour: 11,          durationMinutes: 45, serviceType: 'Implant consultation', status: 'scheduled' },
    { key: 'APT-S007', patientIdx: 6, day: 2,   hour: 10,          durationMinutes: 30, serviceType: 'Ortho review',         status: 'scheduled' },
    { key: 'APT-S008', patientIdx: 5, day: 3,   hour: 15,          durationMinutes: 90, serviceType: 'Root canal',           status: 'scheduled' },
    // Past — completed
    { key: 'APT-S009', patientIdx: 0, day: -10, hour: 9,           durationMinutes: 30, serviceType: 'Periodic exam',         status: 'completed' },
    { key: 'APT-S010', patientIdx: 2, day: -20, hour: 10,          durationMinutes: 60, serviceType: 'Crown prep',            status: 'completed' },
    { key: 'APT-S011', patientIdx: 7, day: -7,  hour: 14,          durationMinutes: 45, serviceType: 'Perio SRP',             status: 'completed' },
    // Past — cancelled / no_show
    { key: 'APT-S012', patientIdx: 9, day: -5,  hour: 11,          durationMinutes: 30, serviceType: 'Cleaning',              status: 'cancelled', notes: 'Patient rescheduled.' },
    { key: 'APT-S013', patientIdx: 3, day: -3,  hour: 13,          durationMinutes: 60, serviceType: 'Extraction',            status: 'no_show' },
    { key: 'APT-S014', patientIdx: 1, day: -2,  hour: 16,          durationMinutes: 30, serviceType: 'Sensitivity follow-up', status: 'no_show' },
  ];

  let apptCount = 0;
  const apptTally: Record<string, number> = {};

  const now = new Date();
  for (const spec of apptSpecs) {
    const patient = allPatients[spec.patientIdx % allPatients.length];
    if (!patient) continue;

    const when = new Date(workingSlotISO(now, spec.day, spec.hour, spec.min ?? 0, spec.durationMinutes));
    const row: NewDentalAppointment = {
      id: detUuid(`appt:${spec.key}`),
      patientId: patient.id,
      dentistMemberId: owner.id,
      branchId: branch.id,
      scheduledAt: when,
      durationMinutes: spec.durationMinutes,
      serviceType: spec.serviceType,
      walkIn: spec.walkIn ?? false,
      status: spec.status,
      checkInTime: spec.status === 'checked_in' || spec.status === 'completed' ? when : null,
      notes: spec.notes ?? null,
      cancelledAt: spec.status === 'cancelled' ? when : null,
      cancellationReason: spec.status === 'cancelled' ? (spec.notes ?? 'Cancelled') : null,
      noShowAt: spec.status === 'no_show' ? when : null,
      createdBy: owner.personId ?? null,
      updatedBy: owner.personId ?? null,
    };

    await db.insert(dentalAppointments).values(row).onConflictDoNothing();
    apptCount++;
    apptTally[spec.status] = (apptTally[spec.status] ?? 0) + 1;
  }
  log(`Σ ${apptCount} appointments — ${JSON.stringify(apptTally)}`);

  // ── 4. Longitudinal multi-visit patients (carousel demo) ─────────────────
  // Inserts 3-5 completed/locked visits per patient (P10-P15) with tooth-level
  // evolution visible in the timeline carousel. Direct DB inserts bypass the
  // API completion gates (VISIT_HAS_OPEN_TREATMENTS + VISIT_CONSENT_REQUIRED).
  // Idempotent: all rows keyed by detUuid(stable-label) + .onConflictDoNothing().
  //
  // Evolution stories:
  //   P10 Lorenzo: ortho arc (crowding→braces→alignment→retention) — 4 visits
  //   P11 Claudia: perio arc (gingivitis→SRP→maintenance→stable) — 4 visits
  //   P12 Enrique: extraction→implant arc (#46 caries→implant→crown) — 4 visits
  //   P13 Melissa: caries arc (#36/#46 watchlist→caries→filled) — 3 visits
  //   P14 Ramon: RCT→crown arc (#26 sensitivity→caries→RCT→crown) — 4 visits
  //   P15 Patricia: cosmetic arc (erosion→whitening→filling) — 3 visits
  section('4. Longitudinal multi-visit patients (carousel demo)');

  // Resolve patients by full name — patient → person (first_name + last_name)
  // seed-demo.ts creates patients as { displayName: 'First Last', ... } which maps
  // to person.first_name + ' ' + person.last_name via the /dental/patients handler.
  type LongPatientEntry = { fullName: string; firstName: string; lastName: string };
  const longitudinalPatients: LongPatientEntry[] = [
    { fullName: 'Lorenzo Delos Santos', firstName: 'Lorenzo', lastName: 'Delos Santos' },
    { fullName: 'Claudia Bautista',     firstName: 'Claudia',  lastName: 'Bautista' },
    { fullName: 'Enrique Villanueva',   firstName: 'Enrique',  lastName: 'Villanueva' },
    { fullName: 'Melissa Castro',       firstName: 'Melissa',  lastName: 'Castro' },
    { fullName: 'Ramon Aquino',         firstName: 'Ramon',    lastName: 'Aquino' },
    { fullName: 'Patricia Gomez',       firstName: 'Patricia', lastName: 'Gomez' },
  ];
  // Query by full name — build individual OR pairs so Bun.SQL gets simple literals
  const DB_URL_LONG = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase';
  const sqlLong = new Bun.SQL(DB_URL_LONG);
  // Execute individual queries per patient to avoid array parameterization issues
  const longPatientRows: Array<{ id: string; first_name: string; last_name: string }> = [];
  for (const lp of longitudinalPatients) {
    const rows = await sqlLong`
      SELECT pa.id, pe.first_name, pe.last_name
      FROM patient pa
      JOIN person pe ON pe.id = pa.person_id
      WHERE pe.first_name = ${lp.firstName} AND pe.last_name = ${lp.lastName}
      LIMIT 1
    `;
    for (const r of rows) longPatientRows.push(r as any);
  }
  await sqlLong.close();

  const longPatientMap = new Map<string, string>(); // fullName → patientId
  for (const row of longPatientRows) {
    const fullName = `${row.first_name} ${row.last_name}`;
    longPatientMap.set(fullName, row.id);
  }
  log(`✓ Resolved ${longPatientMap.size}/${longitudinalPatients.length} longitudinal patients`);

  if (longPatientMap.size === 0) {
    log('⚠ No longitudinal patients found — skipping (seed-demo.ts may not have run yet)');
  } else {
    type ToothSpec = { toothNumber: number; state: string; surfaces?: string[]; conditionCode?: string; note?: string };
    type TreatmentSpec = { cdtCode: string; description: string; priceCents: number; toothNumber?: number; surfaces?: string[] };
    type VisitSpec = {
      key: string;
      daysAgoN: number;
      complaint: string;
      teeth: ToothSpec[];
      treatments: TreatmentSpec[];
      soap: { subjective: string; objective: string; assessment: string; plan: string };
      status: 'completed' | 'locked';
    };
    type PatientArc = { name: string; visits: VisitSpec[] };

    const arcs: PatientArc[] = [
      // ─────────────────────────────────────────────────────────
      // P10 Lorenzo Delos Santos — ortho arc (4 visits, 2yr span)
      // ─────────────────────────────────────────────────────────
      {
        name: 'Lorenzo Delos Santos',
        visits: [
          {
            key: 'long-p10-v1',
            daysAgoN: 730, complaint: 'Crowding and misalignment — orthodontic evaluation',
            teeth: [
              { toothNumber: 11, state: 'watchlist', surfaces: ['labial'], note: 'Crowding 15° rotation. Ortho indicated.' },
              { toothNumber: 21, state: 'watchlist', surfaces: ['labial'], note: '1.5mm diastema.' },
            ],
            treatments: [
              { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', priceCents: 150000 },
              { cdtCode: 'D0340', description: 'Panoramic radiographic image', priceCents: 250000 },
            ],
            soap: {
              subjective: 'Patient (age 27) concerned about crooked front teeth and spacing. No pain.',
              objective: 'Class I occlusion. Moderate crowding. Diastema #11-21 1.5mm. Lower crowding 2mm.',
              assessment: 'Orthodontic treatment indicated. Favorable growth completion.',
              plan: 'Fixed braces recommended. Duration ~18 months. Ceph/pano taken.',
            },
            status: 'locked',
          },
          {
            key: 'long-p10-v2',
            daysAgoN: 540, complaint: 'Fixed braces placement — upper and lower arches',
            teeth: [
              { toothNumber: 11, state: 'watchlist', surfaces: ['labial'], note: 'Bracket placed. Rotation 15° at start.' },
              { toothNumber: 21, state: 'watchlist', surfaces: ['labial'], note: 'Bracket placed. Diastema closing.' },
              { toothNumber: 31, state: 'watchlist', surfaces: ['labial'], note: 'Bracket placed. Crowding resolving.' },
            ],
            treatments: [
              { cdtCode: 'D8080', description: 'Comprehensive orthodontic treatment — adult', priceCents: 8500000 },
            ],
            soap: {
              subjective: 'Presents for brace placement. Excited. No medical changes.',
              objective: 'Brackets bonded upper and lower. 0.014 NiTi wire ligated. Rotation #11 ~15°.',
              assessment: 'Treatment initiated. Starting alignment phase.',
              plan: 'Review 6 weeks. Expect initial soreness 2-3 days. Soft diet.',
            },
            status: 'locked',
          },
          {
            key: 'long-p10-v3',
            daysAgoN: 360, complaint: 'Orthodontic adjustment — wire progression',
            teeth: [
              { toothNumber: 11, state: 'watchlist', surfaces: ['labial'], note: 'Rotation reduced to 4°. Good progress.' },
              { toothNumber: 21, state: 'watchlist', surfaces: ['labial'], note: 'Diastema closed.' },
            ],
            treatments: [
              { cdtCode: 'D8660', description: 'Orthodontic retention — wire change 0.016×0.022 SS', priceCents: 500000 },
            ],
            soap: {
              subjective: 'Returns for adjustment. No discomfort. Pleased with progress.',
              objective: '#11 rotation 4° (from 15°). Diastema closed. Wire → 0.016×0.022 SS.',
              assessment: 'Excellent progress. Finishing stage next.',
              plan: 'Stainless steel archwire. Finishing elastics. 8-week interval.',
            },
            status: 'locked',
          },
          {
            key: 'long-p10-v4',
            daysAgoN: 180, complaint: 'Debonding and retainer fitting — end of active treatment',
            teeth: [
              { toothNumber: 11, state: 'filled', surfaces: ['labial'], note: 'Bracket removed. Excellent alignment.' },
              { toothNumber: 21, state: 'filled', surfaces: ['labial'], note: 'Bracket removed. No diastema.' },
            ],
            treatments: [
              { cdtCode: 'D8680', description: 'Orthodontic retention — bonded lingual retainer', priceCents: 1800000 },
            ],
            soap: {
              subjective: 'Last brace visit. Very happy. No discomfort.',
              objective: 'Brackets debonded. Lingual retainer bonded #13-23 and #33-43. Occlusion Class I ideal.',
              assessment: 'Orthodontic treatment successfully completed.',
              plan: 'Bonded lingual retainer. Review 6 months.',
            },
            status: 'completed',
          },
        ],
      },
      // ─────────────────────────────────────────────────────────
      // P11 Claudia Bautista — perio arc (4 visits, 2yr span)
      // ─────────────────────────────────────────────────────────
      {
        name: 'Claudia Bautista',
        visits: [
          {
            key: 'long-p11-v1',
            daysAgoN: 720, complaint: 'Bleeding gums and bad breath — first visit in 3 years',
            teeth: [
              { toothNumber: 16, state: 'watchlist', surfaces: ['buccal'], note: '5mm pocket, BOP+' },
              { toothNumber: 26, state: 'watchlist', surfaces: ['buccal'], note: '5mm pocket, BOP+' },
              { toothNumber: 46, state: 'watchlist', surfaces: ['distal'], note: '5mm pocket, furcation I' },
            ],
            treatments: [
              { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', priceCents: 150000 },
              { cdtCode: 'D4910', description: 'Periodontal maintenance — baseline', priceCents: 300000 },
            ],
            soap: {
              subjective: 'Bleeding when brushing daily. Bad breath. Last visit 3 years ago.',
              objective: 'Generalized erythema/edema. BOP 75%. Pocketing 4-6mm. Heavy subgingival calculus. Furcation I #46.',
              assessment: 'Generalized moderate periodontitis (Stage II, Grade B). SRP needed.',
              plan: 'Full X-rays. SRP 2 sessions. OHI given. Waterpik recommended.',
            },
            status: 'locked',
          },
          {
            key: 'long-p11-v2',
            daysAgoN: 580, complaint: 'SRP upper + lower quadrants',
            teeth: [
              { toothNumber: 16, state: 'watchlist', surfaces: ['buccal'], note: 'Post-SRP. Pocket 4mm (was 5mm).' },
              { toothNumber: 26, state: 'watchlist', surfaces: ['buccal'], note: 'Post-SRP. Pocket 3mm (was 5mm).' },
              { toothNumber: 36, state: 'watchlist', surfaces: ['lingual'], note: 'Post-SRP LL. Pocket 3mm (was 4mm).' },
              { toothNumber: 46, state: 'watchlist', surfaces: ['distal'], note: 'Post-SRP LR. Pocket 4mm. Furcation I persists.' },
            ],
            treatments: [
              { cdtCode: 'D4341', description: 'SRP — upper quadrants', priceCents: 1000000 },
              { cdtCode: 'D4341', description: 'SRP — lower quadrants', priceCents: 1000000 },
            ],
            soap: {
              subjective: 'Upper gums feel better. Some sensitivity lower. Compliant with home care.',
              objective: 'UR/UL SRP completed. LL/LR SRP completed. Upper re-eval: BOP 20%, 2-3mm — good response.',
              assessment: 'SRP all quadrants complete. Upper arches responding. #46 furcation I — monitor.',
              plan: 'Supportive perio therapy q3 months. Excellent prognosis if maintained.',
            },
            status: 'locked',
          },
          {
            key: 'long-p11-v3',
            daysAgoN: 360, complaint: 'Periodontal maintenance — 3-month recall',
            teeth: [
              { toothNumber: 16, state: 'filled', surfaces: ['buccal'], note: 'Healthy — 2mm. No BOP.' },
              { toothNumber: 26, state: 'filled', surfaces: ['buccal'], note: 'Healthy — 2mm. No BOP.' },
              { toothNumber: 36, state: 'filled', surfaces: ['lingual'], note: 'Healthy — 2mm. No BOP.' },
              { toothNumber: 46, state: 'watchlist', surfaces: ['distal'], note: 'Stable — 3mm. Furcation I unchanged.' },
            ],
            treatments: [
              { cdtCode: 'D4910', description: 'Periodontal maintenance', priceCents: 400000 },
            ],
            soap: {
              subjective: 'No bleeding when brushing. Gums look healthier. More confident.',
              objective: 'BOP 5%. Pocketing 2-3mm globally. #46 3mm furcation I stable. Minimal deposits.',
              assessment: 'Periodontal health significantly improved. Stage II, Grade B — well-controlled.',
              plan: 'Maintenance q3 months. Monitor #46. Continue Waterpik + proxabrush.',
            },
            status: 'locked',
          },
          {
            key: 'long-p11-v4',
            daysAgoN: 120, complaint: 'Periodontal maintenance — annual recall',
            teeth: [
              { toothNumber: 16, state: 'filled', surfaces: ['buccal'], note: 'Stable — 2mm. Healthy.' },
              { toothNumber: 46, state: 'watchlist', surfaces: ['distal'], note: 'Stable — 3mm. Furcation I. No change.' },
            ],
            treatments: [
              { cdtCode: 'D4910', description: 'Periodontal maintenance — annual', priceCents: 400000 },
              { cdtCode: 'D1206', description: 'Topical fluoride varnish', priceCents: 80000 },
            ],
            soap: {
              subjective: 'No concerns. Gums healthy. Brushing twice daily + Waterpik.',
              objective: 'BOP 3%. All pockets 2-3mm. #46 furcation I — unchanged, no progression.',
              assessment: 'Stable periodontal health. Excellent home care.',
              plan: 'Annual recall. Continue home care. #46 furcation long-term monitoring.',
            },
            status: 'completed',
          },
        ],
      },
      // ─────────────────────────────────────────────────────────
      // P12 Enrique Villanueva — extraction→implant arc (4 visits)
      // ─────────────────────────────────────────────────────────
      {
        name: 'Enrique Villanueva',
        visits: [
          {
            key: 'long-p12-v1',
            daysAgoN: 700, complaint: 'Severe pain #46 — cannot sleep, hot/cold sensitivity',
            teeth: [
              { toothNumber: 46, state: 'caries', surfaces: ['mesial', 'distal', 'occlusal'], conditionCode: 'K02.9', note: 'Gross caries. Non-restorable. Extraction indicated.' },
            ],
            treatments: [
              { cdtCode: 'D0220', description: 'Periapical X-ray #46', priceCents: 80000, toothNumber: 46 },
              { cdtCode: 'D0120', description: 'Emergency evaluation', priceCents: 100000 },
            ],
            soap: {
              subjective: 'Severe spontaneous pain #46 × 1 week. Worsens with heat. No dental care 5 years.',
              objective: 'Tooth #46: gross caries, pulp exposure, percussion +3. Periapical radiolucency. Grade II mobility.',
              assessment: 'Irreversible pulpitis / necrotic pulp #46. Non-restorable. Implant plan discussed.',
              plan: 'Emergency palliative. Extraction + bone graft + implant scheduled.',
            },
            status: 'locked',
          },
          {
            key: 'long-p12-v2',
            daysAgoN: 650, complaint: 'Surgical extraction #46 + alveolar bone graft',
            teeth: [
              { toothNumber: 46, state: 'extracted', note: 'Surgically extracted. Bone graft placed. Collagen membrane closure.' },
            ],
            treatments: [
              { cdtCode: 'D7210', description: 'Surgical extraction #46', priceCents: 800000, toothNumber: 46 },
              { cdtCode: 'D7953', description: 'Alveolar bone graft #46 site', priceCents: 1500000, toothNumber: 46 },
            ],
            soap: {
              subjective: 'Ready for extraction. Arranged driver.',
              objective: '#46 extracted. 3 roots separated and removed. Xenograft + membrane placed. Primary closure 4-0 Vicryl.',
              assessment: 'Uncomplicated surgical extraction + bone graft for implant site preservation.',
              plan: 'Post-op: Amoxicillin + Ibuprofen. Review 1 week. Implant 4-6 months.',
            },
            status: 'locked',
          },
          {
            key: 'long-p12-v3',
            daysAgoN: 420, complaint: 'Dental implant placement #46 — bone healed',
            teeth: [
              { toothNumber: 46, state: 'extracted', note: 'Implant placed. Healing abutment. Osseointegration phase (3-4 months).' },
            ],
            treatments: [
              { cdtCode: 'D6010', description: 'Endosseous implant body #46', priceCents: 5000000, toothNumber: 46 },
              { cdtCode: 'D0220', description: 'PA X-ray pre-implant', priceCents: 80000 },
            ],
            soap: {
              subjective: 'Graft site healed well. No pain. Excited to proceed.',
              objective: 'CBCT: adequate bone #46. 4.1×10mm implant placed, ISQ 72. Healing abutment fitted.',
              assessment: 'Implant placement successful. Osseointegration phase.',
              plan: 'Soft diet 2 weeks. Review 3 months. Crown after osseointegration confirmed.',
            },
            status: 'locked',
          },
          {
            key: 'long-p12-v4',
            daysAgoN: 150, complaint: 'Implant crown delivery #46',
            teeth: [
              { toothNumber: 46, state: 'crown', note: 'Implant-supported porcelain crown cemented. Occlusion excellent.' },
            ],
            treatments: [
              { cdtCode: 'D6065', description: 'Implant-supported crown #46', priceCents: 2500000, toothNumber: 46 },
            ],
            soap: {
              subjective: 'Very happy. Chewing fine on left. No pain since implant.',
              objective: 'Implant stable, ISQ 78. Crown seated on custom abutment. Occlusion Class I verified.',
              assessment: 'Successful implant restoration. Patient highly satisfied.',
              plan: 'Annual implant review. Professional cleaning around implant.',
            },
            status: 'completed',
          },
        ],
      },
      // ─────────────────────────────────────────────────────────
      // P13 Melissa Castro — caries arc (3 visits)
      // ─────────────────────────────────────────────────────────
      {
        name: 'Melissa Castro',
        visits: [
          {
            key: 'long-p13-v1',
            daysAgoN: 550, complaint: 'First dental visit — checkup and cleaning',
            teeth: [
              { toothNumber: 36, state: 'watchlist', surfaces: ['occlusal'], note: 'Deep fissures, staining. Early caries suspected.' },
              { toothNumber: 46, state: 'watchlist', surfaces: ['occlusal'], note: 'Similar fissure pattern. Monitor.' },
              { toothNumber: 26, state: 'watchlist', surfaces: ['occlusal'], note: 'Sealant recommended.' },
            ],
            treatments: [
              { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', priceCents: 150000 },
              { cdtCode: 'D1206', description: 'Topical fluoride varnish', priceCents: 80000 },
            ],
            soap: {
              subjective: 'First-ever dental visit. No pain. Concern about staining.',
              objective: 'Good hygiene. Deep fissures #36, #46 with staining. No proximal lesions on BW.',
              assessment: 'Incipient occlusal caries #36, #46 — watch. Sealant #26 recommended.',
              plan: 'Fluoride. Recall 6 months. Dietary counselling.',
            },
            status: 'locked',
          },
          {
            key: 'long-p13-v2',
            daysAgoN: 370, complaint: 'Caries on #36 confirmed — cold sensitivity started',
            teeth: [
              { toothNumber: 36, state: 'caries', surfaces: ['occlusal'], conditionCode: 'K02.1', note: 'Active caries confirmed BW. Filling placed.' },
              { toothNumber: 46, state: 'watchlist', surfaces: ['occlusal'], note: 'Still early — no sensitivity. Monitor.' },
              { toothNumber: 26, state: 'filled', surfaces: ['occlusal'], note: 'Sealant placed.' },
            ],
            treatments: [
              { cdtCode: 'D2391', description: 'Resin composite 1 surface #36 occlusal', priceCents: 400000, toothNumber: 36 },
              { cdtCode: 'D1351', description: 'Sealant — #26', priceCents: 60000, toothNumber: 26 },
            ],
            soap: {
              subjective: 'Cold sensitivity lower left 3 weeks. No spontaneous pain.',
              objective: '#36 occlusal: active caries BW-confirmed. Pulp: vital. #46 — no lesion yet.',
              assessment: 'Dentinal caries #36 — restorable. #46 early demineralization.',
              plan: 'Composite #36. Sealant #26. Review #46 in 6 months.',
            },
            status: 'locked',
          },
          {
            key: 'long-p13-v3',
            daysAgoN: 150, complaint: 'Sensitivity on #46 — review and filling',
            teeth: [
              { toothNumber: 46, state: 'caries', surfaces: ['occlusal'], conditionCode: 'K02.1', note: 'Caries progressed. Filling placed today.' },
              { toothNumber: 36, state: 'filled', surfaces: ['occlusal'], note: 'Previous filling intact. Good.' },
            ],
            treatments: [
              { cdtCode: 'D2391', description: 'Resin composite 1 surface #46 occlusal', priceCents: 400000, toothNumber: 46 },
              { cdtCode: 'D0120', description: 'Periodic oral evaluation', priceCents: 100000 },
            ],
            soap: {
              subjective: 'Cold sensitivity #46 2 weeks. #36 filling fine.',
              objective: '#46 occlusal: caries progressed, radiographic lesion. Pulp: vital. #36 filling intact.',
              assessment: 'Active caries #46 — restorable.',
              plan: 'Composite #46. Fluoride. 6-month recall.',
            },
            status: 'completed',
          },
        ],
      },
      // ─────────────────────────────────────────────────────────
      // P14 Ramon Aquino — sensitivity→RCT→crown arc (4 visits)
      // ─────────────────────────────────────────────────────────
      {
        name: 'Ramon Aquino',
        visits: [
          {
            key: 'long-p14-v1',
            daysAgoN: 620, complaint: 'Cold sensitivity #26 for 2 months',
            teeth: [
              { toothNumber: 26, state: 'watchlist', surfaces: ['buccal'], conditionCode: 'K03.1', note: 'Cervical sensitivity. No visible lesion. Desensitizer applied.' },
            ],
            treatments: [
              { cdtCode: 'D0220', description: 'Periapical X-ray #26', priceCents: 80000, toothNumber: 26 },
              { cdtCode: 'D9910', description: 'Desensitizing treatment #26', priceCents: 180000, toothNumber: 26 },
            ],
            soap: {
              subjective: 'Sharp cold sensitivity #26 × 2 months. No spontaneous pain.',
              objective: '#26: no caries, slight cervical abrasion. Cold positive 5s. Pulp vital.',
              assessment: 'Dentin hypersensitivity #26. Subclinical caries cannot be excluded.',
              plan: 'Desensitizer. Sensitive toothpaste. Review 3 months.',
            },
            status: 'locked',
          },
          {
            key: 'long-p14-v2',
            daysAgoN: 500, complaint: 'Worsening sensitivity #26 — pain lasts longer',
            teeth: [
              { toothNumber: 26, state: 'caries', surfaces: ['buccal', 'mesial'], conditionCode: 'K02.1', note: 'Caries confirmed BW. Deep composite near pulp. MTA pulp cap.' },
            ],
            treatments: [
              { cdtCode: 'D2393', description: 'Resin composite 3 surfaces #26', priceCents: 600000, toothNumber: 26 },
              { cdtCode: 'D3110', description: 'Direct pulp cap #26', priceCents: 350000, toothNumber: 26 },
            ],
            soap: {
              subjective: 'Cold 15-20s duration now. Heat sensitivity started. No spontaneous pain yet.',
              objective: '#26 BW: proximal+buccal caries near pulp. MTA cap + composite placed.',
              assessment: 'Deep caries #26. Pulp cap — reversible pulpitis possible.',
              plan: 'Deep composite + MTA cap. Review 6 weeks. RCT if worse.',
            },
            status: 'locked',
          },
          {
            key: 'long-p14-v3',
            daysAgoN: 420, complaint: 'Severe spontaneous pain #26 since last week',
            teeth: [
              { toothNumber: 26, state: 'crown', surfaces: ['mesial', 'distal'], note: 'RCT completed. Temporary crown. Permanent scheduled.' },
            ],
            treatments: [
              { cdtCode: 'D3330', description: 'Root canal treatment #26 — 3 canals', priceCents: 1200000, toothNumber: 26 },
              { cdtCode: 'D2750', description: 'Temporary crown #26 post-RCT', priceCents: 250000, toothNumber: 26 },
            ],
            soap: {
              subjective: 'Throbbing pain × 7 days. Heat aggravates. Analgesics failing.',
              objective: '#26 percussion +3. Necrotic pulp. Periapical radiolucency developing. RCT: 3 canals, GP/sealer.',
              assessment: 'Pulp necrosis / symptomatic apical periodontitis #26. RCT completed.',
              plan: 'Temporary crown. Permanent crown within 4 weeks.',
            },
            status: 'locked',
          },
          {
            key: 'long-p14-v4',
            daysAgoN: 300, complaint: 'Permanent crown delivery #26',
            teeth: [
              { toothNumber: 26, state: 'crown', note: 'Porcelain crown cemented. No discomfort.' },
            ],
            treatments: [
              { cdtCode: 'D2740', description: 'Crown — porcelain/ceramic #26', priceCents: 1800000, toothNumber: 26 },
            ],
            soap: {
              subjective: 'Temporary still comfortable. No pain since RCT.',
              objective: 'Crown seated on RCT #26. Occlusion adjusted (light ICP). Patient comfortable.',
              assessment: 'Successful crown post-RCT. Occlusion Class I.',
              plan: 'Annual review. Nightguard — bruxism signs, guard recommended.',
            },
            status: 'completed',
          },
        ],
      },
      // ─────────────────────────────────────────────────────────
      // P15 Patricia Gomez — cosmetic arc (3 visits)
      // ─────────────────────────────────────────────────────────
      {
        name: 'Patricia Gomez',
        visits: [
          {
            key: 'long-p15-v1',
            daysAgoN: 580, complaint: 'Concerned about tooth appearance — wants whiter smile',
            teeth: [
              { toothNumber: 11, state: 'watchlist', surfaces: ['labial'], conditionCode: 'K03.2', note: 'Enamel erosion. Whitening risk — assess first.' },
              { toothNumber: 21, state: 'watchlist', surfaces: ['labial'], conditionCode: 'K03.2', note: 'Paired erosion.' },
              { toothNumber: 36, state: 'watchlist', surfaces: ['occlusal'], note: 'Fissure staining. Early demineralization.' },
            ],
            treatments: [
              { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', priceCents: 150000 },
              { cdtCode: 'D9910', description: 'Desensitizing pre-whitening', priceCents: 180000 },
            ],
            soap: {
              subjective: 'Wants whiter teeth. Coffee 2×/day + fizzy water. No pain.',
              objective: 'Enamel erosion #11-22 labial, roughness. Mild extrinsic staining. Caries-free.',
              assessment: 'Enamel erosion + staining. Whitening feasible after desensitizing.',
              plan: 'Desensitizing. Whitening consult. Composite bonding options discussed.',
            },
            status: 'locked',
          },
          {
            key: 'long-p15-v2',
            daysAgoN: 400, complaint: 'Take-home whitening + composite bonding consultation',
            teeth: [
              { toothNumber: 11, state: 'watchlist', surfaces: ['labial'], note: 'Whitening in progress. Sensitivity manageable.' },
              { toothNumber: 12, state: 'filled', surfaces: ['incisal'], note: 'Composite bonding — chipping corrected.' },
              { toothNumber: 22, state: 'filled', surfaces: ['incisal'], note: 'Composite bonding — chipping corrected.' },
              { toothNumber: 36, state: 'watchlist', surfaces: ['occlusal'], note: 'Incipient fissure caries on BW. Treat next.' },
            ],
            treatments: [
              { cdtCode: 'D9972', description: 'External bleaching — take-home tray (2 arches)', priceCents: 600000 },
              { cdtCode: 'D2330', description: 'Composite resin — 1 surface anterior #12', priceCents: 300000, toothNumber: 12 },
              { cdtCode: 'D2330', description: 'Composite resin — 1 surface anterior #22', priceCents: 300000, toothNumber: 22 },
            ],
            soap: {
              subjective: 'Excited to start whitening. Chipping on #12, #22 feels rough.',
              objective: 'Custom trays fabricated. Opalescence 15% CP dispensed. Bonding #12, #22 — excellent contour. Fissure caries #36 on BW.',
              assessment: 'Whitening in progress. Bonding successful. Caries #36 — fill next.',
              plan: 'Whitening 2 weeks home. #36 filling next appointment.',
            },
            status: 'locked',
          },
          {
            key: 'long-p15-v3',
            daysAgoN: 200, complaint: 'Filling #36 + whitening result review',
            teeth: [
              { toothNumber: 36, state: 'filled', surfaces: ['occlusal'], note: 'Fissure caries treated. Composite placed.' },
              { toothNumber: 11, state: 'filled', surfaces: ['labial'], note: 'Whitening complete. Shade A1 from A3.5. Stable.' },
              { toothNumber: 21, state: 'filled', surfaces: ['labial'], note: 'Whitening complete. Shade matched.' },
              { toothNumber: 12, state: 'filled', surfaces: ['incisal'], note: 'Bonding stable.' },
              { toothNumber: 22, state: 'filled', surfaces: ['incisal'], note: 'Bonding stable.' },
            ],
            treatments: [
              { cdtCode: 'D2391', description: 'Resin composite 1 surface #36', priceCents: 400000, toothNumber: 36 },
              { cdtCode: 'D0120', description: 'Periodic evaluation + whitening review', priceCents: 100000 },
            ],
            soap: {
              subjective: 'Very happy with whitening — shade improved dramatically. #36 no sensitivity.',
              objective: '#36 composite 1 surface. Whitening: A3.5→A1 (Vita Classic). Bonds #12/#22 stable.',
              assessment: 'Excellent cosmetic outcome.',
              plan: 'Annual recall. Top-up whitening. Porcelain veneers deferred — patient happy.',
            },
            status: 'completed',
          },
        ],
      },
    ];

    // ── Carousel depth: pad selected arcs with recurring recall/maintenance ──
    // The timeline carousel only reads as real with many per-visit layers. The
    // hand-authored arcs above top out at ~4 visits; pad the first three to 12+
    // with backdated maintenance encounters spaced between the patient's last
    // detailed visit and ~30 days ago. Same direct-insert historical path; each
    // recall carries the standing chart forward (coherent cumulative snapshot)
    // and rotates complaint/treatments so consecutive cards visibly differ.
    const RECALL_RECIPES = [
      {
        complaint: 'Periodontal maintenance recall — scaling and review',
        treatments: [{ cdtCode: 'D4910', description: 'Periodontal maintenance', priceCents: 250000 }],
        soap: {
          subjective: 'Routine maintenance. No new complaints.',
          objective: 'Pocket depths stable 3-4mm. BOP localized. Light supragingival calculus.',
          assessment: 'Stable periodontium under maintenance therapy.',
          plan: 'Full-mouth scaling and polish. Reinforce interdental cleaning. 3-month recall.',
        },
      },
      {
        complaint: 'Recall exam and prophylaxis',
        treatments: [
          { cdtCode: 'D0120', description: 'Periodic oral evaluation', priceCents: 100000 },
          { cdtCode: 'D1110', description: 'Adult prophylaxis', priceCents: 250000 },
        ],
        soap: {
          subjective: 'Routine recall. Asymptomatic.',
          objective: 'Oral hygiene good. Existing restorations intact. No new caries detected.',
          assessment: 'Healthy dentition, maintenance phase.',
          plan: 'Prophylaxis and fluoride. 6-month recall scheduled.',
        },
      },
      {
        complaint: 'Recall — bitewings and fluoride varnish',
        treatments: [
          { cdtCode: 'D0274', description: 'Bitewing radiographs — four films', priceCents: 180000 },
          { cdtCode: 'D1206', description: 'Topical fluoride varnish', priceCents: 80000 },
        ],
        soap: {
          subjective: 'Recall visit. No pain or sensitivity.',
          objective: 'Bitewings show no interproximal caries. Restoration margins intact.',
          assessment: 'No active disease.',
          plan: 'Continue maintenance. 6-month recall.',
        },
      },
    ];

    function padArc(arc: PatientArc, target: number) {
      if (arc.visits.length >= target) return;
      const last = arc.visits[arc.visits.length - 1];
      const carryTeeth = last.teeth.map(t => ({ ...t })); // standing findings carry forward
      const baseKey = arc.visits[0].key.replace(/-v\d+$/, ''); // e.g. 'long-p11'
      const need = target - arc.visits.length;
      // last.daysAgoN is the most recent detailed visit; fill the window down to ~30 days ago.
      const step = Math.max(20, Math.floor((last.daysAgoN - 30) / (need + 1)));
      for (let i = 0; i < need; i++) {
        const r = RECALL_RECIPES[i % RECALL_RECIPES.length];
        arc.visits.push({
          key: `${baseKey}-r${i + 1}`,
          daysAgoN: Math.max(30, last.daysAgoN - step * (i + 1)),
          complaint: r.complaint,
          teeth: carryTeeth,
          treatments: r.treatments,
          soap: r.soap,
          status: 'completed',
        });
      }
    }

    // Three "deep" patients with 12+ visits so the carousel timeline is exercised.
    for (const arc of arcs.slice(0, 3)) padArc(arc, 13);

    let totalVisitsInserted = 0;
    for (const arc of arcs) {
      const patientId = longPatientMap.get(arc.name);
      if (!patientId) { log(`  ⚠ Patient not found: ${arc.name}`); continue; }
      log(`\n  ── ${arc.name}`);

      // Track the last teeth array for chart baseline update
      let lastTeeth: ToothSpec[] = [];

      for (const vs of arc.visits) {
        const visitId = detUuid(`visit:${vs.key}`);
        const visitDate = daysAgo(vs.daysAgoN);
        const completedAt = daysAgo(vs.daysAgoN - 1);
        const lockedAt = vs.status === 'locked' ? daysAgo(vs.daysAgoN - 2) : null;

        // Insert visit directly as completed/locked
        const visitRow: NewDentalVisit = {
          id: visitId,
          patientId,
          branchId: branch.id,
          dentistMemberId: owner.id,
          status: vs.status,
          activatedAt: visitDate,
          completedAt,
          lockedAt,
          chiefComplaint: vs.complaint,
          createdBy: owner.personId ?? null,
          updatedBy: owner.personId ?? null,
        };
        await db.insert(dentalVisits).values(visitRow).onConflictDoNothing();

        // Insert dental chart
        const chartRow: NewDentalChart = {
          id: detUuid(`chart:${vs.key}`),
          visitId,
          patientId,
          layer: 'completed',
          teeth: vs.teeth as any,
          createdBy: owner.personId ?? null,
          updatedBy: owner.personId ?? null,
        };
        await db.insert(dentalCharts).values(chartRow).onConflictDoNothing();

        // Insert treatments (all 'performed' — full arc)
        for (let ti = 0; ti < vs.treatments.length; ti++) {
          const t = vs.treatments[ti];
          const treatRow: NewDentalTreatment = {
            id: detUuid(`treatment:${vs.key}:${ti}`),
            visitId,
            patientId,
            cdtCode: t.cdtCode,
            description: t.description,
            priceCents: t.priceCents,
            toothNumber: t.toothNumber ?? null,
            surfaces: t.surfaces ? t.surfaces as any : null,
            status: 'performed',
            performedAt: completedAt,
            createdBy: owner.personId ?? null,
            updatedBy: owner.personId ?? null,
          };
          await db.insert(dentalTreatments).values(treatRow).onConflictDoNothing();
        }

        // Insert SOAP notes
        const noteRow: NewVisitNotes = {
          id: detUuid(`note:${vs.key}`),
          visitId,
          authorMemberId: owner.id,
          subjective: vs.soap.subjective,
          objective: vs.soap.objective,
          assessment: vs.soap.assessment,
          plan: vs.soap.plan,
          signed: true,
          signedAt: completedAt,
          signedBy: owner.personId ?? null,
          lockedAt: vs.status === 'locked' ? lockedAt : null,
          createdBy: owner.personId ?? null,
          updatedBy: owner.personId ?? null,
        };
        await db.insert(visitNotes).values(noteRow).onConflictDoNothing();

        lastTeeth = vs.teeth;
        totalVisitsInserted++;
        log(`    ✓ ${vs.key} — ${vs.complaint.slice(0, 50)} [${vs.status}]`);
      }

      // Update (or insert) the patient-level chart baseline with the last visit's teeth
      const baselineId = detUuid(`baseline:${arc.name}`);
      const existingBaseline = await db
        .select({ id: dentalPatientChartBaselines.id })
        .from(dentalPatientChartBaselines)
        .where(eq(dentalPatientChartBaselines.patientId, patientId))
        .limit(1);

      const lastVisitId = detUuid(`visit:${arc.visits[arc.visits.length - 1].key}`);
      if (existingBaseline.length > 0) {
        await db
          .update(dentalPatientChartBaselines)
          .set({ teeth: lastTeeth as any, lastVisitId, snapshotAt: new Date() })
          .where(eq(dentalPatientChartBaselines.patientId, patientId));
      } else {
        await db.insert(dentalPatientChartBaselines).values({
          id: baselineId,
          patientId,
          teeth: lastTeeth as any,
          lastVisitId,
          snapshotAt: new Date(),
          createdBy: owner.personId ?? null,
          updatedBy: owner.personId ?? null,
        }).onConflictDoNothing();
      }
    }
    log(`\n  Σ Longitudinal: ${totalVisitsInserted} visits across ${arcs.length} patients`);

    // ── Perio multi-exam history (demoable longitudinal comparison) ──────────
    // Claudia Bautista's perio arc gets two FINALIZED perio charts — an initial
    // exam (deeper pockets, high BOP) and a maintenance exam ~20 months later
    // (mostly improved, with one relapsed site #35) — so the perio "History"
    // comparison view has a real improving trend to render out of the box.
    const claudiaId = longPatientMap.get('Claudia Bautista');
    if (claudiaId) {
      const PERIO_TEETH = [16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 36, 46, 35, 45];
      const isMolar = (t: number) => [6, 7, 8].includes(t % 10);
      const siteDepths = (tooth: number, profile: 'initial' | 'stable'): number[] => {
        if (profile === 'initial') return isMolar(tooth) ? [5, 4, 6, 4, 5, 5] : [3, 3, 4, 3, 3, 3];
        if (tooth === 35) return [3, 4, 5, 3, 3, 3]; // relapsed site → "worse" (red) in the grid
        return isMolar(tooth) ? [3, 3, 4, 3, 3, 3] : [2, 2, 3, 2, 2, 2];
      };
      const DEEP = 5; // ≥5mm = deep pocket (matches completePerioChart threshold)

      // Each finalized perio chart belongs to its own visit (one-chart-per-visit
      // unique constraint): the initial exam → v1, the maintenance exam → v4.
      const perioExams: { key: string; visitKey: string; daysAgoN: number; status: 'completed' | 'locked'; profile: 'initial' | 'stable' }[] = [
        { key: 'long-p11-perio-initial', visitKey: 'long-p11-v1', daysAgoN: 719, status: 'locked', profile: 'initial' },
        { key: 'long-p11-perio-maint', visitKey: 'long-p11-v4', daysAgoN: 119, status: 'completed', profile: 'stable' },
      ];

      for (const ex of perioExams) {
        const chartId = detUuid(`perio-chart:${ex.key}`);
        const completedAt = daysAgo(ex.daysAgoN);
        // Generate readings + roll up the summary stats the chart row stores.
        let depthSum = 0, depthCount = 0, deepCount = 0, bopTrue = 0, bopTotal = 0;
        const sites = ['BM', 'BC', 'BD', 'LM', 'LC', 'LD'] as const;
        const readingRows = PERIO_TEETH.map((tooth) => {
          const d = siteDepths(tooth, ex.profile);
          // No explicit id — defaultRandom() PK + the (chartId,toothNumber)
          // unique index keep re-runs idempotent (detUuid collides on these
          // tooth-numbered seeds, which silently dropped rows).
          const row: Record<string, unknown> = {
            chartId, toothNumber: tooth,
            createdBy: owner.personId ?? null, updatedBy: owner.personId ?? null,
          };
          sites.forEach((s, i) => {
            const depth = d[i]!;
            row[`depth${s}`] = depth;
            const bleeds = depth >= (ex.profile === 'initial' ? 4 : DEEP);
            row[`bop${s}`] = bleeds;
            depthSum += depth; depthCount += 1;
            if (depth >= DEEP) deepCount += 1;
            bopTotal += 1; if (bleeds) bopTrue += 1;
          });
          return row;
        });
        const meanDepth = depthCount > 0 ? depthSum / depthCount : 0;
        const bopPercent = bopTotal > 0 ? (bopTrue / bopTotal) * 100 : 0;

        await db.insert(dentalPerioCharts).values({
          id: chartId,
          // one chart per visit (unique); the chart's completedAt drives ordering.
          visitId: detUuid(`visit:${ex.visitKey}`),
          patientId: claudiaId,
          branchId: branch.id,
          examinerMemberId: owner.id,
          status: ex.status,
          completedAt,
          summaryBopPercent: bopPercent.toFixed(2),
          summaryMeanDepth: meanDepth.toFixed(2),
          summaryDeepPocketCount: deepCount,
          createdBy: owner.personId ?? null,
          updatedBy: owner.personId ?? null,
        }).onConflictDoNothing();
        await db.insert(dentalPerioToothReadings).values(readingRows as any).onConflictDoNothing();
      }
      log(`  ✓ Perio history: 2 exams for Claudia Bautista (improving trend, 1 relapsed site)`);
    }
  }

  // ── Case-presentation treatment plans (case-presentation G2) ───────────────
  // The base seed creates ZERO plan-level treatment plans, so the case-presentation
  // module was UI-unreachable ("Present to patient" never renders) and its accept
  // workflow undemoable. Seed plans across the FSM (draft / presented / accepted /
  // rejected) with LINKED treatment items + an alternate option group, plus a
  // case-presentation row for the patient-facing ones, so the whole present→accept/
  // decline journey is demoable and E2E-reachable out of the box.
  section('Case-presentation plans (treatment plans + presentations)');

  const providerPersonId = owner.personId ?? owner.id;

  /** Ensure the patient has a visit to hang treatment items off; create one if absent. */
  async function ensureVisit(patientId: string, key: string): Promise<string> {
    const existing = visitByPatient.get(patientId);
    if (existing) return existing;
    const visitId = detUuid(`cp-visit:${key}`);
    await db.insert(dentalVisits).values({
      id: visitId, patientId, branchId: branch.id, dentistMemberId: owner.id,
      status: 'completed', activatedAt: daysAgo(14), completedAt: daysAgo(14),
      chiefComplaint: 'Comprehensive treatment planning', createdBy: providerPersonId, updatedBy: providerPersonId,
    }).onConflictDoNothing();
    visitByPatient.set(patientId, visitId);
    return visitId;
  }

  // cpPlanSpecs is defined at module scope (exported for testing) — see top of file.
  //
  // DETERMINISTIC patient binding by displayName (durable fix for the §15 note in
  // cpPlanSpecs / J19 and the J08 break): the original `allPatients[patientIdx]`
  // bound each cp plan to a patient by NON-deterministic physical-row order, which
  // landed the TERMINAL `rejected` plan on Ana Reyes. J08 (informed refusal) needs
  // Ana to hold a DECLINABLE non-terminal plan, so it broke. Bind by name instead:
  // Ana → `presented` (declinable; J08 declines an item before J19 runs), and the
  // terminal `rejected`/`approved` plans → other demo patients. J19 still finds a
  // `presented` + `draft` plan by status, so its accept/reject legs are unaffected.
  // Map name → patient using ONLY the persons that are actually patients. The
  // persons table carries many non-patient rows (staff, plus duplicate-name
  // persons across reseeds), so a global name→person map collides and resolves a
  // name to a non-patient person. Scope it to patient persons so the lookup is exact.
  const patientPersonIds = allPatients.map((p) => p.person).filter((id): id is string => !!id);
  const patientPersonRows = patientPersonIds.length
    ? await db.select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName })
        .from(persons).where(inArray(persons.id, patientPersonIds))
    : [];
  const nameByPersonId = new Map(patientPersonRows.map((p) => [p.id, `${p.firstName} ${p.lastName ?? ''}`.trim()]));
  // Bind each cp plan to a SPECIFIC demo patient by name. Ana Reyes is deliberately
  // EXCLUDED: J08 (informed refusal) declines her FIRST pending treatment, and a cp
  // plan's items live on a COMPLETED visit — declining a treatment on a completed
  // visit is blocked (createDentalTreatment.ts visit-status guard), so any cp plan on
  // Ana shadows her active-visit declinable treatments and breaks J08. Diego Ramos
  // (no Set-A journey depends on him) carries the `presented` plan instead; J19
  // discovers presented/draft plans by STATUS, so its accept/reject legs still work.
  const cpPatientNameByKey: Record<string, string> = {
    'cp-presented': 'Diego Ramos',
    'cp-accepted': 'Carlos Mendoza',
    'cp-rejected': 'Miguel Torres',
    'cp-draft': 'Maria Santos',
  };
  const cpPatientByName = (name: string | undefined) =>
    name ? allPatients.find((p) => p.person != null && nameByPersonId.get(p.person) === name) : undefined;

  let cpPlans = 0, cpPresentations = 0;
  for (const spec of cpPlanSpecs) {
    // Prefer the deterministic name binding; fall back to the legacy index so the
    // seed still works on a patient set that lacks the named demo patients.
    const patient = cpPatientByName(cpPatientNameByKey[spec.key]) ?? allPatients[spec.patientIdx % allPatients.length];
    if (!patient) continue;
    const visitId = await ensureVisit(patient.id, spec.key);
    const planId = detUuid(`cp-plan:${spec.key}`);
    const presentedAt = spec.status === 'draft' ? null : daysAgo(7);
    const approvedAt = spec.status === 'approved' ? daysAgo(3) : null;
    const total = spec.items.reduce((s, i) => s + i.priceCents, 0);

    const planRow: NewDentalTreatmentPlan = {
      id: planId, patientId: patient.id, providerId: providerPersonId, status: spec.status,
      totalEstimateCents: total, presentedAt, approvedAt,
      createdBy: providerPersonId, updatedBy: providerPersonId,
    };
    await db.insert(dentalTreatmentPlans).values(planRow).onConflictDoNothing();

    // LINKED treatment items (treatmentPlanId set) — the link the present-path now performs.
    // No explicit id: detUuid() collides across near-identical seed strings (the
    // documented tooth-numbered-seed gotcha) and silently drops items via
    // onConflictDoNothing. defaultRandom() PK + the full reset-db before each
    // reseed keep this idempotent.
    for (const it of spec.items) {
      await db.insert(dentalTreatments).values({
        visitId, patientId: patient.id, treatmentPlanId: planId,
        toothNumber: it.tooth, cdtCode: it.cdt, description: it.desc, priceCents: it.priceCents,
        phase: (it.phase ?? null) as any, status: it.status,
        optionGroupId: it.optionGroupId ?? null, recommended: it.recommended ?? false,
        createdBy: providerPersonId, updatedBy: providerPersonId,
      }).onConflictDoNothing();
    }

    // Status-history rows for the transitions the FSM would have recorded.
    if (spec.status !== 'draft') {
      await db.insert(dentalTreatmentPlanStatusHistory).values({
        treatmentPlanId: planId, fromStatus: 'draft', toStatus: 'presented',
        changedByPersonId: providerPersonId, createdBy: providerPersonId, updatedBy: providerPersonId,
      }).onConflictDoNothing();
    }
    if (spec.status === 'approved') {
      await db.insert(dentalTreatmentPlanStatusHistory).values({
        treatmentPlanId: planId, fromStatus: 'presented', toStatus: 'approved',
        changedByPersonId: providerPersonId, createdBy: providerPersonId, updatedBy: providerPersonId,
      }).onConflictDoNothing();
      // Approval record (parity with both approval paths — case-presentation G3).
      await db.insert(dentalTreatmentPlanApprovals).values({
        id: detUuid(`cp-approval:${spec.key}`),
        treatmentPlanId: planId, approvedByPersonId: patient.person, method: 'signature',
        createdBy: providerPersonId, updatedBy: providerPersonId,
      }).onConflictDoNothing();
    }
    if (spec.status === 'rejected') {
      await db.insert(dentalTreatmentPlanStatusHistory).values({
        treatmentPlanId: planId, fromStatus: 'presented', toStatus: 'rejected',
        changedByPersonId: providerPersonId, createdBy: providerPersonId, updatedBy: providerPersonId,
      }).onConflictDoNothing();
    }
    cpPlans++;

    if (spec.withPresentation) {
      const cpStatus = spec.decision === 'accepted' ? 'accepted' : spec.decision === 'rejected' ? 'rejected' : 'draft';
      const cpRow: NewDentalCasePresentation = {
        id: detUuid(`cp-presentation:${spec.key}`),
        patientId: patient.id, treatmentPlanId: planId, status: cpStatus as any,
        decision: spec.decision ?? null,
        decisionAt: spec.decision ? daysAgo(3) : null,
        signerName: spec.decision === 'accepted' ? 'Patient (demo e-sign)' : null,
        signatureData: spec.decision === 'accepted' ? 'data:image/png;base64,iVBORw0KGgo=' : null,
        rejectionReason: spec.rejectionReason ?? null,
        createdBy: providerPersonId, updatedBy: providerPersonId,
      };
      await db.insert(dentalCasePresentations).values(cpRow).onConflictDoNothing();
      cpPresentations++;
    }
    log(`  ✓ ${spec.key} — plan ${spec.status}${spec.withPresentation ? ' + presentation' : ''} (₱${(total / 100).toLocaleString()})`);
  }
  log(`  Σ Case-presentation: ${cpPlans} plans, ${cpPresentations} presentations`);

  console.log('\n✓ Supplement seed complete.\n');
}

// Only run the seed when executed directly (`bun scripts/seed-supplement.ts`),
// not when imported by a test that consumes the exported cpPlanSpecs.
if (import.meta.main) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n✗ Supplement seed failed:', err);
      process.exit(1);
    });
}
