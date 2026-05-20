CREATE TYPE "public"."ceph_analysis_type" AS ENUM('steiner_hybrid_sn');--> statement-breakpoint
CREATE TYPE "public"."ceph_calibration_method" AS ENUM('dicom_tag', 'manual_ruler', 'assumed_default', 'not_calibrated');--> statement-breakpoint
CREATE TYPE "public"."ceph_landmark_source" AS ENUM('manual', 'ai', 'ai_corrected');--> statement-breakpoint
CREATE TYPE "public"."ceph_landmark_status" AS ENUM('placed', 'confirmed', 'locked');--> statement-breakpoint
CREATE TABLE "imaging_ceph_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"image_id" uuid NOT NULL,
	"analysis_type" "ceph_analysis_type" DEFAULT 'steiner_hybrid_sn' NOT NULL,
	"measurements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"calibration_value" real,
	"calibration_method" "ceph_calibration_method" DEFAULT 'not_calibrated' NOT NULL,
	"calibrated_at" timestamp,
	"calibrated_by" text,
	CONSTRAINT "imaging_ceph_analysis_image_type_uniq" UNIQUE("image_id","analysis_type")
);
--> statement-breakpoint
CREATE TABLE "imaging_ceph_landmark" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"image_id" uuid NOT NULL,
	"landmark_code" text NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"source" "ceph_landmark_source" DEFAULT 'manual' NOT NULL,
	"confidence" real,
	"status" "ceph_landmark_status" DEFAULT 'placed' NOT NULL,
	CONSTRAINT "imaging_ceph_landmark_image_code_uniq" UNIQUE("image_id","landmark_code")
);
--> statement-breakpoint
CREATE TABLE "imaging_ceph_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"image_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	CONSTRAINT "imaging_ceph_report_image_version_uniq" UNIQUE("image_id","version")
);
--> statement-breakpoint
ALTER TABLE "imaging_ceph_analysis" ADD CONSTRAINT "imaging_ceph_analysis_image_id_imaging_study_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."imaging_study_image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_ceph_landmark" ADD CONSTRAINT "imaging_ceph_landmark_image_id_imaging_study_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."imaging_study_image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_ceph_report" ADD CONSTRAINT "imaging_ceph_report_image_id_imaging_study_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."imaging_study_image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imaging_ceph_landmark_image_idx" ON "imaging_ceph_landmark" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "imaging_ceph_report_image_idx" ON "imaging_ceph_report" USING btree ("image_id");