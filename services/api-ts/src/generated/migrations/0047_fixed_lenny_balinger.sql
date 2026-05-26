CREATE TABLE "dental_operatory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dental_operatory" ADD CONSTRAINT "dental_operatory_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_operatory_branch_id_idx" ON "dental_operatory" USING btree ("branch_id");--> statement-breakpoint
ALTER TABLE "dental_appointment" ADD CONSTRAINT "dental_appointment_operatory_id_dental_operatory_id_fk" FOREIGN KEY ("operatory_id") REFERENCES "public"."dental_operatory"("id") ON DELETE set null ON UPDATE no action;