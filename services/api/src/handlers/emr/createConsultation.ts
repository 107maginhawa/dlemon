import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { ConsultationNoteRepository } from './repos/emr.repo';
import { ProviderRepository } from '../provider/repos/provider.repo';
import { PatientRepository } from '../patient/repos/patient.repo';
import { type CreateConsultationRequest } from './repos/emr.schema';

/**
 * createConsultation
 *
 * Path: POST /emr/consultations
 * OperationId: createConsultation
 * Security: bearerAuth with role ["provider"]
 *
 * Creates a consultation note per TypeSpec - accepts patient and provider directly
 */
export async function createConsultation(ctx: Context) {
  // Get authenticated user
  const user = ctx.get('user') as User;

  // Get validated request body
  const body = ctx.req.valid('json') as CreateConsultationRequest;

  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Instantiate repositories
  const consultationRepo = new ConsultationNoteRepository(db, logger);
  const providerRepo = new ProviderRepository(db, logger);
  const patientRepo = new PatientRepository(db, logger);

  // Validate provider exists and user has access
  const provider = await providerRepo.findOneById(body.provider);
  if (!provider) {
    throw new NotFoundError(`Provider ${body.provider} not found`, {
      resourceType: 'provider',
      resource: body.provider,
      suggestions: ['Check provider ID', 'Verify provider exists']
    });
  }

  // Verify user is the provider (role-based authorization)
  const userProvider = await providerRepo.findByPersonId(user.id);
  if (!userProvider) {
    throw new BusinessLogicError('Provider profile not found for authenticated user', 'PROVIDER_NOT_FOUND');
  }

  if (body.provider !== userProvider.id) {
    throw new ForbiddenError('You can only create consultation notes as yourself');
  }

  // Validate patient exists
  const patient = await patientRepo.findOneById(body.patient);
  if (!patient) {
    throw new NotFoundError(`Patient ${body.patient} not found`, {
      resourceType: 'patient',
      resource: body.patient,
      suggestions: ['Check patient ID', 'Verify patient exists']
    });
  }

  // Check for context-based duplicate if context provided
  if (body.context) {
    const existingConsultation = await consultationRepo.findByContext(body.context);
    if (existingConsultation) {
      throw new BusinessLogicError(`Consultation note with context '${body.context}' already exists`, 'CONSULTATION_EXISTS');
    }
  }

  // Create consultation note using TypeSpec pattern
  const consultation = await consultationRepo.createDirect({
    patient: body.patient,
    provider: body.provider,
    context: body.context,
    chiefComplaint: body.chiefComplaint,
    assessment: body.assessment,
    plan: body.plan,
    vitals: body.vitals,
    symptoms: body.symptoms,
    prescriptions: body.prescriptions,
    followUp: body.followUp
  });

  // Log audit trail
  logger?.info({
    consultationId: consultation.id,
    context: consultation.context,
    patientId: consultation.patient,
    providerId: consultation.provider,
    status: consultation.status,
    action: 'consultation_created',
    createdBy: user.id,
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Consultation note created');

  return ctx.json(consultation, 201);
}
