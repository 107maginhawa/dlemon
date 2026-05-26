CREATE TABLE "dental_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"task_type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" text,
	"assigned_to" uuid,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "dental_task" ADD CONSTRAINT "dental_task_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_task_patient_idx" ON "dental_task" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_task_status_idx" ON "dental_task" USING btree ("status");