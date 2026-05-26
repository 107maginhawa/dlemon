CREATE TABLE "dental_occlusion_screening" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid,
	"angle_class" text,
	"overbite_mm" integer,
	"overjet_mm" integer,
	"crossbite" boolean DEFAULT false,
	"crowding" boolean DEFAULT false,
	"spacing" boolean DEFAULT false,
	"midline_deviation" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dental_postop_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dental_occlusion_screening" ADD CONSTRAINT "dental_occlusion_screening_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_postop_template" ADD CONSTRAINT "dental_postop_template_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_occlusion_patient_idx" ON "dental_occlusion_screening" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_postop_template_branch_idx" ON "dental_postop_template" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "dental_postop_template_category_idx" ON "dental_postop_template" USING btree ("category");