import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { 
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { PatientRepository } from './repos/patient.repo';
import { removeUserRole } from '@/utils/auth';
import type { User } from '@/types/auth';

/**
 * deletePatient
 * 
 * Path: DELETE /patients/{patientId}
 * OperationId: deletePatient
 * Security: bearerAuth with role ["owner"]
 */
export async function deletePatient(ctx: Context) {
  // Get authenticated user (middleware guarantees user exists)
  const user = ctx.get('user') as User;
  
  // Extract validated parameters
  const params = ctx.req.valid('param') as { patient: string };
  const patientId = params.patient;
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repository
  const repo = new PatientRepository(db, logger);
  
  // Retrieve existing patient to verify ownership and current status
  const existingPatient = await repo.findOneById(patientId);
  if (!existingPatient) {
    throw new NotFoundError('Patient not found', {
      resourceType: 'patient',
      resource: patientId,
      suggestions: ['Check patient ID format', 'Verify patient exists in system', 'Complete profile setup']
    });
  }
  
  // Check authorization - owner can only delete their own record
  const personId = typeof existingPatient.person === 'string' ? existingPatient.person : existingPatient.person.id;
  const isOwner = personId === user.id;

  if (!isOwner) {
    throw new ForbiddenError('You can only delete your own patient profile');
  }
  
  // Perform hard delete (patient profile only - person record preserved)
  await repo.deleteOneById(patientId, user.id);

  // Remove patient role from user
  await removeUserRole(db, user, 'patient');
  
  // Log audit trail
  logger?.info({
    patientId,
    personId,
    action: 'delete',
    deletedBy: user.id,
    isOwner,
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Patient profile deleted');
  
  // Return 204 No Content as per API specification
  return ctx.body(null, 204);
}
