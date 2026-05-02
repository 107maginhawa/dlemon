/**
 * AttachmentRepository — data access for dental attachments (x-ray/photo)
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { dentalAttachments, type DentalAttachment, type NewDentalAttachment } from './attachment.schema';

export interface AttachmentFilters {
  visitId?: string;
  patientId?: string;
}

export class AttachmentRepository extends DatabaseRepository<DentalAttachment, NewDentalAttachment, AttachmentFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, dentalAttachments, logger);
  }

  protected buildWhereConditions(filters?: AttachmentFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.visitId) conditions.push(eq(dentalAttachments.visitId, filters.visitId));
    if (filters.patientId) conditions.push(eq(dentalAttachments.patientId, filters.patientId));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: AttachmentFilters): Promise<DentalAttachment[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(dentalAttachments).where(where)
      : await this.db.select().from(dentalAttachments);
  }

  override async findOneById(id: string): Promise<DentalAttachment | null> {
    const [row] = await this.db.select().from(dentalAttachments).where(eq(dentalAttachments.id, id));
    return row ?? null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db
      .delete(dentalAttachments)
      .where(eq(dentalAttachments.id, id))
      .returning({ id: dentalAttachments.id });
    return result.length > 0;
  }
}
