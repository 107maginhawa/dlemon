import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { PatientRepository } from './repos/patient.repo';
import { type PatientUpdateRequest } from './repos/patient.schema';
import type { User } from '@/types/auth';

/**
 * updatePatient
 * 
 * Path: PUT /patients/{patientId}
 * OperationId: updatePatient
 * Security: bearerAuth with role ["owner"]
 */
export async function updatePatient(ctx: Context) {
  // Get authenticated user (middleware guarantees user exists)
  const user = ctx.get('user') as User;
  
  // Extract patient ID from path
  const patientId = ctx.req.param('patient');
  
  // Extract validated request body
  const body = ctx.req.valid('json') as PatientUpdateRequest;
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repository
  const patientRepo = new PatientRepository(db, logger);
  
  // Retrieve existing patient to verify ownership
  const existingPatient = await patientRepo.findOneById(patientId);
  if (!existingPatient) {
    throw new NotFoundError('Patient not found', {
      resourceType: 'patient',
      resource: patientId,
      suggestions: ['Check patient ID format', 'Verify patient exists']
    });
  }
  
  // Check authorization - owner can only update their own record
  const personId = typeof existingPatient.person === 'string' ? existingPatient.person : existingPatient.person.id;
  const isOwner = personId === user.id;

  if (!isOwner) {
    throw new ForbiddenError('You can only update your own patient profile');
  }
  
  // Prepare update data
  const updateData: any = {
    updatedBy: user.id
  };
  
  // Only update fields that are provided
  if (body.primaryProvider !== undefined) {
    updateData.primaryProvider = body.primaryProvider;
  }
  if (body.primaryPharmacy !== undefined) {
    updateData.primaryPharmacy = body.primaryPharmacy;
  }
  
  // Update patient record
  const updatedPatient = await patientRepo.updateOneById(patientId, updateData);
  
  // Log audit trail
  logger?.info({
    patientId: updatedPatient.id,
    personId: updatedPatient.person,
    action: 'update',
    updatedBy: user.id,
    isOwner,
    updatedFields: Object.keys(updateData).filter(key => key !== 'updatedBy'),
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Patient profile updated');
  
  // Return updated patient without expanded person data
  return ctx.json(updatedPatient, 200);
}