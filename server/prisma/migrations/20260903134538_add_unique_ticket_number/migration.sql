-- AlterEnum
ALTER TYPE "Priority" ADD VALUE 'CRITICAL';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "RelatedSystem" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
