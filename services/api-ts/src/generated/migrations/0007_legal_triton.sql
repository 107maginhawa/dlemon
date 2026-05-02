CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'checkedIn', 'completed', 'cancelled', 'noShow');--> statement-breakpoint
CREATE TABLE "dental_appointment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"dentist_member_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"procedure_type" text NOT NULL,
	"operatory_id" uuid,
	"walk_in" boolean DEFAULT false NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"check_in_time" timestamp with time zone,
	"visit_id" uuid,
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"no_show_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "dental_appointment_branch_id_idx" ON "dental_appointment" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "dental_appointment_dentist_member_id_idx" ON "dental_appointment" USING btree ("dentist_member_id");--> statement-breakpoint
CREATE INDEX "dental_appointment_patient_id_idx" ON "dental_appointment" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_appointment_scheduled_at_idx" ON "dental_appointment" USING btree ("scheduled_at");