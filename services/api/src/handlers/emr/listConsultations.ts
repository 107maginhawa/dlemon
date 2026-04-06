import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ValidationError,
  ForbiddenError
} from '@/core/errors';
import { ConsultationNoteRepository, type ConsultationNoteFilters } from './repos/emr.repo';
import { ProviderRepository } from '../provider/repos/provider.repo';
import { PatientRepository } from '../patient/repos/patient.repo';
import { parsePagination, buildPaginationMeta } from '@/utils/query';

/**
 * listConsultations
 *
 * Path: GET /emr/consultations
 * OperationId: listConsultations
 *
 * List consultation notes with role-based filtering:
 * - Providers see only their own consultations
 * - Admins/Support see all consultations
 * - Patients are not allowed to use this endpoint (they use patient-specific endpoint)
 */
export async function listConsultations(ctx: Context) {
  // Get authenticated user from Better-Auth
  const user = ctx.get('user') as User;

  if (!user.id) {
    throw new ValidationError('Valid user ID required');
  }

  // Extract validated query parameters (matching TypeSpec exactly)
  const query = ctx.req.valid('query') as {
    patient?: string;                        // Patient filter per TypeSpec
    status?: 'draft' | 'finalized' | 'amended'; // Status filter per TypeSpec
    limit?: number;                          // Pagination per TypeSpec
    offset?: number;                         // Pagination per TypeSpec
  };

  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Instantiate repository
  const repo = new ConsultationNoteRepository(db, logger);

  // Build filters from TypeSpec query parameters
  const filters: ConsultationNoteFilters = {};

  // Add patient filter if provided (per TypeSpec)
  if (query.patient) {
    filters.patient = query.patient;
  }

  // Add status filter if provided (per TypeSpec)
  if (query.status) {
    filters.status = query.status;
  }

  // Apply role-based access control per TypeSpec
  // Providers see only their own consultations, patients see their own consultations, admins see all
  const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
  const isAdmin = userRoles.includes('admin');
  const isProvider = userRoles.includes('provider');
  const isPatient = userRoles.includes('patient');

  if (!isAdmin) {
    if (isProvider) {
      // For providers, find their provider profile and filter by it
      const providerRepo = new ProviderRepository(db, logger);
      const provider = await providerRepo.findByPersonId(user.id);
      if (!provider) {
        throw new ForbiddenError('Provider profile not found for authenticated user');
      }
      filters.provider = provider.id;
    } else if (isPatient) {
      // For patients, find their patient profile and filter by it
      const patientRepo = new PatientRepository(db, logger);
      const patient = await patientRepo.findByPersonId(user.id);
      if (!patient) {
        throw new ForbiddenError('Patient profile not found for authenticated user');
      }

      // If patient query param is provided, validate it matches the authenticated patient
      if (query.patient && query.patient !== patient.id) {
        throw new ForbiddenError('Patients can only access their own consultations');
      }

      filters.patient = patient.id;
    } else {
      throw new ForbiddenError('User must have provider, patient, or admin role to access consultations');
    }
  }

  // Parse pagination with defaults suitable for consultation listing
  const pagination = parsePagination(query, { limit: 25, maxLimit: 100 });

  // Get consultations with filters and pagination (per TypeSpec)
  const consultations = await repo.findMany(filters, {
    pagination,
    orderBy: { field: 'createdAt', direction: 'desc' }
  });

  // Get total count for pagination metadata
  const totalCount = await repo.count(filters);

  // Build pagination metadata
  const meta = buildPaginationMeta(
    consultations,
    totalCount,
    pagination.limit,
    pagination.offset
  );

  // Log audit trail per TypeSpec requirements
  logger?.info({
    userId: user.id,
    filtersApplied: {
      ...filters,
      // Don't log sensitive filter values
      provider: filters.provider ? '[FILTERED]' : undefined
    },
    resultCount: consultations.length,
    totalCount,
    action: 'list_consultations'
  }, 'Consultations listed');

  return ctx.json({
    data: consultations,
    pagination: meta
  }, 200);
}
