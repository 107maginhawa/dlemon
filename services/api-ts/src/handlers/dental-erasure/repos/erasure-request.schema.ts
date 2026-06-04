/**
 * Drizzle schema for right-to-erasure requests (V-DG-002 / WFG-006).
 *
 * Erasure is an AUDITABLE, TWO-STEP WORKFLOW (request → approve → anonymized),
 * not an instant destructive call. The actual data change is ANONYMIZATION
 * (PII redacted in place, de-identified clinical record kept) — never a hard
 * delete, and the audit trail is never touched. See DATA_GOVERNANCE.md §3.
 *
 * Safety invariants live in the erasure engine/service (anonymize-not-delete,
 * never-purge-audit, legal-hold blocks, two-step approval, idempotent, audited)
 * so they hold regardless of how a row is created.
 */

import { pgTable, uuid, text, timestamp, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

/**
 * Lifecycle of an erasure request:
 *  - requested  : subject erasure asked for; nothing mutated yet.
 *  - approved   : reviewer approved; transient state before anonymization runs.
 *  - anonymized : PII anonymization completed (terminal, success).
 *  - rejected   : reviewer declined OR blocked by legal hold (terminal).
 */
export const erasureRequestStatusEnum = pgEnum('erasure_request_status', [
  'requested',
  'approved',
  'anonymized',
  'rejected',
]);

export const dentalErasureRequests = pgTable(
  'dental_erasure_request',
  {
    ...baseEntityFields,
    // The Person (central PII record) targeted for erasure. No FK so the row
    // survives even after the person is anonymized (mirrors audit decoupling).
    subjectPersonId: uuid('subject_person_id').notNull(),
    // Optional patient profile link (a person may have a patient record).
    subjectPatientId: uuid('subject_patient_id'),
    tenantId: uuid('tenant_id').notNull(),
    branchId: uuid('branch_id'),
    status: erasureRequestStatusEnum('status').notNull().default('requested'),
    reason: text('reason').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at'),
    processedAt: timestamp('processed_at'),
    rejectionReason: text('rejection_reason'),
    // Set when a request was refused because the subject was under an active
    // legal hold — recorded for the compliance trail.
    legalHoldBlocked: boolean('legal_hold_blocked').notNull().default(false),
  },
  (table) => ({
    tenantIdx: index('dental_erasure_request_tenant_idx').on(table.tenantId),
    subjectIdx: index('dental_erasure_request_subject_idx').on(table.subjectPersonId),
    statusIdx: index('dental_erasure_request_status_idx').on(table.status),
  }),
);

export type DentalErasureRequest = typeof dentalErasureRequests.$inferSelect;
export type NewDentalErasureRequest = typeof dentalErasureRequests.$inferInsert;

export const VALID_ERASURE_STATUSES = ['requested', 'approved', 'anonymized', 'rejected'] as const;
export type ErasureRequestStatus = (typeof VALID_ERASURE_STATUSES)[number];
