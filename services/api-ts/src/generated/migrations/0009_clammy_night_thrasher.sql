ALTER TABLE "patient" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "emergency_contact" jsonb;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "communication_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "recall_date" text;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "recall_note" text;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "follow_up_notes" jsonb DEFAULT '[]'::jsonb;