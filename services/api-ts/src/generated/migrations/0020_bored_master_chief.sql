CREATE TYPE "public"."imaging_annotation_type" AS ENUM('line', 'angle', 'area', 'label', 'arrow', 'freehand', 'shape', 'tooth');--> statement-breakpoint
CREATE TYPE "public"."imaging_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."imaging_modality" AS ENUM('periapical', 'bitewing', 'panoramic', 'cephalometric', 'intraoral_photo', 'extraoral_photo', 'other');--> statement-breakpoint
CREATE TABLE "imaging_annotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"image_id" uuid NOT NULL,
	"type" "imaging_annotation_type" NOT NULL,
	"geometry" jsonb NOT NULL,
	"measurement_value" real,
	"measurement_unit" text,
	"tooth_number" integer,
	"visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imaging_study" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"branch_id" uuid NOT NULL,
	"acquired_by" uuid NOT NULL,
	"modality" "imaging_modality" DEFAULT 'other' NOT NULL,
	"status" "imaging_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imaging_study_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"study_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"pixel_spacing_mm" real,
	"sequence_number" integer DEFAULT 0 NOT NULL,
	"dicom_metadata" jsonb,
	"modality" "imaging_modality" DEFAULT 'other' NOT NULL,
	"status" "imaging_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imaging_study_tooth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_id" uuid NOT NULL,
	"tooth_number" integer NOT NULL,
	"numbering_system" text DEFAULT 'universal' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "imaging_annotation" ADD CONSTRAINT "imaging_annotation_image_id_imaging_study_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."imaging_study_image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD CONSTRAINT "imaging_study_image_study_id_imaging_study_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."imaging_study"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_study_tooth" ADD CONSTRAINT "imaging_study_tooth_image_id_imaging_study_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."imaging_study_image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imaging_annotation_image_visible_idx" ON "imaging_annotation" USING btree ("image_id","visible");