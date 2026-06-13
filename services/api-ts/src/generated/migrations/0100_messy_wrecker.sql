CREATE TYPE "public"."dental_condition_code" AS ENUM('caries', 'abscess', 'calculus', 'gingival_recession', 'impacted_unerupted', 'retained_root', 'sensitive_dentin', 'fracture_crack', 'wear_erosion', 'developmental_anomaly', 'other');--> statement-breakpoint
CREATE TYPE "public"."dental_finding_status" AS ENUM('active', 'resolved');--> statement-breakpoint
CREATE TABLE "dental_finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"local_id" text,
	"sync_status" text DEFAULT 'synced' NOT NULL,
	"last_sync_at" timestamp,
	"conflict_payload" jsonb,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"tooth_number" integer NOT NULL,
	"surface" text,
	"condition_code" "dental_condition_code" NOT NULL,
	"note" text,
	"status" "dental_finding_status" DEFAULT 'active' NOT NULL,
	"linked_treatment_id" uuid
);
--> statement-breakpoint
ALTER TABLE "dental_finding" ADD CONSTRAINT "dental_finding_visit_id_dental_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."dental_visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_finding" ADD CONSTRAINT "dental_finding_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_finding_visit_id_idx" ON "dental_finding" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "dental_finding_patient_id_idx" ON "dental_finding" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_finding_visit_local_id_unique" ON "dental_finding" USING btree ("visit_id","local_id") WHERE local_id is not null;