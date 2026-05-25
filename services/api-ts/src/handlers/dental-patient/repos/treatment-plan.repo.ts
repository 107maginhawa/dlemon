import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalTreatmentPlans,
  type DentalTreatmentPlan,
  type NewDentalTreatmentPlan,
  type TreatmentPlanStatus,
} from './treatment-plan.schema';

export class TreatmentPlanRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async findByPatientId(patientId: string): Promise<DentalTreatmentPlan[]> {
    return this.db
      .select()
      .from(dentalTreatmentPlans)
      .where(eq(dentalTreatmentPlans.patientId, patientId));
  }

  async findOneById(id: string, patientId: string): Promise<DentalTreatmentPlan | null> {
    const [row] = await this.db
      .select()
      .from(dentalTreatmentPlans)
      .where(and(eq(dentalTreatmentPlans.id, id), eq(dentalTreatmentPlans.patientId, patientId)));
    return row ?? null;
  }

  async create(
    values: Omit<NewDentalTreatmentPlan, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalTreatmentPlan> {
    const [row] = await this.db.insert(dentalTreatmentPlans).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async update(
    id: string,
    patientId: string,
    values: Partial<Pick<DentalTreatmentPlan, 'status' | 'totalEstimateCents' | 'notes' | 'presentedAt' | 'approvedAt'>>,
  ): Promise<DentalTreatmentPlan | null> {
    const [row] = await this.db
      .update(dentalTreatmentPlans)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalTreatmentPlans.id, id), eq(dentalTreatmentPlans.patientId, patientId)))
      .returning();
    return row ?? null;
  }
}
