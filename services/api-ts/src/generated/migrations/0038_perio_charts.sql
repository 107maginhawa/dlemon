CREATE TYPE "public"."dental_perio_chart_status" AS ENUM('draft', 'completed', 'locked');--> statement-breakpoint
CREATE TABLE "dental_perio_chart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"examiner_member_id" uuid NOT NULL,
	"status" "dental_perio_chart_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"completed_at" timestamp,
	"summary_bop_percent" numeric(5, 2),
	"summary_mean_depth" numeric(5, 2),
	"summary_deep_pocket_count" integer
);
--> statement-breakpoint
CREATE TABLE "dental_perio_tooth_reading" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"chart_id" uuid NOT NULL,
	"tooth_number" smallint NOT NULL,
	"depth_bm" smallint,
	"depth_bc" smallint,
	"depth_bd" smallint,
	"depth_lm" smallint,
	"depth_lc" smallint,
	"depth_ld" smallint,
	"bop_bm" boolean,
	"bop_bc" boolean,
	"bop_bd" boolean,
	"bop_lm" boolean,
	"bop_lc" boolean,
	"bop_ld" boolean,
	"recession" smallint,
	"mobility" smallint DEFAULT 0 NOT NULL,
	"furcation" smallint DEFAULT 0 NOT NULL,
	"plaque" boolean DEFAULT false NOT NULL,
	"suppuration" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "dental_perio_chart" ADD CONSTRAINT "dental_perio_chart_visit_id_dental_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."dental_visit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_perio_chart" ADD CONSTRAINT "dental_perio_chart_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_perio_chart" ADD CONSTRAINT "dental_perio_chart_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_perio_tooth_reading" ADD CONSTRAINT "dental_perio_tooth_reading_chart_id_dental_perio_chart_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."dental_perio_chart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dental_perio_chart_visit_unique" ON "dental_perio_chart" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "dental_perio_chart_patient_idx" ON "dental_perio_chart" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_perio_chart_branch_idx" ON "dental_perio_chart" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dental_perio_tooth_reading_chart_tooth_unique" ON "dental_perio_tooth_reading" USING btree ("chart_id","tooth_number");--> statement-breakpoint
CREATE INDEX "dental_perio_tooth_reading_chart_idx" ON "dental_perio_tooth_reading" USING btree ("chart_id");
