/**
 * DentalFindingRepository — data access for structured clinical findings (P0-C).
 */
import { eq, and, desc } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  dentalFindings,
  type DentalFinding,
  type NewDentalFinding,
} from './dental-finding.schema';

export class DentalFindingRepository {
  constructor(private db: DatabaseInstance) {}

  async createOne(data: NewDentalFinding): Promise<DentalFinding> {
    const [created] = await this.db.insert(dentalFindings).values(data).returning();
    return created!;
  }

  async findById(id: string): Promise<DentalFinding | null> {
    const [row] = await this.db.select().from(dentalFindings).where(eq(dentalFindings.id, id));
    return row ?? null;
  }

  async findByLocalId(visitId: string, localId: string): Promise<DentalFinding | null> {
    const [row] = await this.db
      .select()
      .from(dentalFindings)
      .where(and(eq(dentalFindings.visitId, visitId), eq(dentalFindings.localId, localId)));
    return row ?? null;
  }

  async listByVisit(visitId: string): Promise<DentalFinding[]> {
    return this.db
      .select()
      .from(dentalFindings)
      .where(eq(dentalFindings.visitId, visitId))
      .orderBy(desc(dentalFindings.createdAt));
  }

  async updateOne(id: string, patch: Partial<NewDentalFinding>): Promise<DentalFinding | null> {
    const [updated] = await this.db
      .update(dentalFindings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(dentalFindings.id, id))
      .returning();
    return updated ?? null;
  }

  async linkTreatment(id: string, treatmentId: string): Promise<DentalFinding | null> {
    return this.updateOne(id, { linkedTreatmentId: treatmentId });
  }
}
