import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalRecalls,
  type DentalRecall,
  type NewDentalRecall,
  type RecallStatus,
} from './recall.schema';

export class RecallRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalRecall[]> {
    return this.db
      .select()
      .from(dentalRecalls)
      .where(eq(dentalRecalls.patientId, patientId));
  }

  async findOneById(id: string, patientId: string): Promise<DentalRecall | null> {
    const [row] = await this.db
      .select()
      .from(dentalRecalls)
      .where(and(eq(dentalRecalls.id, id), eq(dentalRecalls.patientId, patientId)));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalRecall, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalRecall> {
    const [row] = await this.db.insert(dentalRecalls).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalRecall, 'type' | 'dueDate' | 'status' | 'notes' | 'sentAt' | 'completedAt'>>,
  ): Promise<DentalRecall | null> {
    const [row] = await this.db
      .update(dentalRecalls)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalRecalls.id, id), eq(dentalRecalls.patientId, patientId)))
      .returning();
    return row ?? null;
  }
}
