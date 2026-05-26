CREATE TABLE "dental_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"local_id" text NOT NULL,
	"server_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"branch_id" text,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"last_sync_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "dental_sync_log_entity_idx" ON "dental_sync_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "dental_sync_log_status_idx" ON "dental_sync_log" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "dental_sync_log_local_idx" ON "dental_sync_log" USING btree ("local_id");