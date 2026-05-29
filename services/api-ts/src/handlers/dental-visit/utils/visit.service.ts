/**
 * VisitService — public cross-module facade for the dental-visit bounded context.
 *
 * This is the ONLY supported entry point for other modules (e.g. dental-clinical)
 * to read or create visits. It exposes a stable, minimal interface (`VisitService`)
 * so consumers depend on an abstraction rather than on `VisitRepository` internals.
 *
 * Cross-module rule (C7 / G-003): dental-clinical MUST import from here and MUST NOT
 * import `repos/visit.repo` (VisitRepository) directly. Adding new repo methods to
 * the visit context never widens the cross-module surface unless they are added to
 * `VisitService` deliberately.
 */

import { VisitRepository } from '../repos/visit.repo';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { VisitFilters } from '../repos/visit.repo';
import type { DentalVisit, NewDentalVisit } from '../repos/visit.schema';

export type { DentalVisit };
export type { VisitFilters };

/** Input accepted when other modules create a visit (server-managed fields omitted). */
export type CreateVisitInput = Omit<NewDentalVisit, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * The cross-module contract for the visit bounded context.
 * dental-clinical (and any other consumer) depends on THIS interface, not on
 * VisitRepository. Keep this surface intentionally narrow.
 */
export interface VisitService {
  /** Fetch a visit by id, throwing NotFoundError when absent. */
  getVisitOrThrow(visitId: string): Promise<DentalVisit>;
  /** List visits matching the given filters. */
  findVisits(filters: VisitFilters): Promise<DentalVisit[]>;
  /** Find a patient's currently in-progress (draft or active) visit, if any. */
  findInProgressVisitByPatient(patientId: string): Promise<DentalVisit | null>;
  /** Create a new visit. */
  createVisit(data: CreateVisitInput): Promise<DentalVisit>;
}

/**
 * Construct a {@link VisitService} bound to a database instance. This is the
 * abstraction other modules should consume.
 */
export function createVisitService(db: DatabaseInstance): VisitService {
  const repo = new VisitRepository(db);
  return {
    async getVisitOrThrow(visitId: string): Promise<DentalVisit> {
      const visit = await repo.findOneById(visitId);
      if (!visit) throw new NotFoundError('Visit');
      return visit;
    },
    findVisits(filters: VisitFilters): Promise<DentalVisit[]> {
      return repo.findMany(filters);
    },
    findInProgressVisitByPatient(patientId: string): Promise<DentalVisit | null> {
      return repo.findInProgressByPatient(patientId);
    },
    createVisit(data: CreateVisitInput): Promise<DentalVisit> {
      return repo.createOne(data);
    },
  };
}

// ---------------------------------------------------------------------------
// Backwards-compatible function API (thin delegators over VisitService).
// Existing handlers call these standalone helpers; behavior is identical.
// ---------------------------------------------------------------------------

export function getVisitOrThrow(db: DatabaseInstance, visitId: string): Promise<DentalVisit> {
  return createVisitService(db).getVisitOrThrow(visitId);
}

export function findVisits(db: DatabaseInstance, filters: VisitFilters): Promise<DentalVisit[]> {
  return createVisitService(db).findVisits(filters);
}

export function findInProgressVisitByPatient(db: DatabaseInstance, patientId: string): Promise<DentalVisit | null> {
  return createVisitService(db).findInProgressVisitByPatient(patientId);
}

export function createVisit(db: DatabaseInstance, data: CreateVisitInput): Promise<DentalVisit> {
  return createVisitService(db).createVisit(data);
}
