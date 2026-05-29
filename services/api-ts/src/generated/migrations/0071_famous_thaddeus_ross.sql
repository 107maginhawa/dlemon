ALTER TABLE "dental_audit_log" ADD COLUMN "event_type" text;--> statement-breakpoint
ALTER TABLE "dental_audit_log" ADD COLUMN "actor_role" text;--> statement-breakpoint
ALTER TABLE "dental_audit_log" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "dental_audit_log" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "dental_audit_log" ADD COLUMN "metadata" jsonb;