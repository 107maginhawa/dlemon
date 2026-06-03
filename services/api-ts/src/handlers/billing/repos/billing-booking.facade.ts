/**
 * billing-booking.facade.ts
 *
 * Facade exposing invoice creation to the `booking` module. A paid booking
 * creates an invoice at booking time; booking imports only this facade, never
 * the billing repo directly (Phase 10 boundary lint — the facade pattern is the
 * approved cross-module bridge).
 */

import type { DatabaseInstance } from '@/core/database';
import { InvoiceRepository } from './billing.repo';

/**
 * Create an invoice for a booking. Thin wrapper over InvoiceRepository.createOne;
 * behaviour is unchanged (same payload, same row).
 */
export async function createInvoiceForBooking(
  db: DatabaseInstance,
  data: Parameters<InvoiceRepository['createOne']>[0],
  logger?: unknown,
): ReturnType<InvoiceRepository['createOne']> {
  return new InvoiceRepository(db, logger as never).createOne(data);
}
