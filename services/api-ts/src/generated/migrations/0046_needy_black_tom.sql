CREATE TABLE "dental_patient_chart_baseline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"teeth" jsonb NOT NULL,
	"last_visit_id" uuid,
	"snapshot_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dental_patient_chart_baseline_patient_uniq" UNIQUE("patient_id")
);
--> statement-breakpoint
ALTER TABLE "dental_patient_chart_baseline" ADD CONSTRAINT "dental_patient_chart_baseline_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;