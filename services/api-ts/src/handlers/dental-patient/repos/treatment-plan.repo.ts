import { eq, and, inArray, isNull } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalTreatmentPlans,
  dentalTreatmentPlanApprovals,
  deriveTreatmentPlanStatus,
  type DentalTreatmentPlan,
  type NewDentalTreatmentPlan,
  type DentalTreatmentPlanApproval,
  type NewDentalTreatmentPlanApproval,
  type TreatmentPlanStatus,
} from './treatment-plan.schema';
import { dentalTreatments } from '../../dental-visit/repos/treatment.schema';

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

  /**
   * TR-P1-08 / TP-BR-005: link the patient's currently-pending (diagnosed/planned)
   * treatments to this plan as its items. Only unlinked treatments are claimed,
   * so re-running is safe. Returns the number of treatments newly linked.
   */
  async linkPendingTreatments(planId: string, patientId: string): Promise<number> {
    const linked = await this.db
      .update(dentalTreatments)
      .set({ treatmentPlanId: planId })
      .where(
        and(
          eq(dentalTreatments.patientId, patientId),
          inArray(dentalTreatments.status, ['diagnosed', 'planned']),
          isNull(dentalTreatments.treatmentPlanId),
        ),
      )
      .returning({ id: dentalTreatments.id });
    return linked.length;
  }

  /**
   * TR-P1-08 / TP-BR-005: recompute a plan's status from its linked treatments
   * (the item set). No-op for draft/presented/cancelled plans. Persists only when
   * the derived status differs.
   */
  async recomputeStatus(planId: string, patientId: string): Promise<DentalTreatmentPlan | null> {
    const plan = await this.findOneById(planId, patientId);
    if (!plan) return null;

    const items = await this.db
      .select({ status: dentalTreatments.status })
      .from(dentalTreatments)
      .where(eq(dentalTreatments.treatmentPlanId, planId));

    const derived = deriveTreatmentPlanStatus(
      plan.status,
      items.map((i) => i.status as string),
    );
    if (derived === plan.status) return plan;
    return this.update(planId, patientId, { status: derived });
  }

  /** Recompute the plan a given treatment belongs to (if any). Used by the treatment-update trigger. */
  async recomputeForTreatment(treatmentId: string): Promise<void> {
    const [t] = await this.db
      .select({ planId: dentalTreatments.treatmentPlanId, patientId: dentalTreatments.patientId })
      .from(dentalTreatments)
      .where(eq(dentalTreatments.id, treatmentId));
    if (t?.planId) await this.recomputeStatus(t.planId, t.patientId);
  }

  /** CR-05: append a treatment-plan approval record. */
  async createApproval(
    values: Omit<NewDentalTreatmentPlanApproval, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalTreatmentPlanApproval> {
    const [row] = await this.db.insert(dentalTreatmentPlanApprovals).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async findApprovalsByPlanId(planId: string): Promise<DentalTreatmentPlanApproval[]> {
    return this.db
      .select()
      .from(dentalTreatmentPlanApprovals)
      .where(eq(dentalTreatmentPlanApprovals.treatmentPlanId, planId));
  }
}
