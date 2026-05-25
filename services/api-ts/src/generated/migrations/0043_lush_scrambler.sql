CREATE TABLE "dental_treatment_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_estimate_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"presented_at" timestamp,
	"approved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "dental_treatment_plan" ADD CONSTRAINT "dental_treatment_plan_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_treatment_plan_patient_idx" ON "dental_treatment_plan" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_treatment_plan_status_idx" ON "dental_treatment_plan" USING btree ("status");