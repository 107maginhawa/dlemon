import { parseUserRoles } from '@/handlers/shared/parse-user-roles';
import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ValidationError,
  ForbiddenError
} from '@/core/errors';
import { ConsultationNoteRepository, type ConsultationNoteFilters } from './repos/emr.repo';
import { getProviderByPersonIdForEMR } from '../provider/repos/provider-emr.facade';
import { getPatientByPersonIdForEMR } from '../patient/repos/patient-emr.facade';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import { logAuditEvent } from '@/core/audit-logger';
import { EMR_AUDIT_TENANT_SENTINEL } from './emr-audit';

/**
 * listConsultations
 *
 * Path: GET /emr/consultations
 * OperationId: listConsultations
 *
 * List consultation notes with role-based filtering:
 * - Providers see only their own consultations
 * - Patients see only their own consultations
 * - Admins see all consultations
 */
export async function listConsultations(ctx: HandlerContext) {
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
  const userRoles = parseUserRoles(user);
  const isAdmin = userRoles.includes('admin');
  const isProvider = userRoles.includes('provider');
  const isPatient = userRoles.includes('patient');

  if (!isAdmin) {
    if (isProvider) {
      // For providers, find their provider profile and filter by it
      const provider = await getProviderByPersonIdForEMR(db, user.id, logger);
      if (!provider) {
        throw new ForbiddenError('Provider profile not found for authenticated user');
      }
      filters.provider = provider.id;
    } else if (isPatient) {
      // For patients, find their patient profile and filter by it
      const patient = await getPatientByPersonIdForEMR(db, user.id, logger);
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

  // Persisted audit trail (V-EMR-004) — this returns PHI (consultation notes),
  // so the bulk read must leave a durable audit row. Only counts/filter scope
  // are recorded, never PHI values.
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: EMR_AUDIT_TENANT_SENTINEL,
    action: 'emr.consultation.list',
    resourceType: 'consultation',
    metadata: {
      patientFilter: filters.patient,
      providerFilter: filters.provider,
      statusFilter: filters.status,
      resultCount: consultations.length,
      totalCount
    }
  });

  return ctx.json({
    data: consultations,
    pagination: meta
  }, 200);
}
