import type { HandlerContext } from '@/types/app';
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
export async function updatePatient(ctx: HandlerContext) {
  // Get authenticated user (middleware guarantees user exists)
  const user = ctx.get('user') as User;
  
  // Extract patient ID from path (TypeSpec uses 'id')
  const patientId = (ctx.req.param('id') || ctx.req.param('patient')) as string;
  
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
  
  // Prepare update data — admin/staff can update any patient
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
  // Dental-specific fields
  if ((body as any).dentalHistorySummary !== undefined) {
    updateData.dentalHistorySummary = (body as any).dentalHistorySummary;
  }
  if ((body as any).needsFollowUp !== undefined) {
    updateData.needsFollowUp = (body as any).needsFollowUp;
  }
  if ((body as any).preferredBranchId !== undefined) {
    updateData.preferredBranchId = (body as any).preferredBranchId;
  }

  const isOwner = existingPatient.person === user.id;
  
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