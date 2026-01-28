-- Backfill: mark existing content as PUBLISHED
-- Assumption: legacy drafts have been deleted (per product decision).

UPDATE "Blog" SET "status" = 'PUBLISHED';
UPDATE "CaseStudy" SET "status" = 'PUBLISHED';
UPDATE "Newsletter" SET "status" = 'PUBLISHED';

