CREATE TYPE "public"."dental_treatment_plan_approval_method" AS ENUM('signature', 'verbal', 'portal');--> statement-breakpoint
CREATE TABLE "dental_treatment_plan_approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"treatment_plan_id" uuid NOT NULL,
	"plan_version_id" uuid,
	"approved_by_person_id" uuid NOT NULL,
	"method" "dental_treatment_plan_approval_method" NOT NULL,
	"consent_form_id" uuid,
	"signature_data" text,
	"approved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dental_treatment" ADD COLUMN "treatment_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "dental_treatment_plan_approval" ADD CONSTRAINT "dental_treatment_plan_approval_treatment_plan_id_dental_treatment_plan_id_fk" FOREIGN KEY ("treatment_plan_id") REFERENCES "public"."dental_treatment_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_treatment_plan_approval_plan_idx" ON "dental_treatment_plan_approval" USING btree ("treatment_plan_id");--> statement-breakpoint
CREATE INDEX "dental_treatment_treatment_plan_id_idx" ON "dental_treatment" USING btree ("treatment_plan_id");