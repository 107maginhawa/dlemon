ALTER TABLE "patient" ADD COLUMN "preferred_branch_id" uuid;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "dental_history_summary" text;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "needs_follow_up" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "patient" ADD COLUMN "has_active_payment_plan" boolean DEFAULT false;