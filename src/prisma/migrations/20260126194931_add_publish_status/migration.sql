-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Blog" ADD COLUMN     "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "CaseStudy" ADD COLUMN     "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Newsletter" ADD COLUMN     "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT';
