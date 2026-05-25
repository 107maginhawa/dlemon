/**
 * Demo seed script — creates demo org, branch, staff, and patients
 *
 * Usage: bun scripts/seed-demo.ts
 *
 * Credentials after seed:
 *   Email:    demo@dentalemon.com
 *   Password: DemoClinic1!
 *   Dr. Reyes PIN: 123456
 *   Ana Santos PIN: 654321
 */

import { createDatabase } from '@/core/database';
import { OrganizationRepository } from '@/handlers/dental-org/repos/organization.repo';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { eq } from 'drizzle-orm';

// Seed data modules
import {
  ORG_ID, BRANCH_ID, OWNER_PERSON_ID,
  DR_REYES_MEMBERSHIP_ID, ANA_SANTOS_MEMBERSHIP_ID,
  PERSON_JUAN_ID, PERSON_ROSA_ID, PERSON_CARLOS_ID, PERSON_LIZA_ID, PERSON_BEN_ID,
  PATIENT_JUAN_ID, PATIENT_ROSA_ID, PATIENT_CARLOS_ID, PATIENT_LIZA_ID, PATIENT_BEN_ID,
} from './seed-data/ids';
import { seedTreatmentTemplates } from './seed-data/treatment-templates';
import { seedMedicalHistory } from './seed-data/medical-history';
import { seedAppointments } from './seed-data/appointments';
import { seedVisits } from './seed-data/visits';
import { seedBilling } from './seed-data/billing';
import { seedClinical } from './seed-data/clinical';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:password@localhost:5432/monobase';

const db = createDatabase({ url: DATABASE_URL });

// Fixed IDs imported from seed-data/ids.ts

