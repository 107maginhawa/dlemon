CREATE TABLE "dental_inventory_adjustment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"item_id" uuid NOT NULL,
	"adjustment_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "dental_inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 10 NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "dental_inventory_adjustment" ADD CONSTRAINT "dental_inventory_adjustment_item_id_dental_inventory_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."dental_inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dental_inventory_item" ADD CONSTRAINT "dental_inventory_item_branch_id_dental_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."dental_branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dental_inventory_adjustment_item_idx" ON "dental_inventory_adjustment" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "dental_inventory_item_branch_idx" ON "dental_inventory_item" USING btree ("branch_id");