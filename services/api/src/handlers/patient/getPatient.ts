import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { PatientRepository } from './repos/patient.repo';
// Auto-expand via middleware - no manual expand logic needed
import type { User } from '@/types/auth';

/**
 * getPatient
 * 
 * Path: GET /patients/{patient}
 * OperationId: getPatient
 * Security: bearerAuth with roles ["owner", "admin"]
 * Note: Supports special /patients/me endpoint for current user's profile
 */
export async function getPatient(ctx: Context) {
  // Get authenticated user (middleware guarantees user exists)
  const user = ctx.get('user') as User;
  
  // Get path parameter and query
  let patientId = ctx.req.param('patient');
  const query = ctx.req.valid('query') as { expand?: string[] };
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repository
  const repo = new PatientRepository(db, logger);
  
  // Handle special 'me' endpoint - get current user's patient profile
  if (patientId === 'me') {
    if (!user.id) {
      throw new NotFoundError('No patient profile found for current user', {
        resourceType: 'patient',
        resource: 'me',
        suggestions: ['Create patient profile first', 'Verify authentication']
      });
    }
    
    // Find patient by person ID
    const patient = await repo.findByPersonId(user.id);
    if (!patient) {
      throw new NotFoundError('No patient profile found for current user', {
        resourceType: 'patient',
        resource: 'me',
        suggestions: ['Create patient profile first', 'Complete user profile']
      });
    }
    
    patientId = patient.id;
  }
  
  // Get patient (expansion handled automatically by auto-expand middleware)
  const patient = await repo.findOneById(patientId);
  
  if (!patient) {
    throw new NotFoundError('Patient not found', {
      resourceType: 'patient',
      resource: patientId,
      suggestions: ['Check patient ID format', 'Verify patient exists in system']
    });
  }
  
  // Check authorization - owner can only access their own record
  const personId = typeof patient.person === 'string' ? patient.person : patient.person.id;
  const isOwner = personId === user.id;

  if (!isOwner) {
    throw new ForbiddenError('Access denied');
  }
  
  // Log audit trail
  logger?.info({
    patientId: patient.id,
    personId,
    action: 'view',
    viewedBy: user.id,
    isOwner,
    wasMeEndpoint: ctx.req.param('patient') === 'me'
  }, 'Patient retrieved');
  
  // Return the patient data
  return ctx.json(patient, 200);
}