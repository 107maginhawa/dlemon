CREATE TABLE "dental_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid,
	"tenant_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE INDEX "dental_audit_person_timestamp_idx" ON "dental_audit" USING btree ("person_id","timestamp");--> statement-breakpoint
CREATE INDEX "dental_audit_tenant_timestamp_idx" ON "dental_audit" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "dental_audit_resource_idx" ON "dental_audit" USING btree ("resource_type","resource_id");