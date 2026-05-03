CREATE TABLE "dental_treatment_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"items" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dental_treatment_template_branch_id_idx" ON "dental_treatment_template" USING btree ("branch_id");