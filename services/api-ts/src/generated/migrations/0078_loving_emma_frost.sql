CREATE TYPE "public"."legal_hold_status" AS ENUM('active', 'released');--> statement-breakpoint
CREATE TABLE "dental_legal_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"subject_person_id" uuid NOT NULL,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"status" "legal_hold_status" DEFAULT 'active' NOT NULL,
	"initiated_by" uuid NOT NULL,
	"released_by" uuid,
	"released_at" timestamp,
	"note" text
);
--> statement-breakpoint
CREATE INDEX "dental_legal_hold_tenant_idx" ON "dental_legal_hold" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dental_legal_hold_subject_idx" ON "dental_legal_hold" USING btree ("subject_person_id");--> statement-breakpoint
CREATE INDEX "dental_legal_hold_status_idx" ON "dental_legal_hold" USING btree ("status");