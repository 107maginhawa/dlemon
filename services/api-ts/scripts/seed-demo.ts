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
import { dentalPatientContacts } from '@/handlers/dental-patient/repos/patient-contact.schema';
import { eq } from 'drizzle-orm';

// Seed data modules
import {
  ORG_ID, BRANCH_ID, OWNER_PERSON_ID,
  DR_REYES_MEMBERSHIP_ID, ANA_SANTOS_MEMBERSHIP_ID,
  PERSON_JUAN_ID, PERSON_ROSA_ID, PERSON_CARLOS_ID, PERSON_LIZA_ID, PERSON_BEN_ID,
  PERSON_SOFIA_ID,
  PERSON_PEPE_ID, PERSON_MIA_ID, PERSON_RICO_ID, PERSON_ABBY_ID, PERSON_MARCO_ID,
  PERSON_CELIA_ID, PERSON_NENA_ID, PERSON_LUKE_ID, PERSON_ED_ID, PERSON_TINA_ID,
  PERSON_PHIL_ID, PERSON_CINDY_ID, PERSON_JEROME_ID, PERSON_GINA_ID,
  PATIENT_JUAN_ID, PATIENT_ROSA_ID, PATIENT_CARLOS_ID, PATIENT_LIZA_ID, PATIENT_BEN_ID,
  PATIENT_SOFIA_ID, CONTACT_SOFIA_GUARDIAN_ID,
  PATIENT_PEPE_ID, PATIENT_MIA_ID, PATIENT_RICO_ID, PATIENT_ABBY_ID, PATIENT_MARCO_ID,
  PATIENT_CELIA_ID, PATIENT_NENA_ID, PATIENT_LUKE_ID, PATIENT_ED_ID, PATIENT_TINA_ID,
  PATIENT_PHIL_ID, PATIENT_CINDY_ID, PATIENT_JEROME_ID, PATIENT_GINA_ID,
  CONTACT_LUKE_GUARDIAN_ID,
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
    // Original 6 patients
    { personId: PERSON_JUAN_ID,   patientId: PATIENT_JUAN_ID,   firstName: 'Juan',   lastName: 'dela Cruz',  dateOfBirth: '1985-03-15', gender: 'male'   as const, status: 'active'   as const },
    { personId: PERSON_ROSA_ID,   patientId: PATIENT_ROSA_ID,   firstName: 'Rosa',   lastName: 'Reyes',      dateOfBirth: '1992-07-22', gender: 'female' as const, status: 'active'   as const },
    { personId: PERSON_CARLOS_ID, patientId: PATIENT_CARLOS_ID, firstName: 'Carlos', lastName: 'Santos',     dateOfBirth: '1978-11-08', gender: 'male'   as const, status: 'active'   as const },
    { personId: PERSON_LIZA_ID,   patientId: PATIENT_LIZA_ID,   firstName: 'Liza',   lastName: 'Manalang',   dateOfBirth: '2001-04-30', gender: 'female' as const, status: 'active'   as const },
    { personId: PERSON_BEN_ID,    patientId: PATIENT_BEN_ID,    firstName: 'Ben',    lastName: 'Aquino',     dateOfBirth: '1965-09-12', gender: 'male'   as const, status: 'active'   as const },
    { personId: PERSON_SOFIA_ID,  patientId: PATIENT_SOFIA_ID,  firstName: 'Sofia',  lastName: 'Dela Cruz',  dateOfBirth: '2018-06-10', gender: 'female' as const, status: 'active'   as const },
    // Extended patients — 14 new scenario-coverage patients
    { personId: PERSON_PEPE_ID,   patientId: PATIENT_PEPE_ID,   firstName: 'Pepe',   lastName: 'Cruz',       dateOfBirth: '1990-02-14', gender: 'male'   as const, status: 'active'   as const }, // allergy: penicillin
    { personId: PERSON_MIA_ID,    patientId: PATIENT_MIA_ID,    firstName: 'Mia',    lastName: 'Santos',     dateOfBirth: '1998-08-25', gender: 'female' as const, status: 'active'   as const }, // ortho case
    { personId: PERSON_RICO_ID,   patientId: PATIENT_RICO_ID,   firstName: 'Rico',   lastName: 'dela Torre', dateOfBirth: '1995-11-30', gender: 'male'   as const, status: 'active'   as const }, // new patient first visit
    { personId: PERSON_ABBY_ID,   patientId: PATIENT_ABBY_ID,   firstName: 'Abby',   lastName: 'Tan',        dateOfBirth: '1988-05-17', gender: 'female' as const, status: 'active'   as const }, // recall overdue
    { personId: PERSON_MARCO_ID,  patientId: PATIENT_MARCO_ID,  firstName: 'Marco',  lastName: 'Lopez',      dateOfBirth: '1952-03-02', gender: 'male'   as const, status: 'active'   as const }, // geriatric 70+
    { personId: PERSON_CELIA_ID,  patientId: PATIENT_CELIA_ID,  firstName: 'Celia',  lastName: 'Ramos',      dateOfBirth: '1975-09-20', gender: 'female' as const, status: 'active'   as const }, // has insurance
    { personId: PERSON_NENA_ID,   patientId: PATIENT_NENA_ID,   firstName: 'Nena',   lastName: 'Garcia',     dateOfBirth: '1984-01-08', gender: 'female' as const, status: 'active'   as const }, // special medical notes
    { personId: PERSON_LUKE_ID,   patientId: PATIENT_LUKE_ID,   firstName: 'Luke',   lastName: 'Rivera',     dateOfBirth: '2017-04-12', gender: 'male'   as const, status: 'active'   as const }, // pediatric 8y
    { personId: PERSON_ED_ID,     patientId: PATIENT_ED_ID,     firstName: 'Ed',     lastName: 'Torres',     dateOfBirth: '1970-07-19', gender: 'male'   as const, status: 'active'   as const }, // ongoing prescriptions
    { personId: PERSON_TINA_ID,   patientId: PATIENT_TINA_ID,   firstName: 'Tina',   lastName: 'Bautista',   dateOfBirth: '1980-12-03', gender: 'female' as const, status: 'active'   as const }, // extensive treatment history
    { personId: PERSON_PHIL_ID,   patientId: PATIENT_PHIL_ID,   firstName: 'Phil',   lastName: 'Fernan',     dateOfBirth: '2000-06-15', gender: 'male'   as const, status: 'active'   as const }, // offline-created (sync scenario)
    { personId: PERSON_CINDY_ID,  patientId: PATIENT_CINDY_ID,  firstName: 'Cindy',  lastName: 'Ocampo',     dateOfBirth: '1968-10-29', gender: 'female' as const, status: 'active'   as const }, // complex medical history
    { personId: PERSON_JEROME_ID, patientId: PATIENT_JEROME_ID, firstName: 'Jerome', lastName: 'Medrano',    dateOfBirth: '1993-03-11', gender: 'male'   as const, status: 'inactive' as const }, // inactive patient
    { personId: PERSON_GINA_ID,   patientId: PATIENT_GINA_ID,   firstName: 'Gina',   lastName: 'Villanueva', dateOfBirth: '1977-08-04', gender: 'female' as const, status: 'active'   as const }, // payment plan
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
      status: p.status,
    }).onConflictDoNothing();

    console.log(`   ✅ Patient: ${p.firstName} ${p.lastName}`);
  }

  // ------------------------------------------------------------------
  // 6b. Guardian contact for Sofia (minor patient — PAT-BR-002)
  // ------------------------------------------------------------------
  console.log('5b. Creating guardian contact for Sofia...');
  await db.insert(dentalPatientContacts).values({
    id: CONTACT_SOFIA_GUARDIAN_ID,
    patientId: PATIENT_SOFIA_ID,
    name: 'Jose Dela Cruz',
    relationship: 'parent',
    phone: '+639171234567',
    isGuardian: true,
    isEmergencyContact: true,
    notes: 'Primary guardian — father',
  }).onConflictDoNothing();
  console.log('   ✅ Guardian: Jose Dela Cruz (parent of Sofia)');

  // Guardian for Luke Rivera (pediatric patient)
  await db.insert(dentalPatientContacts).values({
    id: CONTACT_LUKE_GUARDIAN_ID,
    patientId: PATIENT_LUKE_ID,
    name: 'Alma Rivera',
    relationship: 'parent',
    phone: '+639289876543',
    isGuardian: true,
    isEmergencyContact: true,
    notes: 'Primary guardian — mother',
  }).onConflictDoNothing();
  console.log('   ✅ Guardian: Alma Rivera (parent of Luke)');

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
