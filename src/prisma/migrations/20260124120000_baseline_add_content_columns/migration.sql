-- Baseline migration: Add content columns (already exist in DB, marking as applied)
-- This migration represents the state after the previous refactor where content columns were added

-- AlterTable
ALTER TABLE "Newsletter" ADD COLUMN IF NOT EXISTS "content" JSONB;

-- AlterTable
ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "content" JSONB;

-- AlterTable
ALTER TABLE "CaseStudy" ADD COLUMN IF NOT EXISTS "content" JSONB;
