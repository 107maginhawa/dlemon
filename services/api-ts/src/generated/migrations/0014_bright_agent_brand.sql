CREATE TABLE "dental_consent_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"requires_witness_signature" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dental_consent_template_branch_id_idx" ON "dental_consent_template" USING btree ("branch_id");