CREATE TABLE "dental_chart_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"chart_id" uuid NOT NULL,
	CONSTRAINT "dental_chart_version_chart_version_uniq" UNIQUE("chart_id","version")
);
--> statement-breakpoint
ALTER TABLE "dental_chart_version" ADD CONSTRAINT "dental_chart_version_chart_id_dental_chart_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."dental_chart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_chart_version_chart_idx" ON "dental_chart_version" USING btree ("chart_id");