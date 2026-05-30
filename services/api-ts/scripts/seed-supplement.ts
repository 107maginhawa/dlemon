/**
 * seed-supplement.ts — DB-direct supplement for Dentalemon demo data
 *
 * Fills the two gaps the API-based legacy seed (root scripts/seed-demo.ts) could
 * NOT create because API validation blocked them:
 *   1. dental_invoice (+ dental_invoice_line_item) — invoices across all statuses
 *   2. dental_appointment — appointments across all statuses + relative dates
 *
 * READ-ONLY w.r.t. existing clinical data: it QUERIES the live `monobase` DB for
 * the already-seeded patients, visits, branch, and dentist_owner membership, then
 * INSERTS invoices + appointments DIRECTLY via Drizzle (bypassing API validation).
 *
 * Idempotent: deterministic invoiceNumber (unique index) + deterministic appointment
 * ids, both written with .onConflictDoNothing(), so re-running is safe.
 *
 * Usage: cd services/api-ts && bun scripts/seed-supplement.ts
 */

import { createDatabase } from '@/core/database';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
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
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase';
const db = createDatabase({ url: DATABASE_URL });

// ─── Date helpers (relative to now — never hardcoded) ────────────────────────
const daysAgo = (n: number, h = 9) => {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d;
};
const daysFromNow = (n: number, h = 10) => {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d;
};
const atToday = (h: number, m = 0) => {
  const d = new Date(); d.setHours(h, m, 0, 0); return d;
};

// ─── Deterministic UUID helper (idempotent ids from a stable seed string) ────
// Builds an RFC-4122-shaped v4 UUID deterministically from a label so re-runs
// produce the same id and .onConflictDoNothing() de-dupes on the PK.
function detUuid(seed: string): string {
  let h = 2166136261 >>> 0;
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    h ^= seed.charCodeAt((i * 7 + 13) % seed.length) || (i + 1);
    h = Math.imul(h, 16777619) >>> 0;
    bytes.push((h >>> ((i % 4) * 8)) & 0xff);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

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
    { key: 'INV-S0004', patientIdx: 3, status: 'overdue', lines: [
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
    { key: 'INV-S0008', patientIdx: 7, status: 'overdue', lines: [
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
    let status = spec.status;
    if (status === 'paid') paidCents = totalCents;
    else if (status === 'partial') paidCents = Math.round(totalCents * 0.5);
    const balanceCents = totalCents - paidCents;

    const invoiceId = detUuid(`invoice:${spec.key}`);
    const issuedAt = status === 'draft' ? null : daysAgo(20);
    const dueDate =
      status === 'overdue' ? daysAgo(15)
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
    when: Date;
    durationMinutes: number;
    serviceType: string;
    status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';
    walkIn?: boolean;
    notes?: string;
  };

  const apptSpecs: ApptSpec[] = [
    // Today
    { key: 'APT-S001', patientIdx: 0, when: atToday(9),       durationMinutes: 30, serviceType: 'Routine cleaning',      status: 'scheduled' },
    { key: 'APT-S002', patientIdx: 1, when: atToday(10, 30),  durationMinutes: 45, serviceType: 'Filling follow-up',     status: 'checked_in' },
    { key: 'APT-S003', patientIdx: 8, when: atToday(11, 30),  durationMinutes: 30, serviceType: 'Walk-in — toothache',   status: 'scheduled', walkIn: true },
    { key: 'APT-S004', patientIdx: 2, when: atToday(14),      durationMinutes: 60, serviceType: 'Crown cementation',     status: 'scheduled' },
    // Tomorrow
    { key: 'APT-S005', patientIdx: 3, when: daysFromNow(1, 9),     durationMinutes: 60, serviceType: 'Surgical extraction',  status: 'scheduled' },
    { key: 'APT-S006', patientIdx: 4, when: daysFromNow(1, 11),    durationMinutes: 45, serviceType: 'Implant consultation', status: 'scheduled' },
    { key: 'APT-S007', patientIdx: 6, when: daysFromNow(2, 10),    durationMinutes: 30, serviceType: 'Ortho review',         status: 'scheduled' },
    { key: 'APT-S008', patientIdx: 5, when: daysFromNow(3, 15),    durationMinutes: 90, serviceType: 'Root canal',           status: 'scheduled' },
    // Past — completed
    { key: 'APT-S009', patientIdx: 0, when: daysAgo(10, 9),   durationMinutes: 30, serviceType: 'Periodic exam',         status: 'completed' },
    { key: 'APT-S010', patientIdx: 2, when: daysAgo(20, 10),  durationMinutes: 60, serviceType: 'Crown prep',            status: 'completed' },
    { key: 'APT-S011', patientIdx: 7, when: daysAgo(7, 14),   durationMinutes: 45, serviceType: 'Perio SRP',             status: 'completed' },
    // Past — cancelled / no_show
    { key: 'APT-S012', patientIdx: 9, when: daysAgo(5, 11),   durationMinutes: 30, serviceType: 'Cleaning',              status: 'cancelled', notes: 'Patient rescheduled.' },
    { key: 'APT-S013', patientIdx: 3, when: daysAgo(3, 13),   durationMinutes: 60, serviceType: 'Extraction',            status: 'no_show' },
    { key: 'APT-S014', patientIdx: 1, when: daysAgo(2, 16),   durationMinutes: 30, serviceType: 'Sensitivity follow-up', status: 'no_show' },
  ];

  let apptCount = 0;
  const apptTally: Record<string, number> = {};

  for (const spec of apptSpecs) {
    const patient = allPatients[spec.patientIdx % allPatients.length];
    if (!patient) continue;

    const row: NewDentalAppointment = {
      id: detUuid(`appt:${spec.key}`),
      patientId: patient.id,
      dentistMemberId: owner.id,
      branchId: branch.id,
      scheduledAt: spec.when,
      durationMinutes: spec.durationMinutes,
      serviceType: spec.serviceType,
      walkIn: spec.walkIn ?? false,
      status: spec.status,
      checkInTime: spec.status === 'checked_in' || spec.status === 'completed' ? spec.when : null,
      notes: spec.notes ?? null,
      cancelledAt: spec.status === 'cancelled' ? spec.when : null,
      cancellationReason: spec.status === 'cancelled' ? (spec.notes ?? 'Cancelled') : null,
      noShowAt: spec.status === 'no_show' ? spec.when : null,
      createdBy: owner.personId ?? null,
      updatedBy: owner.personId ?? null,
    };

    await db.insert(dentalAppointments).values(row).onConflictDoNothing();
    apptCount++;
    apptTally[spec.status] = (apptTally[spec.status] ?? 0) + 1;
  }
  log(`Σ ${apptCount} appointments — ${JSON.stringify(apptTally)}`);

  console.log('\n✓ Supplement seed complete.\n');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n✗ Supplement seed failed:', err);
    process.exit(1);
  });
