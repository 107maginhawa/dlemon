CREATE TYPE "public"."imaging_tier" AS ENUM('free', 'basic', 'addon');--> statement-breakpoint
ALTER TABLE "dental_organization" ADD COLUMN "imaging_tier" "imaging_tier";