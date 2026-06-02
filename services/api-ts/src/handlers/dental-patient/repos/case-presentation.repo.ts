/**
 * CasePresentationRepository — data access for P1-20 case presentations.
 *
 * Append-only + immutable-on-decision. The repo composes the existing treatment
 * stores (linked treatments grouped by phase, option groups) to build the
 * patient-readable aggregate; it never writes clinical data.
 */

import { eq, and, isNull } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalCasePresentations,
  type DentalCasePresentation,
  type NewDentalCasePresentation,
  type CasePresentationDecision,
  type CasePresentationStatus,
} from './case-presentation.schema';
import { dentalTreatments } from '../../dental-visit/repos/treatment.schema';

/** A patient-readable treatment line item (denormalized for presentation). */
export interface CasePresentationItem {
  id: string;
  toothNumber: number | null;
  surfaces: string[] | null;
  description: string;
  cdtCode: string;
  status: string;
  priceCents: number;
  phase: string | null;
  optionGroupId: string | null;
  recommended: boolean;
}

export class CasePresentationRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: any,
  ) {}

  async create(
    values: Omit<NewDentalCasePresentation, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalCasePresentation> {
    const [row] = await this.db.insert(dentalCasePresentations).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async findByPatientId(patientId: string): Promise<DentalCasePresentation[]> {
    return this.db
      .select()
      .from(dentalCasePresentations)
      .where(eq(dentalCasePresentations.patientId, patientId));
  }

  async findOneById(id: string, patientId: string): Promise<DentalCasePresentation | null> {
    const [row] = await this.db
      .select()
      .from(dentalCasePresentations)
      .where(
        and(
          eq(dentalCasePresentations.id, id),
          eq(dentalCasePresentations.patientId, patientId),
        ),
      );
    return row ?? null;
  }

  /**
   * Record a patient decision (accept/reject). Guarded by the immutability rule:
   * only writes when the presentation is not yet decided. Returns null if it has
   * already been decided (lets the handler surface 422 PRESENTATION_DECIDED).
   */
  async decide(
    id: string,
    patientId: string,
    decision: CasePresentationDecision,
    fields: {
      signatureData?: string | null;
      signerName?: string | null;
      consentFormId?: string | null;
      rejectionReason?: string | null;
    },
  ): Promise<DentalCasePresentation | null> {
    const status: CasePresentationStatus = decision === 'accepted' ? 'accepted' : 'rejected';
    const [row] = await this.db
      .update(dentalCasePresentations)
      .set({
        decision,
        decisionAt: new Date(),
        status,
        signatureData: fields.signatureData ?? null,
        signerName: fields.signerName ?? null,
        consentFormId: fields.consentFormId ?? null,
        rejectionReason: fields.rejectionReason ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dentalCasePresentations.id, id),
          eq(dentalCasePresentations.patientId, patientId),
          // Immutability: only an un-decided presentation can be decided.
          isNull(dentalCasePresentations.decision),
        ),
      )
      .returning();
    return row ?? null;
  }

  /** Record engagement telemetry on read (sets firstViewedAt once, lastViewedAt each time). */
  async recordView(presentation: DentalCasePresentation): Promise<void> {
    const now = new Date();
    const updates: Partial<NewDentalCasePresentation> = { lastViewedAt: now, updatedAt: now };
    if (!presentation.firstViewedAt) updates.firstViewedAt = now;
    // Advance draft/sent → viewed (engagement signal); never overwrite a terminal state.
    if (presentation.status === 'draft' || presentation.status === 'sent') {
      updates.status = 'viewed';
    }
    await this.db
      .update(dentalCasePresentations)
      .set(updates)
      .where(eq(dentalCasePresentations.id, presentation.id));
  }

  /**
   * The plan's linked treatment items, patient-readable. Scoped to the patient so a
   * presentation can only surface that patient's own items.
   */
  async findPlanItems(planId: string, patientId: string): Promise<CasePresentationItem[]> {
    const rows = await this.db
      .select()
      .from(dentalTreatments)
      .where(
        and(
          eq(dentalTreatments.treatmentPlanId, planId),
          eq(dentalTreatments.patientId, patientId),
        ),
      );
    return rows.map((t) => ({
      id: t.id,
      toothNumber: t.toothNumber ?? null,
      surfaces: t.surfaces ?? null,
      description: t.description,
      cdtCode: t.cdtCode,
      status: t.status,
      priceCents: t.priceCents,
      phase: t.phase ?? null,
      optionGroupId: t.optionGroupId ?? null,
      recommended: t.recommended,
    }));
  }

  /**
   * A representative visit id for the plan's items (the consent e-sig written on
   * accept hangs off a visit). Returns null if the plan has no linked items.
   */
  async findPlanVisitId(planId: string, patientId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ visitId: dentalTreatments.visitId })
      .from(dentalTreatments)
      .where(
        and(
          eq(dentalTreatments.treatmentPlanId, planId),
          eq(dentalTreatments.patientId, patientId),
        ),
      )
      .limit(1);
    return row?.visitId ?? null;
  }
}
