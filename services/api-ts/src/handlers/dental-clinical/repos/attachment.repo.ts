/**
 * AttachmentRepository — data access for dental attachments (x-ray/photo)
 */

import { eq, and, isNull } from 'drizzle-orm';
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
    const conditions = [isNull(dentalAttachments.deletedAt)];
    if (filters?.visitId) conditions.push(eq(dentalAttachments.visitId, filters.visitId));
    if (filters?.patientId) conditions.push(eq(dentalAttachments.patientId, filters.patientId));
    return and(...conditions);
  }

  override async findMany(filters?: AttachmentFilters): Promise<DentalAttachment[]> {
    const where = this.buildWhereConditions(filters);
    return await this.db.select().from(dentalAttachments).where(where);
  }

  override async findOneById(id: string): Promise<DentalAttachment | null> {
    const [row] = await this.db
      .select()
      .from(dentalAttachments)
      .where(and(eq(dentalAttachments.id, id), isNull(dentalAttachments.deletedAt)));
    return row ?? null;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.db
      .update(dentalAttachments)
      .set({ deletedAt: new Date() })
      .where(and(eq(dentalAttachments.id, id), isNull(dentalAttachments.deletedAt)))
      .returning({ id: dentalAttachments.id });
    return result.length > 0;
  }
}
