CREATE TYPE "public"."imaging_finding_status" AS ENUM('suspected', 'confirmed', 'monitoring', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."imaging_finding_type" AS ENUM('caries', 'secondary_caries', 'bone_loss', 'furcation_involvement', 'periapical_lesion', 'root_resorption', 'calculus', 'crown_fracture', 'root_fracture', 'impacted_tooth', 'over_eruption', 'open_contact', 'overhang', 'crown_needed', 'implant_needed');--> statement-breakpoint
CREATE TABLE "imaging_finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"image_id" uuid NOT NULL,
	"annotation_id" uuid,
	"treatment_id" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"type" "imaging_finding_type" NOT NULL,
	"status" "imaging_finding_status" DEFAULT 'suspected' NOT NULL,
	"tooth_number" integer,
	"surfaces" jsonb,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "imaging_finding" ADD CONSTRAINT "imaging_finding_image_id_imaging_study_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."imaging_study_image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_finding" ADD CONSTRAINT "imaging_finding_annotation_id_imaging_annotation_id_fk" FOREIGN KEY ("annotation_id") REFERENCES "public"."imaging_annotation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imaging_finding_image_status_idx" ON "imaging_finding" USING btree ("image_id","status");