CREATE TABLE "imaging_calibration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"version" integer NOT NULL,
	"image_id" uuid NOT NULL,
	"point_a" jsonb NOT NULL,
	"point_b" jsonb NOT NULL,
	"known_distance_mm" real NOT NULL,
	"pixel_distance" real NOT NULL,
	"pixel_spacing_mm" real NOT NULL,
	"method" text DEFAULT 'manual_ruler' NOT NULL,
	CONSTRAINT "imaging_calibration_image_version_uniq" UNIQUE("image_id","version")
);
--> statement-breakpoint
ALTER TABLE "imaging_calibration" ADD CONSTRAINT "imaging_calibration_image_id_imaging_study_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."imaging_study_image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imaging_calibration_image_idx" ON "imaging_calibration" USING btree ("image_id");