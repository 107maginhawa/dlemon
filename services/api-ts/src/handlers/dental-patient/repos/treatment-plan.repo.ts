import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalTreatmentPlans,
  dentalTreatmentPlanApprovals,
  dentalTreatmentPlanStatusHistory,
  deriveTreatmentPlanStatus,
  type DentalTreatmentPlan,
  type NewDentalTreatmentPlan,
  type DentalTreatmentPlanApproval,
  type NewDentalTreatmentPlanApproval,
  type DentalTreatmentPlanStatusHistory,
  type NewDentalTreatmentPlanStatusHistory,
  type TreatmentPlanStatus,
} from './treatment-plan.schema';
import {
  linkPendingTreatmentsToPlan,
  getTreatmentStatusesByPlan,
  setTreatmentAppointment,
  getTreatmentPlanRef,
  getOptionGroupTreatments,
  acceptTreatmentOption,
} from '../../dental-visit/repos/visit-treatment-plan.facade';

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
    return linkPendingTreatmentsToPlan(this.db, patientId, planId);
  }

  /**
   * TR-P1-08 / TP-BR-005: recompute a plan's status from its linked treatments
   * (the item set). No-op for draft/presented/cancelled plans. Persists only when
   * the derived status differs.
   */
  async recomputeStatus(planId: string, patientId: string): Promise<DentalTreatmentPlan | null> {
    const plan = await this.findOneById(planId, patientId);
    if (!plan) return null;

    const items = await getTreatmentStatusesByPlan(this.db, planId);

    const derived = deriveTreatmentPlanStatus(
      plan.status,
      items.map((i) => i.status as string),
    );
    if (derived === plan.status) return plan;
    return this.update(planId, patientId, { status: derived });
  }

  /**
   * P1-21: attach a planned treatment item to a scheduled appointment (loose ref).
   * Scoped by patientId so a caller can only schedule that patient's own items.
   * Returns null if the treatment doesn't exist for the patient.
   */
  async attachAppointment(
    treatmentId: string,
    patientId: string,
    appointmentId: string,
  ): Promise<{ id: string; appointmentId: string | null } | null> {
    return setTreatmentAppointment(this.db, treatmentId, patientId, appointmentId);
  }

  /** P1-21: detach a planned treatment item from its appointment (clear the loose ref). */
  async detachAppointment(
    treatmentId: string,
    patientId: string,
  ): Promise<{ id: string; appointmentId: string | null } | null> {
    return setTreatmentAppointment(this.db, treatmentId, patientId, null);
  }

  /** Recompute the plan a given treatment belongs to (if any). Used by the treatment-update trigger. */
  async recomputeForTreatment(treatmentId: string): Promise<void> {
    const t = await getTreatmentPlanRef(this.db, treatmentId);
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

  /**
   * P1-19: the treatments in an alternate-case option group, scoped to the patient.
   * Used to present "Option A / Option B" and to validate accept-one-rejects-siblings.
   */
  async findOptionGroup(
    optionGroupId: string,
    patientId: string,
  ): Promise<Array<{ id: string; status: string; recommended: boolean }>> {
    return getOptionGroupTreatments(this.db, optionGroupId, patientId);
  }

  /**
   * P1-19: accept ONE option in an alternate-case group. The chosen treatment moves
   * to `planned`; every other non-terminal sibling in the group is `declined` with a
   * refusal reason. Returns the option group's post-state. Idempotent-ish: re-running
   * on an already-accepted option is a no-op beyond touching updatedAt.
   */
  async acceptOption(
    optionGroupId: string,
    chosenTreatmentId: string,
    patientId: string,
  ): Promise<Array<{ id: string; status: string; recommended: boolean }>> {
    return acceptTreatmentOption(this.db, optionGroupId, chosenTreatmentId, patientId);
  }

  /** P2-8: append a status-history row (who / when / from → to). */
  async recordStatusHistory(
    values: Omit<NewDentalTreatmentPlanStatusHistory, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'changedAt'>,
  ): Promise<DentalTreatmentPlanStatusHistory> {
    const [row] = await this.db
      .insert(dentalTreatmentPlanStatusHistory)
      .values(values)
      .returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  /** P2-8: the chronological status timeline for a plan. */
  async findStatusHistoryByPlanId(planId: string): Promise<DentalTreatmentPlanStatusHistory[]> {
    return this.db
      .select()
      .from(dentalTreatmentPlanStatusHistory)
      .where(eq(dentalTreatmentPlanStatusHistory.treatmentPlanId, planId))
      .orderBy(dentalTreatmentPlanStatusHistory.changedAt);
  }
}
