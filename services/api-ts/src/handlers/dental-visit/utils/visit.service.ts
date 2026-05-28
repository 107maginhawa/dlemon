import { VisitRepository } from '../repos/visit.repo';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { VisitFilters } from '../repos/visit.repo';
import type { DentalVisit, NewDentalVisit } from '../repos/visit.schema';

export type { DentalVisit };

export async function getVisitOrThrow(db: DatabaseInstance, visitId: string): Promise<DentalVisit> {
  const repo = new VisitRepository(db);
  const visit = await repo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit');
  return visit;
}

export async function findVisits(db: DatabaseInstance, filters: VisitFilters): Promise<DentalVisit[]> {
  return new VisitRepository(db).findMany(filters);
}

export async function findInProgressVisitByPatient(db: DatabaseInstance, patientId: string): Promise<DentalVisit | null> {
  return new VisitRepository(db).findInProgressByPatient(patientId);
}

export async function createVisit(db: DatabaseInstance, data: Omit<NewDentalVisit, 'id' | 'createdAt' | 'updatedAt'>): Promise<DentalVisit> {
  return new VisitRepository(db).createOne(data);
}
