CREATE TYPE "public"."tooth_state" AS ENUM('healthy', 'caries', 'fractured', 'filled', 'crown', 'missing', 'implant', 'extracted', 'watchlist');--> statement-breakpoint
CREATE TYPE "public"."tooth_surface" AS ENUM('mesial', 'distal', 'buccal', 'lingual', 'occlusal', 'incisal', 'cervical');--> statement-breakpoint
CREATE TYPE "public"."dental_treatment_status" AS ENUM('diagnosed', 'planned', 'performed', 'verified', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."dental_visit_status" AS ENUM('draft', 'active', 'completed', 'locked');--> statement-breakpoint
CREATE TABLE "dental_chart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"teeth" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_treatment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"tooth_number" integer,
	"surfaces" jsonb,
	"cdt_code" text NOT NULL,
	"description" text NOT NULL,
	"condition_code" text,
	"status" "dental_treatment_status" DEFAULT 'diagnosed' NOT NULL,
	"dismiss_reason" text,
	"price_cents" integer NOT NULL,
	"carried_over" boolean DEFAULT false NOT NULL,
	"source_visit_id" uuid,
	"auto_dismissed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "visit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"author_member_id" uuid NOT NULL,
	"subjective" text,
	"objective" text,
	"assessment" text,
	"plan" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dental_visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"dentist_member_id" uuid NOT NULL,
	"status" "dental_visit_status" DEFAULT 'draft' NOT NULL,
	"activated_at" timestamp,
	"completed_at" timestamp,
	"locked_at" timestamp,
	"chief_complaint" text
);
--> statement-breakpoint
CREATE INDEX "dental_chart_visit_id_idx" ON "dental_chart" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "dental_chart_patient_id_idx" ON "dental_chart" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_treatment_visit_id_idx" ON "dental_treatment" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "dental_treatment_patient_id_idx" ON "dental_treatment" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "visit_notes_visit_id_idx" ON "visit_notes" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "dental_visit_patient_id_idx" ON "dental_visit" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_visit_branch_id_idx" ON "dental_visit" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_visit_active_patient_unique" ON "dental_visit" USING btree ("patient_id","status") WHERE status = 'active';