/**
 * Shared audit types used by core/audit.ts
 * Extracted from handlers/audit/repos/audit.schema.ts to avoid core→handler dependency
 */

export type AuditEventType = 'authentication' | 'data-access' | 'data-modification' | 'system-config' | 'security' | 'compliance';
export type AuditCategory = 'hipaa' | 'security' | 'privacy' | 'administrative' | 'clinical' | 'financial';
export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout';
export type AuditOutcome = 'success' | 'failure' | 'partial' | 'denied';
export type AuditRetentionStatus = 'active' | 'archived' | 'pending-purge';
export type UserType = 'client' | 'host' | 'admin' | 'system';

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  category: AuditCategory;
  action: AuditAction;
  outcome: AuditOutcome;
  user: string | null;
  userType: string | null;
  resourceType: string;
  resource: string;
  description: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  session: string | null;
  request: string | null;
  integrityHash: string | null;
  retentionStatus: AuditRetentionStatus;
  archivedAt: Date | null;
  archivedBy: string | null;
  purgeAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  version: number;
}

export interface CreateAuditLogRequest {
  eventType: AuditEventType;
  category: AuditCategory;
  action: AuditAction;
  outcome: AuditOutcome;
  user?: string;
  userType?: UserType;
  resourceType: string;
  resource: string;
  description: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  session?: string;
  request?: string;
}
