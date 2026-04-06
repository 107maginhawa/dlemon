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

/**
 * finalizeConsultation
 *
 * Path: POST /emr/consultations/{id}/finalize
 * OperationId: finalizeConsultation
 * Security: bearerAuth with role ["provider"]
 *
 * Finalizes a consultation note (changes status from draft to finalized)
 * Sets finalizedBy field for audit trail per TypeSpec requirements
 */
export async function finalizeConsultation(ctx: Context) {
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
    throw new ForbiddenError('You can only finalize your own consultation notes');
  }
  
  // Only allow finalizing draft consultations
  if (consultation.status !== 'draft') {
    throw new BusinessLogicError(
      `Cannot finalize consultation in ${consultation.status} status. Only draft consultations can be finalized.`,
      'CONSULTATION_NOT_DRAFT'
    );
  }
  
  // Per TypeSpec, finalization doesn't require specific fields - business logic handled at application level
  // Finalize consultation using new finalizeNote method with finalizedBy per TypeSpec
  const finalizedConsultation = await consultationRepo.finalizeNote(consultationId, user.id);
  
  // Log audit trail per TypeSpec requirements
  logger?.info({
    consultationId,
    providerId: provider.id,
    patientId: consultation.patient,
    previousStatus: 'draft',
    newStatus: 'finalized',
    finalizedAt: finalizedConsultation.finalizedAt,
    finalizedBy: finalizedConsultation.finalizedBy,
    action: 'consultation_finalized',
    performedBy: user.id,
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Consultation note finalized');
  
  return ctx.json(finalizedConsultation, 200);
}
