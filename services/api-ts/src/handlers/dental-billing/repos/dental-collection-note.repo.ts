/**
 * DentalCollectionNoteRepository — collections outreach log (BR-051).
 *
 * Append-only: create + read only. `findLatestByPatients` powers the worklist's
 * "last contacted" enrichment (one round-trip for the whole page).
 */

import { eq, inArray, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalCollectionNotes,
  type DentalCollectionNote,
  type NewDentalCollectionNote,
} from './dental-collection-note.schema';

export interface LatestContact {
  patientId: string;
  lastContactedAt: Date;
  lastContactChannel: string;
  noteCount: number;
}

export class DentalCollectionNoteRepository {
  constructor(private readonly db: DatabaseInstance) {}

  async create(input: NewDentalCollectionNote): Promise<DentalCollectionNote> {
    const [row] = await this.db.insert(dentalCollectionNotes).values(input).returning();
    return row!;
  }

  async listByPatient(patientId: string): Promise<DentalCollectionNote[]> {
    return this.db
      .select()
      .from(dentalCollectionNotes)
      .where(eq(dentalCollectionNotes.patientId, patientId))
      .orderBy(desc(dentalCollectionNotes.contactedAt));
  }

  /** Latest contact + note count per patient, for the worklist. */
  async findLatestByPatients(patientIds: string[]): Promise<Map<string, LatestContact>> {
    const result = new Map<string, LatestContact>();
    if (patientIds.length === 0) return result;

    const rows = await this.db
      .select({
        patientId: dentalCollectionNotes.patientId,
        contactedAt: dentalCollectionNotes.contactedAt,
        contactChannel: dentalCollectionNotes.contactChannel,
      })
      .from(dentalCollectionNotes)
      .where(inArray(dentalCollectionNotes.patientId, patientIds))
      .orderBy(desc(dentalCollectionNotes.contactedAt));

    // rows are newest-first; the first row seen per patient is the latest contact.
    for (const r of rows) {
      const existing = result.get(r.patientId);
      if (existing) {
        existing.noteCount += 1;
      } else {
        result.set(r.patientId, {
          patientId: r.patientId,
          lastContactedAt: r.contactedAt,
          lastContactChannel: r.contactChannel,
          noteCount: 1,
        });
      }
    }
    return result;
  }
}
// ponytail: noteCount tallied in app code from the same fetch — avoids a second
// GROUP BY query; the worklist page set (overdue patients) is small.