async function seed() {
  console.log('🦷 Seeding Dentalemon demo data...\n');

  // ------------------------------------------------------------------
  // 1. Create the owner person (Better-Auth user)
  // ------------------------------------------------------------------
  console.log('1. Creating demo user account...');

  // Check if Better-Auth user table exists and seed via API call
  // Better-Auth manages its own user table — use the sign-up endpoint
  const signupRes = await fetch('http://localhost:7213/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'demo@dentalemon.com',
      password: 'DemoClinic1!',
      name: 'Dr. Maria Reyes',
    }),
  });

  let ownerId: string;

  if (signupRes.ok) {
    const signup = await signupRes.json() as any;
    ownerId = signup.user?.id ?? signup.id;
    console.log(`   ✅ Created user: demo@dentalemon.com (id: ${ownerId})`);
  } else if (signupRes.status === 422 || signupRes.status === 409) {
    // Already exists — sign in to get the ID
    const signinRes = await fetch('http://localhost:7213/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@dentalemon.com',
        password: 'DemoClinic1!',
      }),
    });
    const signin = await signinRes.json() as any;
    ownerId = signin.user?.id ?? signin.id;
    console.log(`   ℹ️  User already exists (id: ${ownerId})`);
  } else {
    const err = await signupRes.text();
    throw new Error(`Failed to create user: ${signupRes.status} ${err}`);
  }

  if (!ownerId!) throw new Error('Could not determine owner person ID');

  // ------------------------------------------------------------------
  // 2. Ensure person row exists (Better-Auth may not create it)
  // ------------------------------------------------------------------
  const existingPerson = await db.select().from(persons).where(eq(persons.id, ownerId));
  if (existingPerson.length === 0) {
    await db.insert(persons).values({
      id: ownerId,
      firstName: 'Maria',
      lastName: 'Reyes',
      contactInfo: { email: 'demo@dentalemon.com' },
    }).onConflictDoNothing();
  }

  // ------------------------------------------------------------------
  // 3. Create organization
  // ------------------------------------------------------------------
  console.log('2. Creating dental organization...');
  const orgRepo = new OrganizationRepository(db);
  const existingOrg = await orgRepo.findOneById(ORG_ID);
  if (!existingOrg) {
    await orgRepo.createOne({
      id: ORG_ID,
      name: 'Reyes Dental Clinic',
      tier: 'solo',
      ownerPersonId: ownerId,
      countryCode: 'PH',
      active: true,
    });
    console.log('   ✅ Created organization: Reyes Dental Clinic');
  } else {
    console.log('   ℹ️  Organization already exists');
  }

  // ------------------------------------------------------------------
  // 4. Create branch
  // ------------------------------------------------------------------
  console.log('3. Creating branch...');
  const branchRepo = new BranchRepository(db);
  const existingBranch = await branchRepo.findOneById(BRANCH_ID);
  if (!existingBranch) {
    await branchRepo.createOne({
      id: BRANCH_ID,
      organizationId: ORG_ID,
      name: 'Main Branch — Makati',
      address: '123 Ayala Ave, Makati City',
      timezone: 'Asia/Manila',
      phone: '+63 2 8888 1234',
      active: true,
    });
    console.log('   ✅ Created branch: Main Branch — Makati');
  } else {
    console.log('   ℹ️  Branch already exists');
  }

  // ------------------------------------------------------------------
  // 5. Create memberships (staff)
  // ------------------------------------------------------------------
  console.log('4. Creating staff memberships...');
  const pinHashReyes = await Bun.password.hash('123456');
  const pinHashSantos = await Bun.password.hash('654321');

  // Dr. Reyes — dentist_owner (linked to cloud account via personId)
  // Use fixed ID for reproducibility
  await db.insert(dentalMemberships).values({
    id: DR_REYES_MEMBERSHIP_ID,
    branchId: BRANCH_ID,
    personId: ownerId,
    displayName: 'Dr. Maria Reyes',
    role: 'dentist_owner',
    status: 'active',
    pinHash: pinHashReyes,
    pinFailedAttempts: 0,
  }).onConflictDoNothing();
  console.log('   ✅ Dr. Maria Reyes (dentist_owner, PIN: 123456)');

  // Ana Santos — staff_full (PIN only, no cloud account)
  await db.insert(dentalMemberships).values({
    id: ANA_SANTOS_MEMBERSHIP_ID,
    branchId: BRANCH_ID,
    displayName: 'Ana Santos',
    role: 'staff_full',
    status: 'active',
    pinHash: pinHashSantos,
    pinFailedAttempts: 0,
  }).onConflictDoNothing();
  console.log('   ✅ Ana Santos (staff_full, PIN: 654321)');

  // ------------------------------------------------------------------
  // 6. Create demo patients
  // ------------------------------------------------------------------
  console.log('5. Creating demo patients...');

  const demoPatients = [
    { personId: PERSON_JUAN_ID, patientId: PATIENT_JUAN_ID, firstName: 'Juan', lastName: 'dela Cruz', dateOfBirth: '1985-03-15', gender: 'male' as const },
    { personId: PERSON_ROSA_ID, patientId: PATIENT_ROSA_ID, firstName: 'Rosa', lastName: 'Reyes', dateOfBirth: '1992-07-22', gender: 'female' as const },
    { personId: PERSON_CARLOS_ID, patientId: PATIENT_CARLOS_ID, firstName: 'Carlos', lastName: 'Santos', dateOfBirth: '1978-11-08', gender: 'male' as const },
    { personId: PERSON_LIZA_ID, patientId: PATIENT_LIZA_ID, firstName: 'Liza', lastName: 'Manalang', dateOfBirth: '2001-04-30', gender: 'female' as const },
    { personId: PERSON_BEN_ID, patientId: PATIENT_BEN_ID, firstName: 'Ben', lastName: 'Aquino', dateOfBirth: '1965-09-12', gender: 'male' as const },
  ];

  for (const p of demoPatients) {
    // Create person with fixed ID
    await db.insert(persons).values({
      id: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender,
    }).onConflictDoNothing();

    // Create patient record with fixed ID
    await db.insert(patients).values({
      id: p.patientId,
      person: p.personId,
      preferredBranchId: BRANCH_ID,
      status: 'active',
    }).onConflictDoNothing();

    console.log(`   ✅ Patient: ${p.firstName} ${p.lastName}`);
  }

  // ------------------------------------------------------------------
  // 7. Clinical seed data (modular)
  // ------------------------------------------------------------------
  console.log('6. Seeding clinical data...');
  await seedTreatmentTemplates(db);
  await seedMedicalHistory(db);
  await seedVisits(db);
  await seedAppointments(db);
  await seedBilling(db);
  await seedClinical(db);

  // ------------------------------------------------------------------
  // Done
  // ------------------------------------------------------------------
  console.log('\n🎉 Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Frontend:  http://localhost:3003');
  console.log('  Email:     demo@dentalemon.com');
  console.log('  Password:  DemoClinic1!');
  console.log('  PIN (Dr. Reyes):    123456');
  console.log('  PIN (Ana Santos):   654321');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
