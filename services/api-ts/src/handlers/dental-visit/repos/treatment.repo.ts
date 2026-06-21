/**
 * TreatmentRepository — data access for dental treatments
 *
 * Treatment lifecycle: diagnosed → planned → performed → verified → dismissed
 * EC2: autoDismissByTooth dismisses open treatments when tooth is extracted
 * EC4: price locked at recording time (never mutated by this repo after creation)
 */

import { eq, and, inArray, asc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { createSnapshotVersion } from '@/core/database.schema';
import {
  dentalTreatments,
  visitNotes,
  visitNoteVersions,
  type DentalTreatment,
  type NewDentalTreatment,
  type VisitNotes,
  type NewVisitNotes,
  type VisitNoteVersion,
} from './treatment.schema';
import { BusinessLogicError } from '@/core/errors';

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
  constructor(private db: DatabaseInstance, private logger?: Logger) {}

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

  /**
   * WFG-004: same as findByVisit but takes a row-level FOR UPDATE lock. The invoice
   * create path uses this INSIDE its transaction so two concurrent createDentalInvoice
   * for the same visit SERIALIZE on the visit's treatment rows: the loser blocks until
   * the winner commits, then reads the now-billed rows and is correctly rejected by the
   * already-billed guard (TREATMENT_ALREADY_BILLED) — instead of both racing past the
   * check-then-act guard under READ COMMITTED and each minting an invoice (double-billing).
   * MUST be called within a transaction; FOR UPDATE outside a tx locks nothing useful.
   */
  async findByVisitForUpdate(visitId: string): Promise<DentalTreatment[]> {
    return this.db
      .select()
      .from(dentalTreatments)
      .where(eq(dentalTreatments.visitId, visitId))
      .for('update');
  }

  /**
   * SL-01: offline-replay idempotency. Find a prior create by its client-generated
   * localId, scoped to the parent visit (a treatment localId is unique within its
   * visit). The handler returns the existing row on replay; a partial unique index
   * on (visit_id, local_id) backstops a concurrent-retry race.
   */
  async findByLocalId(visitId: string, localId: string): Promise<DentalTreatment | null> {
    const [row] = await this.db
      .select()
      .from(dentalTreatments)
      .where(and(eq(dentalTreatments.visitId, visitId), eq(dentalTreatments.localId, localId)));
    return row ?? null;
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

  async decline(id: string, reason: string): Promise<DentalTreatment | null> {
    const [updated] = await this.db
      .update(dentalTreatments)
      .set({ status: 'declined', refusalReason: reason, updatedAt: new Date() })
      .where(eq(dentalTreatments.id, id))
      .returning();
    return updated ?? null;
  }

  async setBilledInvoiceId(ids: string[], invoiceId: string): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(dentalTreatments)
      .set({ billedInvoiceId: invoiceId, updatedAt: new Date() })
      .where(inArray(dentalTreatments.id, ids));
  }

  async update(id: string, patch: Partial<Pick<DentalTreatment, 'status' | 'dismissReason' | 'refusalReason' | 'toothNumber' | 'surfaces' | 'cdtCode' | 'description' | 'conditionCode' | 'priceCents' | 'clinicalNotes' | 'performedAt' | 'billedInvoiceId' | 'phase' | 'priority'>>): Promise<DentalTreatment | null> {
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
  constructor(private db: DatabaseInstance, private logger?: Logger) {}

  async upsert(data: NewVisitNotes): Promise<VisitNotes> {
    const existing = await this.findByVisit(data.visitId!);
    if (existing) {
      // BR: signed note is immutable — addendum-only post-sign (mirrors TREATMENT_IMMUTABLE)
      if (existing.signed) {
        throw new BusinessLogicError('Visit note is signed and cannot be modified', 'NOTE_SIGNED');
      }
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

  async findById(id: string): Promise<VisitNotes | null> {
    const [row] = await this.db.select().from(visitNotes).where(eq(visitNotes.id, id));
    return row ?? null;
  }

  /** Sign a note: set signed=true/signedAt/signedBy/lockedAt, freeze v1 snapshot. */
  async sign(noteId: string, signedBy: string): Promise<{ note: VisitNotes; version: VisitNoteVersion }> {
    const now = new Date();
    const [note] = await this.db
      .update(visitNotes)
      .set({ signed: true, signedAt: now, signedBy, lockedAt: now, updatedAt: now })
      .where(eq(visitNotes.id, noteId))
      .returning();
    if (!note) throw new Error('VisitNotesRepository.sign: note not found after update');

    const snapshot: Record<string, unknown> = {
      type: 'sign',
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      notes: note.notes,
      signedBy,
      signedAt: now.toISOString(),
    };

    const version = await createSnapshotVersion(
      this.db,
      visitNoteVersions,
      visitNoteVersions.noteId,
      visitNoteVersions.version,
      noteId,
      { noteId, snapshot, createdBy: signedBy },
    ) as VisitNoteVersion;

    return { note, version };
  }

  /** Append an addendum version snapshot to a signed note. */
  async addendum(noteId: string, content: string, reason: string, createdBy: string): Promise<VisitNoteVersion> {
    const snapshot: Record<string, unknown> = { type: 'addendum', reason, content, addendumBy: createdBy, addendumAt: new Date().toISOString() };
    return await createSnapshotVersion(
      this.db,
      visitNoteVersions,
      visitNoteVersions.noteId,
      visitNoteVersions.version,
      noteId,
      { noteId, snapshot, createdBy },
    ) as VisitNoteVersion;
  }

  /** Return all version snapshots for a note, ordered by version ascending. */
  async history(noteId: string): Promise<VisitNoteVersion[]> {
    return this.db
      .select()
      .from(visitNoteVersions)
      .where(eq(visitNoteVersions.noteId, noteId))
      .orderBy(asc(visitNoteVersions.version));
  }
}
