/**
 * MedicalHistoryReviewRepository — data access for medical-history reviews (P1-4)
 *
 * Reviews are append-only; the most recent reviewedAt for a patient is current.
 */

import { eq, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  medicalHistoryReviews,
  type MedicalHistoryReview,
  type NewMedicalHistoryReview,
} from './medical-history-review.schema';

export interface MedicalHistoryReviewFilters {
  patientId?: string;
}

export class MedicalHistoryReviewRepository extends DatabaseRepository<
  MedicalHistoryReview,
  NewMedicalHistoryReview,
  MedicalHistoryReviewFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, medicalHistoryReviews, logger);
  }

  protected buildWhereConditions(filters?: MedicalHistoryReviewFilters) {
    if (!filters?.patientId) return undefined;
    return eq(medicalHistoryReviews.patientId, filters.patientId);
  }

  override async findOneById(id: string): Promise<MedicalHistoryReview | null> {
    const [row] = await this.db.select().from(medicalHistoryReviews).where(eq(medicalHistoryReviews.id, id));
    return row ?? null;
  }

  /** Most recent review for a patient (current attestation), or null if never reviewed. */
  async findLatestByPatient(patientId: string): Promise<MedicalHistoryReview | null> {
    const [row] = await this.db
      .select()
      .from(medicalHistoryReviews)
      .where(eq(medicalHistoryReviews.patientId, patientId))
      .orderBy(desc(medicalHistoryReviews.reviewedAt))
      .limit(1);
    return row ?? null;
  }
}
