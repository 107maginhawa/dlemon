/**
 * seed-demo.ts — Demo data seed script for Dentalemon
 *
 * Creates a complete demo clinic with real user credentials,
 * patients, appointments, and clinical/billing data.
 *
 * Usage:
 *   bun scripts/seed-demo.ts
 *
 * Prerequisites:
 *   - API running on http://localhost:7213 (cd services/api-ts && bun dev)
 *   - Postgres running (cd services/api-ts && bun run dev:deps:up)
 *
 * Demo Credentials:
 *   Email:    demo@dentalemon.com
 *   Password: DemoClinic1!
 *   PIN:      1 2 3 4 5 6  (for Dr. Reyes on the PIN select screen)
 */

const API = 'http://localhost:7213';

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`  ${msg}`);
}

function section(title: string) {
  console.log(`\n▶ ${title}`);
}

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

async function patch(path: string, body: unknown, cookie: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PATCH ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

async function get(path: string, cookie: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Cookie: cookie },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

// Extract session cookie from a sign-in/sign-up response
function getCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  // grab the first cookie value (better-auth session)
  return raw.split(',').map(c => c.split(';')[0]).filter(Boolean).join('; ');
}

async function signUp(email: string, password: string, name: string): Promise<{ cookie: string; userId: string }> {
  const res = await fetch(`${API}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // If already exists, sign in instead
    if (res.status === 422 || text.includes('already')) {
      return signIn(email, password);
    }
    throw new Error(`Sign-up failed ${res.status}: ${text.slice(0, 300)}`);
  }
  const cookie = getCookie(res);
  const body = await res.json() as any;
  return { cookie, userId: body.user?.id ?? body.id };
}

async function signIn(email: string, password: string): Promise<{ cookie: string; userId: string }> {
  const res = await fetch(`${API}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sign-in failed ${res.status}: ${text.slice(0, 300)}`);
  }
  const cookie = getCookie(res);
  const body = await res.json() as any;
  return { cookie, userId: body.user?.id ?? body.id };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      Dentalemon Demo Seed Script         ║');
  console.log('╚══════════════════════════════════════════╝');

  // ── 1. User account ─────────────────────────────────────────────────────
  section('1. Creating demo user account');
  const EMAIL = 'demo@dentalemon.com';
  const PASSWORD = 'DemoClinic1!';

  const { cookie, userId } = await signUp(EMAIL, PASSWORD, 'Dr. Maria Reyes');
  log(`✓ User: ${EMAIL} / ${PASSWORD}`);
  log(`  User ID: ${userId}`);

  // ── 2. Person profile ───────────────────────────────────────────────────
  section('2. Creating person profile');
  const person = await post('/persons', {
    firstName: 'Maria',
    lastName: 'Reyes',
    gender: 'female',
    timezone: 'Asia/Manila',
  }, cookie).catch(() => null); // ok if already exists
  log(`✓ Person profile created`);

  // ── 3. Dental organization ──────────────────────────────────────────────
  section('3. Creating clinic');
  const org = await post('/dental/organizations/', {
    name: 'Reyes Family Dental',
    tier: 'clinic',
    countryCode: 'PH',
  }, cookie);
  log(`✓ Org: ${org.name} (${org.id})`);

  // ── 4. Branch ───────────────────────────────────────────────────────────
  section('4. Creating branch');
  const branch = await post(`/dental/organizations/${org.id}/branches/`, {
    name: 'Main Clinic',
    timezone: 'Asia/Manila',
    address: '123 Bonifacio Ave',
    city: 'Makati',
    phone: '+63 2 8123 4567',
  }, cookie);
  log(`✓ Branch: ${branch.name} (${branch.id})`);

  // ── 5. Staff members ────────────────────────────────────────────────────
  section('5. Creating staff members');

  const ownerMember = await post(`/dental/org/members?branchId=${branch.id}`, {
    displayName: 'Dr. Maria Reyes',
    role: 'dentist_owner',
    personId: userId,
  }, cookie);
  log(`✓ Member: ${ownerMember.displayName} (dentist_owner, ID: ${ownerMember.id})`);

  // Set PIN 123456 for the owner
  await post(
    `/dental/organizations/${org.id}/branches/${branch.id}/members/${ownerMember.id}/set-pin`,
    { pin: '123456' },
    cookie,
  );
  log(`  PIN: 1 2 3 4 5 6`);

  const assistantMember = await post(`/dental/org/members?branchId=${branch.id}`, {
    displayName: 'Ana Santos',
    role: 'staff_full',
  }, cookie);
  log(`✓ Member: ${assistantMember.displayName} (staff_full, ID: ${assistantMember.id})`);

  await post(
    `/dental/organizations/${org.id}/branches/${branch.id}/members/${assistantMember.id}/set-pin`,
    { pin: '654321' },
    cookie,
  );
  log(`  PIN: 6 5 4 3 2 1`);

  // ── 6. Patients ─────────────────────────────────────────────────────────
  section('6. Creating patients');

  const patientsData = [
    { displayName: 'Juan dela Cruz', dateOfBirth: '1985-03-15', gender: 'male' },
    { displayName: 'Maria Santos', dateOfBirth: '1992-07-22', gender: 'female' },
    { displayName: 'Roberto Lim', dateOfBirth: '1978-11-08', gender: 'male' },
    { displayName: 'Elena Garcia', dateOfBirth: '2010-05-30', gender: 'female' },
    { displayName: 'Carlos Mendoza', dateOfBirth: '1965-01-19', gender: 'male' },
  ];

  const patients: any[] = [];
  for (const p of patientsData) {
    const patient = await post('/dental/patients', {
      ...p,
      consentGiven: true,
      branchId: branch.id,
    }, cookie);
    patients.push(patient);
    log(`✓ Patient: ${p.displayName} (ID: ${patient.id})`);
  }

  // ── 7. Appointments for today + tomorrow ────────────────────────────────
  section('7. Creating appointments');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  function todayAt(hour: number, minute = 0) {
    const d = new Date(today);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  function tomorrowAt(hour: number, minute = 0) {
    const d = new Date(tomorrow);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  const appointmentsData = [
    { patient: patients[0], scheduledAt: todayAt(9, 0), duration: 60, procedure: 'Comprehensive Exam + X-rays' },
    { patient: patients[1], scheduledAt: todayAt(10, 30), duration: 30, procedure: 'Teeth Cleaning' },
    { patient: patients[2], scheduledAt: todayAt(14, 0), duration: 90, procedure: 'Crown Preparation' },
    { patient: patients[3], scheduledAt: tomorrowAt(9, 0), duration: 45, procedure: 'Filling (Upper Molar)' },
    { patient: patients[4], scheduledAt: tomorrowAt(11, 0), duration: 60, procedure: 'Root Canal Consultation' },
  ];

  const appointments: any[] = [];
  for (const a of appointmentsData) {
    const appt = await post('/dental/appointments/', {
      patientId: a.patient.id,
      dentistMemberId: ownerMember.id,
      branchId: branch.id,
      scheduledAt: a.scheduledAt,
      durationMinutes: a.duration,
      procedureType: a.procedure,
    }, cookie);
    appointments.push(appt);
    log(`✓ Appt: ${a.patient.displayName} — ${a.procedure}`);
  }

  // ── 8. Completed visit + invoice (Patient 0) ────────────────────────────
  section('8. Creating completed visit with invoice (Juan dela Cruz)');

  const visit0 = await post('/dental/visits', {
    patientId: patients[0].id,
    branchId: branch.id,
    dentistMemberId: ownerMember.id,
    chiefComplaint: 'Routine checkup and cleaning',
  }, cookie);

  // Activate
  await patch(`/dental/visits/${visit0.id}`, { status: 'active' }, cookie);

  // Add treatments
  const tx1 = await post(`/dental/visits/${visit0.id}/treatments`, {
    patientId: patients[0].id,
    cdtCode: 'D0120',
    description: 'Periodic oral evaluation',
    priceCents: 100000, // ₱1,000
  }, cookie);

  const tx2 = await post(`/dental/visits/${visit0.id}/treatments`, {
    patientId: patients[0].id,
    cdtCode: 'D1110',
    description: 'Adult prophylaxis (cleaning)',
    priceCents: 250000, // ₱2,500
    toothNumber: undefined,
  }, cookie);

  const tx3 = await post(`/dental/visits/${visit0.id}/treatments`, {
    patientId: patients[0].id,
    cdtCode: 'D2391',
    description: 'Posterior resin composite — 1 surface',
    priceCents: 400000, // ₱4,000
    toothNumber: 36,
    surfaces: ['occlusal'],
    conditionCode: 'K02.1',
  }, cookie);

  // Mark treatments performed
  for (const txId of [tx1.id, tx2.id, tx3.id]) {
    await patch(`/dental/visits/${visit0.id}/treatments/${txId}`, { status: 'performed' }, cookie);
  }

  // Complete the visit
  await patch(`/dental/visits/${visit0.id}`, { status: 'completed' }, cookie);
  log(`✓ Visit completed (3 treatments: exam, cleaning, composite)`);

  // Create invoice
  const invoice = await post('/dental/billing/invoices', {
    visitId: visit0.id,
    patientId: patients[0].id,
    branchId: branch.id,
    dentistMemberId: ownerMember.id,
  }, cookie);
  log(`✓ Invoice ${invoice.invoiceNumber}: ₱${(invoice.totalCents / 100).toLocaleString()}`);

  // Issue it
  const issuedInvoice = await post(`/dental/billing/invoices/${invoice.id}/issue`, {}, cookie);
  log(`✓ Invoice issued (status: ${issuedInvoice.status})`);

  // Record partial payment
  await post(`/dental/billing/invoices/${invoice.id}/payments`, {
    amountCents: 500000, // ₱5,000 partial
    method: 'cash',
    receiptNumber: 'OR-2026-001',
    recordedByMemberId: ownerMember.id,
  }, cookie);
  log(`✓ Partial payment recorded: ₱5,000 cash`);

  // ── 9. Active visit (Patient 1) ──────────────────────────────────────────
  section('9. Creating in-progress visit (Maria Santos)');

  const visit1 = await post('/dental/visits', {
    patientId: patients[1].id,
    branchId: branch.id,
    dentistMemberId: ownerMember.id,
    chiefComplaint: 'Teeth sensitivity — upper left',
  }, cookie);

  await patch(`/dental/visits/${visit1.id}`, { status: 'active' }, cookie);

  await post(`/dental/visits/${visit1.id}/treatments`, {
    patientId: patients[1].id,
    cdtCode: 'D0220',
    description: 'Periapical X-ray — upper left',
    priceCents: 80000, // ₱800
    toothNumber: 24,
  }, cookie);

  await post(`/dental/visits/${visit1.id}/treatments`, {
    patientId: patients[1].id,
    cdtCode: 'D2140',
    description: 'Amalgam restoration — 1 surface',
    priceCents: 350000, // ₱3,500
    toothNumber: 24,
    surfaces: ['mesial'],
    conditionCode: 'K02.9',
  }, cookie);

  log(`✓ Active visit with 2 diagnosed treatments`);

  // ── 10. Done ─────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║           Seed Complete! 🦷               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Login credentials:                      ║');
  console.log('║  Email:    demo@dentalemon.com           ║');
  console.log('║  Password: DemoClinic1!                  ║');
  console.log('║                                          ║');
  console.log('║  PIN screen:                             ║');
  console.log('║  Dr. Maria Reyes  →  1 2 3 4 5 6        ║');
  console.log('║  Ana Santos       →  6 5 4 3 2 1        ║');
  console.log('║                                          ║');
  console.log('║  App: http://localhost:3003              ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log('  Seeded data summary:');
  console.log(`  • 1 clinic:        Reyes Family Dental (Makati)`);
  console.log(`  • 2 staff members: dentist owner + staff assistant`);
  console.log(`  • 5 patients`);
  console.log(`  • 5 appointments:  3 today, 2 tomorrow`);
  console.log(`  • 1 completed visit + issued invoice (partial payment)`);
  console.log(`  • 1 active visit in progress\n`);
}

seed().catch(err => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
