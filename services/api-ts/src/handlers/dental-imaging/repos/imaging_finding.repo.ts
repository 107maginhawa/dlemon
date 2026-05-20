/**
 * ImagingFindingRepository — data access for imaging findings
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import {
  imagingFindings,
  type ImagingFinding,
  type NewImagingFinding,
} from './imaging_finding.schema';

/** Mutable fields — excludes FK/denormalized columns to prevent mass assignment */
export type UpdateFindingPayload = Partial<
  Pick<NewImagingFinding, 'type' | 'status' | 'toothNumber' | 'surfaces' | 'note' | 'treatmentId'>
>;

export class ImagingFindingRepository {
  constructor(private db: DatabaseInstance) {}

  async create(data: NewImagingFinding): Promise<ImagingFinding> {
    const [row] = await this.db.insert(imagingFindings).values(data).returning();
    if (!row) throw new Error('Failed to create imaging finding');
    return row;
  }

  async findById(id: string): Promise<ImagingFinding | null> {
    const [row] = await this.db
      .select()
      .from(imagingFindings)
      .where(eq(imagingFindings.id, id))
      .limit(1);
    return row ?? null;
  }

  async listByImage(imageId: string, branchId: string): Promise<ImagingFinding[]> {
    return this.db
      .select()
      .from(imagingFindings)
      .where(and(eq(imagingFindings.imageId, imageId), eq(imagingFindings.branchId, branchId)));
  }

  async update(id: string, data: UpdateFindingPayload): Promise<ImagingFinding | null> {
    const [row] = await this.db
      .update(imagingFindings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(imagingFindings.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: string, branchId: string): Promise<void> {
    await this.db
      .delete(imagingFindings)
      .where(and(eq(imagingFindings.id, id), eq(imagingFindings.branchId, branchId)));
  }
}
