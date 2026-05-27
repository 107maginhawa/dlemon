CREATE TYPE "public"."chart_layer" AS ENUM('baseline', 'proposed', 'completed');--> statement-breakpoint
ALTER TABLE "dental_chart" ADD COLUMN "layer" chart_layer DEFAULT 'proposed' NOT NULL;