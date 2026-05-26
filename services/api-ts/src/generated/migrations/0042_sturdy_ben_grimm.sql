CREATE TABLE "dental_recall" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"patient_id" uuid NOT NULL,
	"type" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"sent_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "dental_recall" ADD CONSTRAINT "dental_recall_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_recall_patient_idx" ON "dental_recall" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dental_recall_status_idx" ON "dental_recall" USING btree ("status");