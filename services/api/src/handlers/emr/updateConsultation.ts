import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ForbiddenError,
  NotFoundError,
  BusinessLogicError
} from '@/core/errors';
import { ConsultationNoteRepository } from './repos/emr.repo';
import { ProviderRepository } from '../provider/repos/provider.repo';
import { type UpdateConsultationRequest } from './repos/emr.schema';

/**
 * updateConsultation
 *
 * Path: PATCH /emr/consultations/{id}
 * OperationId: updateConsultation
 * Security: bearerAuth with role ["provider"]
 *
 * Updates a consultation note (only draft status consultations can be updated)
 * Supports explicit null values for field clearing per TypeSpec
 */
export async function updateConsultation(ctx: Context) {
  // Get authenticated user
  const user = ctx.get('user') as User;

  // Get consultation ID from path parameters
  const consultationId = ctx.req.param('consultation');
  if (!consultationId) {
    throw new NotFoundError('Consultation ID is required', {
      resourceType: 'consultation',
      resource: 'missing',
      suggestions: ['Check ID format', 'Verify resource exists']
    });
  }
  
  // Get validated request body
  const body = ctx.req.valid('json') as UpdateConsultationRequest;
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repositories
  const consultationRepo = new ConsultationNoteRepository(db, logger);
  const providerRepo = new ProviderRepository(db, logger);
  
  // Find consultation note
  const consultation = await consultationRepo.findOneById(consultationId);
  if (!consultation) {
    throw new NotFoundError(`Consultation ${consultationId} not found`, {
      resourceType: 'consultation',
      resource: consultationId,
      suggestions: ['Check consultation ID', 'Verify consultation exists', 'Check consultation status']
    });
  }
  
  // Verify provider owns this consultation
  const provider = await providerRepo.findByPersonId(user.id);
  if (!provider) {
    throw new BusinessLogicError('Provider profile not found for authenticated user', 'PROVIDER_NOT_FOUND');
  }
  
  if (consultation.provider !== provider.id) {
    throw new ForbiddenError('You can only update your own consultation notes');
  }
  
  // Only allow updates to draft consultations
  if (consultation.status !== 'draft') {
    throw new BusinessLogicError(
      `Cannot update consultation in ${consultation.status} status. Only draft consultations can be updated.`,
      'CONSULTATION_NOT_DRAFT'
    );
  }
  
  // Check if there are any fields to update
  const hasUpdates = Object.keys(body).length > 0;
  if (!hasUpdates) {
    throw new BusinessLogicError('No valid fields provided for update', 'NO_UPDATE_FIELDS');
  }

  // Update consultation note using updateWithNulls for explicit null support per TypeSpec
  const updatedConsultation = await consultationRepo.updateWithNulls(consultationId, body);
  
  // Log audit trail
  logger?.info({
    consultationId,
    providerId: provider.id,
    updatedFields: Object.keys(body),
    action: 'consultation_updated',
    updatedBy: user.id,
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Consultation note updated');
  
  return ctx.json(updatedConsultation, 200);
}
