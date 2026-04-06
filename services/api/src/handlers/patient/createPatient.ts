import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { 
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { PatientRepository } from './repos/patient.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { type PatientCreateRequest, type PatientWithPerson } from './repos/patient.schema';
import { addUserRole } from '@/utils/auth';
import type { User, Session } from '@/types/auth';
import type { AuthInstance } from '@/utils/auth';

/**
 * createPatient
 * 
 * Path: POST /patients
 * OperationId: createPatient
 * Security: bearerAuth with role ["owner"]
 */
export async function createPatient(ctx: Context) {
  // Get authenticated user (middleware guarantees user exists)
  const user = ctx.get('user') as User;
  
  // Owner role - user can only create patient profile for themselves
  if (!user.id) {
    throw new BusinessLogicError('User must have a person profile before creating patient profile', 'MISSING_PERSON_PROFILE');
  }
  
  // Get validated request body
  const body = ctx.req.valid('json') as PatientCreateRequest;
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repositories
  const patientRepo = new PatientRepository(db, logger);
  const personRepo = new PersonRepository(db, logger);
  
  // Ensure person exists for the user (create if needed)
  const person = await personRepo.ensurePersonForUser(user, body.person);
  
  // Check if patient profile already exists for this person
  const existingPatient = await patientRepo.findByPersonId(person.id);
  if (existingPatient) {
    throw new BusinessLogicError('Patient profile already exists for this person', 'PATIENT_EXISTS');
  }
  
  // Create patient record
  const patient = await patientRepo.createOne({
    person: person.id,
    primaryProvider: body.primaryProvider || null,
    primaryPharmacy: body.primaryPharmacy || null
  });

  // Add patient role to user after creating profile
  await addUserRole(db, user, 'patient');

  // Invalidate current session to force re-authentication with updated roles
  // User will need to sign in again to get fresh JWT with patient role
  const session = ctx.get('session') as Session;
  const auth = ctx.get('auth') as AuthInstance;
  if (session?.token && auth) {
    try {
      await auth.api.revokeSession({
        headers: ctx.req.raw.headers
      });
      logger?.info({ userId: user.id }, 'Session invalidated after patient role assignment');
    } catch (error) {
      // Log but don't fail the request if session revocation fails
      logger?.warn({ error, userId: user.id }, 'Failed to revoke session after role assignment');
    }
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
