-- Add subtitle field to content tables
ALTER TABLE "Newsletter" ADD COLUMN "subtitle" TEXT;
ALTER TABLE "Blog" ADD COLUMN "subtitle" TEXT;
ALTER TABLE "CaseStudy" ADD COLUMN "subtitle" TEXT;

