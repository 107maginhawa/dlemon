import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import {
  dentalOcclusionScreenings,
  type DentalOcclusionScreening,
  type NewDentalOcclusionScreening,
} from './occlusion-screening.schema';

export class OcclusionScreeningRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: Logger,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalOcclusionScreening[]> {
    return this.db
      .select()
      .from(dentalOcclusionScreenings)
      .where(eq(dentalOcclusionScreenings.patientId, patientId));
  }

  async findOneById(id: string, patientId: string): Promise<DentalOcclusionScreening | null> {
    const [row] = await this.db
      .select()
      .from(dentalOcclusionScreenings)
      .where(and(eq(dentalOcclusionScreenings.id, id), eq(dentalOcclusionScreenings.patientId, patientId)));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalOcclusionScreening, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalOcclusionScreening> {
    const [row] = await this.db.insert(dentalOcclusionScreenings).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalOcclusionScreening, 'angleClass' | 'overbiteMm' | 'overjetMm' | 'crossbite' | 'crowding' | 'spacing' | 'midlineDeviation' | 'visitId' | 'notes'>>,
  ): Promise<DentalOcclusionScreening | null> {
    const [row] = await this.db
      .update(dentalOcclusionScreenings)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalOcclusionScreenings.id, id), eq(dentalOcclusionScreenings.patientId, patientId)))
      .returning();
    return row ?? null;
  }
}
