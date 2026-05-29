import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ForbiddenError,
  NotFoundError
} from '@/core/errors';
import { ConsultationNoteRepository } from './repos/emr.repo';
import type { ConsultationNoteWithDetails } from './repos/emr.schema';
import {
  getPatientByPersonIdForEMR,
  getPatientForEMR,
  getPatientWithPersonForEMR,
} from '../patient/repos/patient-emr.facade';
import {
  getProviderByPersonIdForEMR,
  getProviderForEMR,
  getProviderWithPersonForEMR,
} from '../provider/repos/provider-emr.facade';
import { shouldExpand } from '@/utils/query';
import { logAuditEvent } from '@/core/audit-logger';
import { EMR_AUDIT_TENANT_SENTINEL } from './emr-audit';

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

  // Find consultation note
  const consultation = await consultationRepo.findOneById(consultationId);
  if (!consultation) {
    throw new NotFoundError(`Consultation ${consultationId} not found`, {
      resourceType: 'consultation',
      resource: consultationId,
      suggestions: ['Check consultation ID', 'Verify consultation exists', 'Check consultation status']
    });
  }
  
  // Check ownership - user must be admin, or the provider/patient for this consultation.
  // MODULE_SPEC §6 (Read one): roles = admin, provider:owner, patient:owner (V-EMR-C-003).
  let hasAccess = false;

  // Admins may read any consultation (no ownership constraint).
  const userRoles = user.role ? user.role.split(',').map((r) => r.trim()) : [];
  if (userRoles.includes('admin')) {
    hasAccess = true;
  }

  // Check if user is the provider for this consultation
  if (!hasAccess) {
    const provider = await getProviderByPersonIdForEMR(db, user.id, logger);
    if (provider && consultation.provider === provider.id) {
      hasAccess = true;
    }
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
    // V-EMR-005: never fall back to the patient UUID (PHI id in the tenant slot).
    tenantId: consultation.tenantId ?? EMR_AUDIT_TENANT_SENTINEL,
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
  
  // Compose expanded details via owning-module facades — the EMR module never
  // reaches into patient/provider/person schemas directly (EX-005/EX-006).
  const consultationWithDetails: ConsultationNoteWithDetails = { ...consultation };

  if (expandPatient) {
    const patientData = expandPerson
      ? await getPatientWithPersonForEMR(db, consultation.patient, logger)
      : await getPatientForEMR(db, consultation.patient, logger);
    if (patientData) {
      consultationWithDetails.patient = patientData;
    }
  }

  if (expandProvider) {
    const providerData = expandPerson
      ? await getProviderWithPersonForEMR(db, consultation.provider, logger)
      : await getProviderForEMR(db, consultation.provider, logger);
    if (providerData) {
      consultationWithDetails.provider = providerData;
    }
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
