import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { PatientRepository } from './repos/patient.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { addUserRole } from '@/utils/auth';
import type { User } from '@/types/auth';

/**
 * createPatient
 * 
 * Path: POST /patients
 * OperationId: createPatient
 * Security: bearerAuth with role ["owner"]
 */
export async function createPatient(ctx: HandlerContext) {
  // Get authenticated user (middleware guarantees user exists)
  const user = ctx.get('user') as User;
  
  // Owner role - user can only create patient profile for themselves
  if (!user.id) {
    throw new BusinessLogicError('User must have a person profile before creating patient profile', 'MISSING_PERSON_PROFILE');
  }
  
  // Get validated request body (FHIR-aligned CreatePatientRequest)
  const body = ctx.req.valid('json') as {
    name?: Array<{ use?: string; family?: string; given?: string[] }>;
    birthDate?: string;
    gender?: string;
    preferredBranchId?: string;
    dentalHistorySummary?: string;
    primaryProvider?: any;
    primaryPharmacy?: any;
  };

  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Instantiate repositories
  const patientRepo = new PatientRepository(db, logger);
  const personRepo = new PersonRepository(db, logger);

  // Map FHIR name to person fields
  const officialName = body.name?.[0];
  const personData = officialName ? {
    firstName: officialName.given?.[0] ?? 'Unknown',
    lastName: officialName.family,
    dateOfBirth: body.birthDate,
    gender: body.gender as any,
  } : undefined;

  // Ensure person exists for the user (create if needed)
  const person = await personRepo.ensurePersonForUser(user, personData);

  // Check if patient profile already exists for this person
  const existingPatient = await patientRepo.findByPersonId(person.id);
  if (existingPatient) {
    throw new BusinessLogicError('Patient profile already exists for this person', 'PATIENT_EXISTS');
  }

  // Create patient record with dental fields
  const patient = await patientRepo.createOne({
    person: person.id,
    primaryProvider: body.primaryProvider || null,
    primaryPharmacy: body.primaryPharmacy || null,
    ...(body.preferredBranchId ? { preferredBranchId: body.preferredBranchId } : {}),
    ...(body.dentalHistorySummary ? { dentalHistorySummary: body.dentalHistorySummary } : {}),
  });

  // Assign patient role for self-registration (skip for admin/staff/clinician)
  // Role takes effect on next session creation — no session revocation needed
  const staffRoles = ['admin', 'clinician', 'registrar', 'support'];
  const userRole = (user as any).role || 'user';
  const isStaffCreation = staffRoles.some(r =>
    userRole.split(',').map((s: string) => s.trim()).includes(r)
  );

  if (!isStaffCreation) {
    await addUserRole(db, user, 'patient');
  }

  // Log audit trail
  logger?.info({
    patientId: patient.id,
    personId: person.id,
    action: 'create',
    createdBy: user.id,
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Patient profile created');
  
  // Return patient with expanded person data (always expand on create)
  const response = {
    ...patient,
    person: person.id // Return UUID reference, not expanded object
  };
  
  return ctx.json(response, 201);
}
