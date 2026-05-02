/**
 * TreatmentRepository — data access for dental treatments
 *
 * Treatment lifecycle: diagnosed → planned → performed → verified → dismissed
 * EC2: autoDismissByTooth dismisses open treatments when tooth is extracted
 * EC4: price locked at recording time (never mutated by this repo after creation)
 */

import { eq, and, inArray, ne } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalTreatments,
  visitNotes,
  type DentalTreatment,
  type NewDentalTreatment,
  type VisitNotes,
  type NewVisitNotes,
} from './treatment.schema';

export interface CreateCarryOverInput {
  sourceVisitId: string;
  targetVisitId: string;
  patientId: string;
  cdtCode: string;
  description: string;
  toothNumber?: number;
  surfaces?: string[];
  conditionCode?: string;
  priceCents: number;
}

export class TreatmentRepository {
  constructor(private db: DatabaseInstance, private logger?: any) {}

  async createOne(data: NewDentalTreatment): Promise<DentalTreatment> {
    const [row] = await this.db
      .insert(dentalTreatments)
      .values(data)
      .returning();
    return row!;
  }

  async findOneById(id: string): Promise<DentalTreatment | null> {
    const [row] = await this.db
      .select()
      .from(dentalTreatments)
      .where(eq(dentalTreatments.id, id));
    return row ?? null;
  }

  async findByVisit(visitId: string): Promise<DentalTreatment[]> {
    return this.db
      .select()
      .from(dentalTreatments)
      .where(eq(dentalTreatments.visitId, visitId));
  }

  async updateStatus(id: string, status: DentalTreatment['status']): Promise<DentalTreatment | null> {
    const [updated] = await this.db
      .update(dentalTreatments)
      .set({ status, updatedAt: new Date() })
      .where(eq(dentalTreatments.id, id))
      .returning();
    return updated ?? null;
  }

  async dismiss(id: string, reason: string): Promise<DentalTreatment | null> {
    const [updated] = await this.db
      .update(dentalTreatments)
      .set({ status: 'dismissed', dismissReason: reason, updatedAt: new Date() })
      .where(eq(dentalTreatments.id, id))
      .returning();
    return updated ?? null;
  }

  async update(id: string, patch: Partial<Pick<DentalTreatment, 'status' | 'dismissReason' | 'toothNumber' | 'surfaces' | 'cdtCode' | 'description' | 'conditionCode'>>): Promise<DentalTreatment | null> {
    const [updated] = await this.db
      .update(dentalTreatments)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(dentalTreatments.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * EC2: When a tooth is extracted, auto-dismiss all open (non-verified, non-dismissed)
   * treatments for that tooth/patient combination.
   */
  async autoDismissByTooth(patientId: string, toothNumber: number): Promise<void> {
    const openStatuses: DentalTreatment['status'][] = ['diagnosed', 'planned', 'performed'];

    await this.db
      .update(dentalTreatments)
      .set({
        status: 'dismissed',
        autoDismissed: true,
        dismissReason: 'Tooth extracted',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dentalTreatments.patientId, patientId),
          eq(dentalTreatments.toothNumber, toothNumber),
          inArray(dentalTreatments.status, openStatuses),
        )
      );
  }

  /**
   * Create a carry-over treatment from a previous visit.
   * Starts in 'planned' status since it was previously diagnosed.
   */
  async createCarryOver(input: CreateCarryOverInput): Promise<DentalTreatment> {
    const [row] = await this.db
      .insert(dentalTreatments)
      .values({
        visitId: input.targetVisitId,
        patientId: input.patientId,
        cdtCode: input.cdtCode,
        description: input.description,
        toothNumber: input.toothNumber,
        surfaces: input.surfaces,
        conditionCode: input.conditionCode,
        priceCents: input.priceCents,
        carriedOver: true,
        sourceVisitId: input.sourceVisitId,
        status: 'planned',
      })
      .returning();
    return row!;
  }
}

// VisitNotes repo methods (kept in same file for simplicity)
export class VisitNotesRepository {
  constructor(private db: DatabaseInstance, private logger?: any) {}

  async upsert(data: NewVisitNotes): Promise<VisitNotes> {
    const existing = await this.findByVisit(data.visitId!);
    if (existing) {
      const [updated] = await this.db
        .update(visitNotes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(visitNotes.id, existing.id))
        .returning();
      return updated!;
    }
    const [created] = await this.db.insert(visitNotes).values(data).returning();
    return created!;
  }

  async findByVisit(visitId: string): Promise<VisitNotes | null> {
    const [row] = await this.db.select().from(visitNotes).where(eq(visitNotes.visitId, visitId));
    return row ?? null;
  }
}
