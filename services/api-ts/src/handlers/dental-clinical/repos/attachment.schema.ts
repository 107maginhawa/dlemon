/**
 * Drizzle schema for dental attachments (x-ray/photo, tooth-tagged)
 */

import { pgTable, uuid, text, bigint, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const dentalAttachmentImageTypeEnum = pgEnum('dental_attachment_image_type', [
  'xray',
  'photo',
  'scan',
  'document',
  'other',
]);

export const dentalAttachments = pgTable('dental_attachment', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  imageType: dentalAttachmentImageTypeEnum('image_type').notNull(),
  toothNumbers: jsonb('tooth_numbers').$type<number[]>(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
  mimeType: text('mime_type').notNull(),
  note: text('note'),
});

export type DentalAttachment = typeof dentalAttachments.$inferSelect;
export type NewDentalAttachment = typeof dentalAttachments.$inferInsert;

export const VALID_IMAGE_TYPES = ['xray', 'photo', 'scan', 'document', 'other'] as const;
export type DentalAttachmentImageType = typeof VALID_IMAGE_TYPES[number];
