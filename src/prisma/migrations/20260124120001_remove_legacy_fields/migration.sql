-- Remove legacy fields: description and imagePath
-- Make content column required (NOT NULL)

-- First, ensure all rows have content (set to empty doc if null)
UPDATE "Newsletter" SET "content" = '{"type":"doc","content":[]}'::jsonb WHERE "content" IS NULL;
UPDATE "Blog" SET "content" = '{"type":"doc","content":[]}'::jsonb WHERE "content" IS NULL;
UPDATE "CaseStudy" SET "content" = '{"type":"doc","content":[]}'::jsonb WHERE "content" IS NULL;

-- AlterTable Newsletter: Drop columns and make content required
ALTER TABLE "Newsletter" DROP COLUMN IF EXISTS "description";
ALTER TABLE "Newsletter" DROP COLUMN IF EXISTS "imagePath";
ALTER TABLE "Newsletter" ALTER COLUMN "content" SET NOT NULL;

-- AlterTable Blog: Drop columns and make content required
ALTER TABLE "Blog" DROP COLUMN IF EXISTS "description";
ALTER TABLE "Blog" DROP COLUMN IF EXISTS "imagePath";
ALTER TABLE "Blog" ALTER COLUMN "content" SET NOT NULL;

-- AlterTable CaseStudy: Drop columns and make content required
ALTER TABLE "CaseStudy" DROP COLUMN IF EXISTS "description";
ALTER TABLE "CaseStudy" DROP COLUMN IF EXISTS "imagePath";
ALTER TABLE "CaseStudy" ALTER COLUMN "content" SET NOT NULL;
