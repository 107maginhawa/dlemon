/**
 * audit.facade.ts
 *
 * Facade exposing audit repo to other handler modules.
 * Isolates cross-module access behind typed functions — other modules
 * import only this file, never the underlying AuditRepository.
 */

import type { DatabaseInstance } from '@/core/database';
import { AuditRepository } from './audit.repo';
import type { AuditLogEntry, CreateAuditLogRequest } from './audit.schema';
import type { Logger } from '@/types/logger';

export async function logAuditEvent(
  db: DatabaseInstance,
  logger: Logger | undefined,
  request: CreateAuditLogRequest,
  createdBy?: string,
): Promise<AuditLogEntry> {
  const repo = new AuditRepository(db, logger);
  return repo.logEvent(request, createdBy);
}
