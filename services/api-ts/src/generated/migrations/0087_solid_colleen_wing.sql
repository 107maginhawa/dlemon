ALTER TABLE "imaging_finding" ADD COLUMN "frame_index" integer;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "is_volume" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "slice_thickness_mm" real;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "frame_count" integer;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "series_instance_uid" text;--> statement-breakpoint
ALTER TABLE "imaging_study_image" ADD COLUMN "study_instance_uid" text;