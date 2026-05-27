import type { JobScheduler } from '@/core/jobs';
import type { DatabaseInstance } from '@/core/database';
import { AuditLogRepository } from '../repos/audit-log.repo';

export const DENTAL_AUDIT_EVENTS_QUEUE = 'dental.audit.domain-events';

export interface DentalAuditDomainEvent {
  tenantId: string;
  branchId?: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
}

export function publishAuditEvent(
  scheduler: JobScheduler,
  event: DentalAuditDomainEvent,
): Promise<string> {
  return scheduler.trigger(DENTAL_AUDIT_EVENTS_QUEUE, event);
}

export function registerAuditDomainEventConsumer(
  scheduler: JobScheduler,
  db: DatabaseInstance,
): void {
  const repo = new AuditLogRepository(db);

  scheduler.registerDelayed(DENTAL_AUDIT_EVENTS_QUEUE, 0, async (context) => {
    const event = context.data as DentalAuditDomainEvent | undefined;
    if (!event?.tenantId || !event?.actorId || !event?.action || !event?.targetType) return;

    await repo.insert({
      tenantId: event.tenantId,
      branchId: event.branchId ?? null,
      actorId: event.actorId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId ?? null,
      reason: event.reason ?? null,
      beforeSnapshot: event.beforeSnapshot ?? null,
      afterSnapshot: event.afterSnapshot ?? null,
    });
  });
}
