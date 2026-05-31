CREATE TYPE "public"."erasure_request_status" AS ENUM('requested', 'approved', 'anonymized', 'rejected');--> statement-breakpoint
CREATE TABLE "dental_erasure_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"subject_person_id" uuid NOT NULL,
	"subject_patient_id" uuid,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"status" "erasure_request_status" DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"processed_at" timestamp,
	"rejection_reason" text,
	"legal_hold_blocked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dental_erasure_request_tenant_idx" ON "dental_erasure_request" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dental_erasure_request_subject_idx" ON "dental_erasure_request" USING btree ("subject_person_id");--> statement-breakpoint
CREATE INDEX "dental_erasure_request_status_idx" ON "dental_erasure_request" USING btree ("status");