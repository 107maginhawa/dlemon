import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  ValidationError
} from '@/core/errors';
import { ConsultationNoteRepository } from './repos/emr.repo';
import { PatientRepository, type PatientFilters } from '../patient/repos/patient.repo';
import { parsePagination, parseFilters, buildPaginationMeta, shouldExpand } from '@/utils/query';
import { subDays } from 'date-fns';

/**
 * listEMRPatients
 *
 * Path: GET /emr/patients
 * OperationId: listEMRPatients
 *
 * List patients who have EMR data (consultation notes) with provider-based filtering.
 * Providers see only patients they have treated.
 * Returns patients with their consultation statistics.
 */
export async function listEMRPatients(ctx: Context) {
  // Get authenticated user from Better-Auth
  const user = ctx.get('user') as User;

  if (!user.id) {
    throw new ValidationError('Valid user ID required');
  }

  // Extract validated query parameters
  const query = ctx.req.valid('query') as {
    status?: 'active' | 'inactive';
    hasRecentConsultations?: boolean;
    dateStart?: string;
    dateEnd?: string;
    q?: string;
    expand?: string[];
    limit?: number;
    offset?: number;
    page?: number;
    pageSize?: number;
  };

  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Instantiate repositories
  const consultationRepo = new ConsultationNoteRepository(db, logger);
  const patientRepo = new PatientRepository(db, logger);

  // Parse pagination with defaults suitable for patient listing
  const pagination = parsePagination(query, { limit: 25, maxLimit: 100 });

  // Check field expansion options
  const expandPerson = shouldExpand(query, 'person');

  // Get consultations by this provider first to find their patients
  const consultationFilters = {
    provider: user.id, // Only show patients this provider has treated
    ...(query.dateStart && query.dateEnd && {
      dateRange: {
        start: query.dateStart,
        end: query.dateEnd
      }
    })
  };

  // Get all consultations by this provider to extract unique patient IDs
  const providerConsultations = await consultationRepo.findMany(consultationFilters, {
    orderBy: { field: 'createdAt', direction: 'desc' }
  });

  // Extract unique patient IDs
  const uniquePatientIds = [...new Set(providerConsultations.map(c => c.patient))];

  if (uniquePatientIds.length === 0) {
    // No patients for this provider
    logger?.info({
      userId: user.id,
      action: 'list_emr_patients',
      message: 'No patients found for provider'
    }, 'EMR patients listed (empty result)');

    return ctx.json({
      data: [],
      pagination: buildPaginationMeta([], 0, pagination.limit, pagination.offset)
    }, 200);
  }

  // Build patient filters including ID filtering for efficient querying
  const allowedFilters = ['status', 'q'];
  const patientFilters = parseFilters(query, allowedFilters) as PatientFilters;

  // Add ID filtering to use efficient IN query instead of memory filtering
  patientFilters.ids = uniquePatientIds;

  // Get patients with expansion if requested
  let patients;

  if (expandPerson) {
    // Get patients with person expansion, filtered by our patient IDs using IN query
    patients = await patientRepo.findManyWithPerson(patientFilters, {
      pagination
    });
  } else {
    // Get basic patient data, filtered by our patient IDs using IN query
    patients = await patientRepo.findMany(patientFilters, {
      pagination
    });
  }

  // Patients are already filtered by the IN query and paginated at the database level
  const paginatedPatients = patients;

  // Enhance patients with consultation statistics
  const patientsWithStats = await Promise.all(
    paginatedPatients.map(async (patient) => {
      const stats = await consultationRepo.getConsultationStats(
        patient.id,
        'patient',
        query.dateStart && query.dateEnd ? {
          start: query.dateStart,
          end: query.dateEnd
        } : undefined
      );

      return {
        ...patient,
        consultationStats: {
          totalConsultations: stats.totalConsultations,
          draftConsultations: stats.draftConsultations,
          finalizedConsultations: stats.finalizedConsultations,
          recentConsultationDate: stats.recentConsultationDate
        }
      };
    })
  );

  // Apply hasRecentConsultations filter if specified
  let finalPatients = patientsWithStats;
  if (query.hasRecentConsultations !== undefined) {
    const thirtyDaysAgo = subDays(new Date(), 30);

    finalPatients = patientsWithStats.filter(patient => {
      const hasRecent = patient.consultationStats.recentConsultationDate &&
                       patient.consultationStats.recentConsultationDate > thirtyDaysAgo;
      return query.hasRecentConsultations ? hasRecent : !hasRecent;
    });
  }

  // Build pagination metadata based on unique patient count
  const meta = buildPaginationMeta(
    finalPatients,
    uniquePatientIds.length,
    pagination.limit,
    pagination.offset
  );

  // Log audit trail
  logger?.info({
    userId: user.id,
    filtersApplied: patientFilters,
    expansions: {
      person: expandPerson
    },
    uniquePatientIds: uniquePatientIds.length,
    resultCount: finalPatients.length,
    totalConsultations: providerConsultations.length,
    action: 'list_emr_patients'
  }, 'EMR patients listed');

  return ctx.json({
    data: finalPatients,
    pagination: meta
  }, 200);
}
