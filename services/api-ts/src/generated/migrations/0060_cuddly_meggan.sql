CREATE TABLE "dental_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb
);
--> statement-breakpoint
CREATE INDEX "dental_audit_log_actor_ts_idx" ON "dental_audit_log" USING btree ("actor_id","timestamp");--> statement-breakpoint
CREATE INDEX "dental_audit_log_tenant_ts_idx" ON "dental_audit_log" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "dental_audit_log_target_idx" ON "dental_audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "dental_audit_log_branch_ts_idx" ON "dental_audit_log" USING btree ("branch_id","timestamp");