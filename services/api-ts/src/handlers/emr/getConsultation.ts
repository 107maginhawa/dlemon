import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ForbiddenError,
  NotFoundError
} from '@/core/errors';
import { ConsultationNoteRepository } from './repos/emr.repo';
import { getPatientByPersonIdForEMR } from '../patient/repos/patient-emr.facade';
import { ProviderRepository } from '../provider/repos/provider.repo';
import { shouldExpand } from '@/utils/query';
import { logAuditEvent } from '@/core/audit-logger';

/**
 * getConsultation
 * 
 * Path: GET /emr/consultations/{id}
 * OperationId: getConsultation
 * Security: bearerAuth with role ["admin", "provider:owner", "patient:owner"]
 * 
 * Retrieves a consultation note with optional field expansion
 */
export async function getConsultation(ctx: HandlerContext) {
  // Get authenticated user and check authorization
  const user = ctx.get('user') as User;
  const auth = ctx.get('auth');
  
  // Get consultation ID from path parameters
  const consultationId = ctx.req.param('consultation');
  if (!consultationId) {
    throw new NotFoundError('Consultation ID is required', {
      resourceType: 'consultation',
      resource: 'missing',
      suggestions: ['Check ID format', 'Verify resource exists']
    });
  }
  
  // Get query parameters for expansion
  const query = ctx.req.query();
  
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
  
  // Check ownership - user must be either the provider or patient for this consultation
  let hasAccess = false;

  // Check if user is the provider for this consultation
  const provider = await providerRepo.findByPersonId(user.id);
  if (provider && consultation.provider === provider.id) {
    hasAccess = true;
  }

  // If not the provider, check if user is the patient for this consultation
  if (!hasAccess) {
    const patient = await getPatientByPersonIdForEMR(db, user.id, logger);
    if (patient && consultation.patient === patient.id) {
      hasAccess = true;
    }
  }

  if (!hasAccess) {
    throw new ForbiddenError('You can only access your own consultation notes');
  }

  // Persisted audit trail (AL-024) — PHI read
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: consultation.tenantId ?? consultation.patient,
    action: 'emr.consultation.read',
    resourceType: 'consultation',
    resourceId: consultation.id,
    metadata: {
      patientId: consultation.patient,
      providerId: consultation.provider
    }
  });

  // Check for field expansion requests
  const expandPatient = shouldExpand(query, 'patient');
  const expandProvider = shouldExpand(query, 'provider');
  const expandPerson = shouldExpand(query, 'person');
  
  // If no expansion needed, return basic consultation
  if (!expandPatient && !expandProvider) {
    logger?.info({
      consultationId,
      accessedBy: user.id,
      action: 'consultation_viewed'
    }, 'Consultation note accessed');
    
    return ctx.json(consultation, 200);
  }
  
  // Get consultation with expanded details
  const consultationWithDetails = await consultationRepo.findOneWithDetails(
    consultationId,
    {
      patient: expandPatient,
      provider: expandProvider,
      person: expandPerson
    }
  );
  
  if (!consultationWithDetails) {
    throw new NotFoundError(`Consultation ${consultationId} not found`, {
      resourceType: 'consultation',
      resource: consultationId,
      suggestions: ['Check consultation ID', 'Verify consultation exists', 'Check consultation status']
    });
  }
  
  // Log audit trail
  logger?.info({
    consultationId,
    accessedBy: user.id,
    expandedFields: [
      expandPatient && 'patient', 
      expandProvider && 'provider',
      expandPerson && 'person'
    ].filter(Boolean),
    action: 'consultation_viewed'
  }, 'Consultation note accessed with expansion');
  
  return ctx.json(consultationWithDetails, 200);
}
