/**
 * Drizzle schema for dental attachments (x-ray/photo, tooth-tagged)
 */

import { pgTable, uuid, text, bigint, integer, jsonb, pgEnum, timestamp } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';

export const dentalAttachmentImageTypeEnum = pgEnum('dental_attachment_image_type', [
  'xray',
  'photo',
  'scan',
  'document',
  'other',
]);

export const dentalAttachments = pgTable('dental_attachment', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  imageType: dentalAttachmentImageTypeEnum('image_type').notNull(),
  toothNumbers: jsonb('tooth_numbers').$type<number[]>(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
  mimeType: text('mime_type').notNull(),
  note: text('note'),
  deletedAt: timestamp('deleted_at'),
});

export type DentalAttachment = typeof dentalAttachments.$inferSelect;
export type NewDentalAttachment = typeof dentalAttachments.$inferInsert;

export const VALID_IMAGE_TYPES = ['xray', 'photo', 'scan', 'document', 'other'] as const;
export type DentalAttachmentImageType = typeof VALID_IMAGE_TYPES[number];
