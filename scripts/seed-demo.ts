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
 *
 * Idempotent: safe to run multiple times. Uses existing org/branch if found.
 */

const API = 'http://localhost:7213';

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`  ${msg}`); }
function section(title: string) { console.log(`\n▶ ${title}`); }

async function req(
  method: string,
  path: string,
  body: unknown | null,
  cookie: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== null ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

const post = (path: string, body: unknown, cookie: string) => req('POST', path, body, cookie);
const get  = (path: string, cookie: string) => req('GET', path, null, cookie);
const patch = (path: string, body: unknown, cookie: string) => req('PATCH', path, body, cookie);

function must<T>(result: { ok: boolean; status: number; data: T }, label: string): T {
  if (!result.ok) {
    throw new Error(`${label} → ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  }
  return result.data;
}

function getCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  return raw.split(',').map((c: string) => c.split(';')[0]).filter(Boolean).join('; ');
}

async function signUpOrIn(email: string, password: string, name: string) {
  // Try sign-up first
  const res = await fetch(`${API}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (res.ok || res.status === 200) {
    const body = await res.json() as any;
    return { cookie: getCookie(res), userId: body.user?.id ?? body.id, created: true };
  }

  // Already exists — sign in
  const res2 = await fetch(`${API}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res2.ok) {
    const text = await res2.text().catch(() => '');
    throw new Error(`Sign-in failed ${res2.status}: ${text.slice(0, 200)}`);
  }
  const body2 = await res2.json() as any;
  return { cookie: getCookie(res2), userId: body2.user?.id ?? body2.id, created: false };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║      Dentalemon Demo Seed Script         ║');
  console.log('╚══════════════════════════════════════════╝');

  // ── 1. User account ─────────────────────────────────────────────────────
  section('1. User account');
  const EMAIL = 'demo@dentalemon.com';
  const PASSWORD = 'DemoClinic1!';
  const { cookie, userId, created: userCreated } = await signUpOrIn(EMAIL, PASSWORD, 'Dr. Maria Reyes');
  log(`${userCreated ? '✓ Created' : '→ Existing'} user: ${EMAIL}`);

  // ── 2. Person profile ───────────────────────────────────────────────────
  section('2. Person profile');
  await post('/persons', { firstName: 'Maria', lastName: 'Reyes', gender: 'female', timezone: 'Asia/Manila' }, cookie);
  log('✓ Person profile (ok or already exists)');

  // ── 3. Org + Branch — use context endpoint if available, else create ────
  section('3. Clinic setup');

  let org: any, branch: any, ownerMember: any;

  // Try the /dental/org/context endpoint (available after latest server restart)
  const ctxResult = await get('/dental/org/context', cookie);
  if (ctxResult.ok && ctxResult.data?.branch?.id) {
    org = ctxResult.data.org;
    branch = ctxResult.data.branch;
    ownerMember = ctxResult.data.member;
    log(`→ Existing clinic: ${org.name} / ${branch.name}`);
  } else {
    // Create fresh
    const orgResult = await post('/dental/organizations', {
      name: 'Reyes Family Dental',
      tier: 'clinic',
      countryCode: 'PH',
    }, cookie);
    if (!orgResult.ok) throw new Error(`Create org → ${orgResult.status}: ${JSON.stringify(orgResult.data).slice(0, 200)}`);
    org = orgResult.data;
    log(`✓ Created clinic: ${org.name} (${org.id})`);

    const branchResult = await post(`/dental/organizations/${org.id}/branches`, {
      name: 'Main Clinic',
      timezone: 'Asia/Manila',
      address: '123 Bonifacio Ave',
      city: 'Makati',
      phone: '+63 2 8123 4567',
    }, cookie);
    if (!branchResult.ok) throw new Error(`Create branch → ${branchResult.status}`);
    branch = branchResult.data;
    log(`✓ Created branch: ${branch.name} (${branch.id})`);
  }

  // ── 4. Staff members ────────────────────────────────────────────────────
  section('4. Staff members');

  if (!ownerMember) {
    const r = await post(`/dental/organizations/${org.id}/branches/${branch.id}/members`, {
      displayName: 'Dr. Maria Reyes',
      role: 'dentist_owner',
      personId: userId,
    }, cookie);
    if (!r.ok) throw new Error(`Create owner member → ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    ownerMember = r.data;
    log(`✓ Created: ${ownerMember.displayName} (dentist_owner)`);
  } else {
    log(`→ Existing: ${ownerMember.displayName} (${ownerMember.role})`);
  }

  // Always (re)set PIN — idempotent
  const pinResult = await post(
    `/dental/organizations/${org.id}/branches/${branch.id}/members/${ownerMember.id}/set-pin`,
    { pin: '123456' },
    cookie,
  );
  if (pinResult.ok) log(`  PIN set: 1 2 3 4 5 6`);

  // Staff assistant — always try, ignore duplicate errors
  const staffResult = await post(`/dental/organizations/${org.id}/branches/${branch.id}/members`, {
    displayName: 'Ana Santos',
    role: 'staff_full',
  }, cookie);
  if (staffResult.ok) {
    const staffMember = staffResult.data;
    log(`✓ Created: ${staffMember.displayName} (staff_full)`);
    await post(
      `/dental/organizations/${org.id}/branches/${branch.id}/members/${staffMember.id}/set-pin`,
      { pin: '654321' },
      cookie,
    );
    log(`  PIN set: 6 5 4 3 2 1`);
  } else {
    log(`→ Staff assistant already exists`);
  }

  // ── 5. Patients ─────────────────────────────────────────────────────────
  section('5. Patients');

  const patientsData = [
    { displayName: 'Juan dela Cruz',  birthDate: '1985-03-15', gender: 'male' },
    { displayName: 'Maria Santos',    birthDate: '1992-07-22', gender: 'female' },
    { displayName: 'Roberto Lim',     birthDate: '1978-11-08', gender: 'male' },
    { displayName: 'Elena Garcia',    birthDate: '2010-05-30', gender: 'female' },
    { displayName: 'Carlos Mendoza',  birthDate: '1965-01-19', gender: 'male' },
  ];

  const patients: any[] = [];
  for (const p of patientsData) {
    // Try creating the patient
    const r = await post('/dental/patients', { ...p, dateOfBirth: p.birthDate, consentGiven: true, branchId: branch.id }, cookie);
    if (r.ok) {
      patients.push({ ...r.data, displayName: p.displayName });
      log(`✓ ${p.displayName}`);
    } else if (r.status === 400 || r.status === 409) {
      // Already exists — fetch by branchId and find matching name
      const listR = await get(`/dental/patients?branchId=${branch.id}`, cookie);
      if (listR.ok) {
        const existing = (listR.data?.patients ?? listR.data ?? []).find(
          (pt: any) => (pt.displayName ?? pt.name ?? '') === p.displayName
        );
        if (existing) {
          patients.push({ ...existing, displayName: p.displayName });
          log(`→ Existing: ${p.displayName}`);
          continue;
        }
      }
      log(`⚠ Skipped ${p.displayName} (${r.status})`);
    } else {
      log(`⚠ Skipped ${p.displayName} (${r.status})`);
    }
  }

  if (!patients.length) throw new Error('No patients found — cannot seed visits');

  // ── 6. Appointments ──────────────────────────────────────────────────────
  section('6. Appointments (today + tomorrow)');

  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const atHour = (base: Date, h: number, m = 0) => {
    const d = new Date(base); d.setHours(h, m, 0, 0); return d.toISOString();
  };

  const apptDefs = [
    { patient: patients[0], at: atHour(today, 9),     dur: 60,  proc: 'Comprehensive Exam + X-rays' },
    { patient: patients[1], at: atHour(today, 10, 30), dur: 30, proc: 'Teeth Cleaning' },
    { patient: patients[2] ?? patients[0], at: atHour(today, 14), dur: 90, proc: 'Crown Preparation' },
    { patient: patients[3] ?? patients[0], at: atHour(tomorrow, 9), dur: 45, proc: 'Filling (Upper Molar)' },
    { patient: patients[4] ?? patients[0], at: atHour(tomorrow, 11), dur: 60, proc: 'Root Canal Consultation' },
  ];

  for (const a of apptDefs) {
    const r = await post('/dental/appointments', {
      patientId: a.patient.id,
      dentistMemberId: ownerMember.id,
      branchId: branch.id,
      scheduledAt: a.at,
      durationMinutes: a.dur,
      procedureType: a.proc,
    }, cookie);
    if (r.ok) log(`✓ ${a.patient.displayName} — ${a.proc}`);
    else log(`⚠ Appt failed (${r.status})`);
  }

  // ── 7. Completed visit + invoice ─────────────────────────────────────────
  section('7. Completed visit + invoice (Juan dela Cruz)');

  const p0 = patients[0];
  const visitR = must(await post('/dental/visits', {
    patientId: p0.id,
    branchId: branch.id,
    dentistMemberId: ownerMember.id,
    chiefComplaint: 'Routine checkup and cleaning',
  }, cookie), 'create visit');

  await patch(`/dental/visits/${visitR.id}`, { status: 'active' }, cookie);

  const treatments = [
    { cdtCode: 'D0120', description: 'Periodic oral evaluation',            priceCents: 100000 },
    { cdtCode: 'D1110', description: 'Adult prophylaxis (cleaning)',         priceCents: 250000 },
    { cdtCode: 'D2391', description: 'Resin composite — 1 surface',         priceCents: 400000, toothNumber: 36, surfaces: ['occlusal'], conditionCode: 'K02.1' },
  ];

  for (const t of treatments) {
    const r = must(await post(`/dental/visits/${visitR.id}/treatments`, { visitId: visitR.id, patientId: p0.id, ...t }, cookie), 'create treatment');
    await patch(`/dental/visits/${visitR.id}/treatments/${r.id}`, { status: 'performed' }, cookie);
  }

  await patch(`/dental/visits/${visitR.id}`, { status: 'completed' }, cookie);
  log(`✓ Visit completed (3 treatments)`);

  const invoiceR = await post('/dental/billing/invoices', {
    visitId: visitR.id,
    patientId: p0.id,
    branchId: branch.id,
    dentistMemberId: ownerMember.id,
  }, cookie);

  if (invoiceR.ok) {
    const invoice = invoiceR.data;
    await post(`/dental/billing/invoices/${invoice.id}/issue`, {}, cookie);
    await post(`/dental/billing/invoices/${invoice.id}/payments`, {
      amountCents: 500000,
      method: 'cash',
      receiptNumber: 'OR-2026-001',
      recordedByMemberId: ownerMember.id,
    }, cookie);
    log(`✓ Invoice ${invoice.invoiceNumber}: ₱${(invoice.totalCents / 100).toLocaleString()} — issued, ₱5,000 paid`);
  } else {
    log(`⚠ Invoice creation failed (${invoiceR.status}) — visit data still saved`);
  }

  // ── 8. Active visit ───────────────────────────────────────────────────────
  section('8. In-progress visit (Maria Santos)');

  if (patients[1]) {
    const p1 = patients[1];
    const v1R = must(await post('/dental/visits', {
      patientId: p1.id,
      branchId: branch.id,
      dentistMemberId: ownerMember.id,
      chiefComplaint: 'Teeth sensitivity — upper left',
    }, cookie), 'create visit 2');

    await patch(`/dental/visits/${v1R.id}`, { status: 'active' }, cookie);

    await post(`/dental/visits/${v1R.id}/treatments`, {
      visitId: v1R.id, patientId: p1.id, cdtCode: 'D0220', description: 'Periapical X-ray', priceCents: 80000, toothNumber: 24,
    }, cookie);
    await post(`/dental/visits/${v1R.id}/treatments`, {
      visitId: v1R.id, patientId: p1.id, cdtCode: 'D2140', description: 'Amalgam restoration — 1 surface', priceCents: 350000,
      toothNumber: 24, surfaces: ['mesial'], conditionCode: 'K02.9',
    }, cookie);

    log(`✓ Active visit with 2 diagnosed treatments`);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
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
  console.log('  • 1 clinic: Reyes Family Dental (Makati)');
  console.log('  • 2 staff members');
  console.log(`  • ${patients.length} patients`);
  console.log('  • 5 appointments: 3 today, 2 tomorrow');
  console.log('  • 1 completed visit + issued invoice (partial payment)');
  console.log('  • 1 active visit in progress\n');
}

seed().catch(err => {
  console.error('\n✗ Seed failed:', err.message);
  process.exit(1);
});
