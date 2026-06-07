/**
 * Shared email types used by core/email.ts
 * Extracted from handlers/email/repos/email.schema.ts to avoid core→handler dependency
 */

/**
 * Email template tags for identifying templates
 */
export enum EmailTemplateTags {
  // Auth templates
  AUTH_EMAIL_VERIFY = 'auth.email-verify',
  AUTH_PASSWORD_RESET = 'auth.password-reset',
  AUTH_2FA = 'auth.2fa',
  AUTH_WELCOME = 'auth.welcome',
  AUTH_MAGIC_LINK = 'auth.magic-link',
}

/**
 * Queue email request interface
 */
export interface QueueEmailRequest {
  template?: string; // Direct template ID (alternative to templateTags)
  templateTags?: string[]; // Template tags for dynamic resolution (alternative to template)
  recipient: string;
  recipientName?: string;
  variables: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  priority?: number;
  scheduledAt?: Date;
}

/**
 * Email queue item type (mirrors EmailQueueItem from schema)
 */
export interface EmailQueueItem {
  id: string;
  template: string | null;
  templateTags: string[] | null;
  recipientEmail: string;
  recipientName: string | null;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  priority: number;
  scheduledAt: Date | null;
  attempts: number;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
  lastError: string | null;
  sentAt: Date | null;
  provider: 'smtp' | 'postmark' | 'onesignal' | null;
  providerMessageId: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  version: number;
}

/**
 * Email template type (mirrors EmailTemplate from schema)
 */
export interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  tags: string[] | null;
  variables: unknown[];
  fromName: string | null;
  fromEmail: string | null;
  replyToEmail: string | null;
  replyToName: string | null;
  status: 'draft' | 'active' | 'archived';
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Send email request interface (internal)
 */
export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: {
    name?: string;
    email?: string;
  };
  replyTo?: {
    email?: string;
    name?: string;
  };
}

/**
 * Email send result interface
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: 'smtp' | 'postmark' | 'onesignal';
  error?: string;
}

/**
 * Template preview result interface
 */
export interface TemplatePreviewResult {
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}
