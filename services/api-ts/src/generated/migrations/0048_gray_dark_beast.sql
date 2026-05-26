CREATE TABLE "dental_procedure_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"cdt_code" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"default_fee_php" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "dental_procedure_code_cdt_code_unique" UNIQUE("cdt_code")
);
--> statement-breakpoint
CREATE INDEX "dental_procedure_code_cdt_idx" ON "dental_procedure_code" USING btree ("cdt_code");--> statement-breakpoint
CREATE INDEX "dental_procedure_code_category_idx" ON "dental_procedure_code" USING btree ("category");