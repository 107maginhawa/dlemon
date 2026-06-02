CREATE TYPE "public"."asa_classification" AS ENUM('I', 'II', 'III', 'IV', 'V', 'VI');--> statement-breakpoint
CREATE TABLE "consent_refusal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"refusing_member_id" uuid NOT NULL,
	"procedure_description" text NOT NULL,
	"refusal_reason" text NOT NULL,
	"patient_acknowledgement" text NOT NULL,
	"refused_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_history_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"asa_classification" "asa_classification",
	"asa_emergency" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dental_treatment_plan_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"treatment_plan_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by_person_id" uuid NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consent_form" ADD COLUMN "procedure_nature" text;--> statement-breakpoint
ALTER TABLE "consent_form" ADD COLUMN "benefits" text;--> statement-breakpoint
ALTER TABLE "consent_form" ADD COLUMN "risks" text;--> statement-breakpoint
ALTER TABLE "consent_form" ADD COLUMN "alternatives" text;--> statement-breakpoint
ALTER TABLE "consent_form" ADD COLUMN "risks_of_non_treatment" text;--> statement-breakpoint
ALTER TABLE "lab_order" ADD COLUMN "shade" text;--> statement-breakpoint
ALTER TABLE "lab_order" ADD COLUMN "material" text;--> statement-breakpoint
ALTER TABLE "lab_order" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "dental_treatment_plan" ADD COLUMN "cdt_code_set_year" integer DEFAULT 2025 NOT NULL;--> statement-breakpoint
ALTER TABLE "dental_perio_tooth_reading" ADD COLUMN "gm_bm" smallint;--> statement-breakpoint
ALTER TABLE "dental_perio_tooth_reading" ADD COLUMN "gm_bc" smallint;--> statement-breakpoint
ALTER TABLE "dental_perio_tooth_reading" ADD COLUMN "gm_bd" smallint;--> statement-breakpoint
ALTER TABLE "dental_perio_tooth_reading" ADD COLUMN "gm_lm" smallint;--> statement-breakpoint
ALTER TABLE "dental_perio_tooth_reading" ADD COLUMN "gm_lc" smallint;--> statement-breakpoint
ALTER TABLE "dental_perio_tooth_reading" ADD COLUMN "gm_ld" smallint;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "appointment_id" uuid;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "option_group_id" uuid;--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "recommended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_refusal" ADD CONSTRAINT "consent_refusal_visit_id_dental_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."dental_visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_refusal" ADD CONSTRAINT "consent_refusal_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_refusal" ADD CONSTRAINT "consent_refusal_refusing_member_id_dental_membership_id_fk" FOREIGN KEY ("refusing_member_id") REFERENCES "public"."dental_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_history_review" ADD CONSTRAINT "medical_history_review_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_treatment_plan_status_history" ADD CONSTRAINT "dental_treatment_plan_status_history_treatment_plan_id_dental_treatment_plan_id_fk" FOREIGN KEY ("treatment_plan_id") REFERENCES "public"."dental_treatment_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_treatment_plan_status_history_plan_idx" ON "dental_treatment_plan_status_history" USING btree ("treatment_plan_id");--> statement-breakpoint
CREATE INDEX "dental_treatment_appointment_id_idx" ON "dental_treatment" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "dental_treatment_option_group_id_idx" ON "dental_treatment" USING btree ("option_group_id");