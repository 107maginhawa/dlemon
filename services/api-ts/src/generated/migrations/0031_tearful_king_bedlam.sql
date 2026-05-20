CREATE TABLE "visit_note_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"note_id" uuid NOT NULL,
	CONSTRAINT "visit_note_version_note_version_uniq" UNIQUE("note_id","version")
);
--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "signed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "signed_at" timestamp;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "signed_by" uuid;--> statement-breakpoint
ALTER TABLE "visit_notes" ADD COLUMN "locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "visit_note_version" ADD CONSTRAINT "visit_note_version_note_id_visit_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."visit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visit_note_version_note_id_idx" ON "visit_note_version" USING btree ("note_id");