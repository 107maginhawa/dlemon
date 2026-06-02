CREATE TYPE "public"."ceph_superimposition_reference" AS ENUM('cranial_base', 'maxillary', 'mandibular');--> statement-breakpoint
CREATE TABLE "imaging_ceph_superimposition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"report_from_id" uuid NOT NULL,
	"report_to_id" uuid NOT NULL,
	"reference_type" "ceph_superimposition_reference" DEFAULT 'cranial_base' NOT NULL,
	"transform" jsonb NOT NULL,
	"deltas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calibration_basis" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_case_presentation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"treatment_plan_id" uuid NOT NULL,
	"plan_version_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"decision" text,
	"decision_at" timestamp,
	"signature_data" text,
	"signer_name" text,
	"consent_form_id" uuid,
	"rejection_reason" text,
	"share_token" text,
	"share_token_expires_at" timestamp,
	"first_viewed_at" timestamp,
	"last_viewed_at" timestamp,
	CONSTRAINT "dental_case_presentation_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "dental_appointment_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"session_token" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dental_appointment" ADD COLUMN "source" text DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_appointment" ADD COLUMN "confirmation_state" text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_appointment" ADD COLUMN "confirmation_code" text;--> statement-breakpoint
ALTER TABLE "imaging_ceph_superimposition" ADD CONSTRAINT "imaging_ceph_superimposition_report_from_id_imaging_ceph_report_id_fk" FOREIGN KEY ("report_from_id") REFERENCES "public"."imaging_ceph_report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_ceph_superimposition" ADD CONSTRAINT "imaging_ceph_superimposition_report_to_id_imaging_ceph_report_id_fk" FOREIGN KEY ("report_to_id") REFERENCES "public"."imaging_ceph_report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_case_presentation" ADD CONSTRAINT "dental_case_presentation_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_case_presentation" ADD CONSTRAINT "dental_case_presentation_treatment_plan_id_dental_treatment_plan_id_fk" FOREIGN KEY ("treatment_plan_id") REFERENCES "public"."dental_treatment_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_appointment_hold" ADD CONSTRAINT "dental_appointment_hold_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_appointment_hold" ADD CONSTRAINT "dental_appointment_hold_provider_id_dental_membership_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."dental_membership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imaging_ceph_superimposition_patient_idx" ON "imaging_ceph_superimposition" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "imaging_ceph_superimposition_pair_idx" ON "imaging_ceph_superimposition" USING btree ("report_from_id","report_to_id");--> statement-breakpoint
CREATE INDEX "dental_case_presentation_patient_idx" ON "dental_case_presentation" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_case_presentation_plan_idx" ON "dental_case_presentation" USING btree ("treatment_plan_id");--> statement-breakpoint
CREATE INDEX "dental_case_presentation_share_token_idx" ON "dental_case_presentation" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "dental_appointment_hold_lookup_idx" ON "dental_appointment_hold" USING btree ("branch_id","provider_id","start_at");--> statement-breakpoint
CREATE INDEX "dental_appointment_hold_expires_idx" ON "dental_appointment_hold" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_appointment_confirmation_code_unique" ON "dental_appointment" USING btree ("confirmation_code") WHERE "dental_appointment"."confirmation_code" IS NOT NULL;