import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import {
  dentalAlerts,
  type DentalAlert,
  type NewDentalAlert,
} from './dental-alert.schema';

export class DentalAlertRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: Logger,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalAlert[]> {
    return this.db
      .select()
      .from(dentalAlerts)
      .where(eq(dentalAlerts.patientId, patientId));
  }

  async findOneById(id: string, patientId: string): Promise<DentalAlert | null> {
    const [row] = await this.db
      .select()
      .from(dentalAlerts)
      .where(and(eq(dentalAlerts.id, id), eq(dentalAlerts.patientId, patientId)));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalAlert, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalAlert> {
    const [row] = await this.db.insert(dentalAlerts).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalAlert, 'alertType' | 'severity' | 'description' | 'active'>>,
  ): Promise<DentalAlert | null> {
    const [row] = await this.db
      .update(dentalAlerts)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalAlerts.id, id), eq(dentalAlerts.patientId, patientId)))
      .returning();
    return row ?? null;
  }
}
