CREATE TYPE "public"."imaging_link_type" AS ENUM('treatment_plan', 'ortho_case', 'report');--> statement-breakpoint
CREATE TABLE "imaging_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"image_id" uuid NOT NULL,
	"link_type" "imaging_link_type" NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "imaging_link_image_type_target_uniq" UNIQUE("image_id","link_type","target_id")
);
--> statement-breakpoint
ALTER TABLE "imaging_link" ADD CONSTRAINT "imaging_link_image_id_imaging_study_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."imaging_study_image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imaging_link_image_idx" ON "imaging_link" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "imaging_link_target_idx" ON "imaging_link" USING btree ("target_id");