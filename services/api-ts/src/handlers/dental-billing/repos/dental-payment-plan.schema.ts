/**
 * Drizzle schema for dental payment plans and installments
 *
 * Plans allow splitting invoice balances into periodic installments.
 * Status lifecycle: onTrack -> behind | completed | defaulted
 */

import { pgTable, uuid, text, timestamp, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const planFrequencyEnum = pgEnum('dental_plan_frequency', [
  'weekly', 'biweekly', 'monthly',
]);

export const planStatusEnum = pgEnum('dental_plan_status', [
  'onTrack', 'behind', 'completed', 'defaulted',
]);

export const installmentStatusEnum = pgEnum('dental_installment_status', [
  'pending', 'paid', 'overdue', 'waived',
]);

export const dentalPaymentPlans = pgTable('dental_payment_plan', {
  ...baseEntityFields,
  invoiceId: uuid('invoice_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  totalCents: integer('total_cents').notNull(),
  numberOfInstallments: integer('number_of_installments').notNull(),
  frequency: planFrequencyEnum('frequency').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  amountPerInstallmentCents: integer('amount_per_installment_cents').notNull(),
  status: planStatusEnum('status').notNull().default('onTrack'),
}, (table) => ({
  invoiceIdx: index('dental_payment_plan_invoice_id_idx').on(table.invoiceId),
  patientIdx: index('dental_payment_plan_patient_id_idx').on(table.patientId),
}));

export const dentalPaymentPlanInstallments = pgTable('dental_payment_plan_installment', {
  ...baseEntityFields,
  planId: uuid('plan_id').notNull(),
  installmentNumber: integer('installment_number').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  paidCents: integer('paid_cents').notNull().default(0),
  paidDate: timestamp('paid_date', { withTimezone: true }),
  paymentId: uuid('payment_id'),
  status: installmentStatusEnum('status').notNull().default('pending'),
}, (table) => ({
  planIdx: index('dental_installment_plan_id_idx').on(table.planId),
}));

export type DentalPaymentPlan = typeof dentalPaymentPlans.$inferSelect;
export type NewDentalPaymentPlan = typeof dentalPaymentPlans.$inferInsert;
export type DentalPaymentPlanInstallment = typeof dentalPaymentPlanInstallments.$inferSelect;
export type NewDentalPaymentPlanInstallment = typeof dentalPaymentPlanInstallments.$inferInsert;
