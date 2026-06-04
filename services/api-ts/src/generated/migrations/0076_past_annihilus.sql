CREATE TYPE "public"."retention_policy_action" AS ENUM('archive', 'anonymize', 'delete', 'retain');--> statement-breakpoint
CREATE TABLE "dental_retention_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"entity_type" text NOT NULL,
	"retention_period_days" integer NOT NULL,
	"action" "retention_policy_action" DEFAULT 'archive' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"legal_hold_exempt" boolean DEFAULT false NOT NULL,
	"notes" text,
	"last_evaluated_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "dental_retention_policy_tenant_idx" ON "dental_retention_policy" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dental_retention_policy_enabled_idx" ON "dental_retention_policy" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_retention_policy_tenant_entity_uq" ON "dental_retention_policy" USING btree ("tenant_id","branch_id","entity_type");