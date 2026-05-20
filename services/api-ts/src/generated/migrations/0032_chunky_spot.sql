CREATE TABLE "treatment_plan_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"patient_id" uuid NOT NULL,
	CONSTRAINT "treatment_plan_version_patient_version_uniq" UNIQUE("patient_id","version")
);
--> statement-breakpoint
ALTER TABLE "consent_form" ADD COLUMN "accepted_plan_version_id" uuid;--> statement-breakpoint
ALTER TABLE "treatment_plan_version" ADD CONSTRAINT "treatment_plan_version_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treatment_plan_version_patient_idx" ON "treatment_plan_version" USING btree ("patient_id");--> statement-breakpoint
ALTER TABLE "consent_form" ADD CONSTRAINT "consent_form_accepted_plan_version_id_treatment_plan_version_id_fk" FOREIGN KEY ("accepted_plan_version_id") REFERENCES "public"."treatment_plan_version"("id") ON DELETE set null ON UPDATE no action;