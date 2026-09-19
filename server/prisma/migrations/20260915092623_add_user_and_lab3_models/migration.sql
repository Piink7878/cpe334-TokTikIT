-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMIN');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "newRequesterId" TEXT,
ADD COLUMN "ownerId" TEXT;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_newRequesterId_fkey" FOREIGN KEY ("newRequesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================================
-- CUSTOM DATA MIGRATION: Preserve Data & Replace DevelopmentRequester
-- =========================================================================

-- 1. Replace Status Enum entirely to drop 'PENDING' and add new values safely in transaction
ALTER TYPE "Status" RENAME TO "Status_old";
CREATE TYPE "Status" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');
ALTER TABLE "Ticket" ALTER COLUMN "currentStatus" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "currentStatus" TYPE "Status" USING (
  CASE 
    WHEN "currentStatus"::text = 'PENDING' THEN 'WAITING_FOR_REQUESTER'::"Status"
    ELSE "currentStatus"::text::"Status"
  END
);
ALTER TABLE "Ticket" ALTER COLUMN "currentStatus" SET DEFAULT 'NEW';
DROP TYPE "Status_old";

-- 2. Migrate DevelopmentRequester to User
INSERT INTO "User" ("id", "email", "passwordHash", "fullName", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    "email",
    '$2a$10$wE/.c4Gk0u.O8x/2Hk/b3eA5gK1xN8n3L1u4N4s7O9n0B4q0P4U1G',
    "name",
    'REQUESTER'::"Role",
    "isActive",
    true,
    "createdAt",
    "updatedAt"
FROM "DevelopmentRequester";

-- 3. Map newRequesterId in Ticket based on email matching
UPDATE "Ticket" t
SET "newRequesterId" = u."id"
FROM "DevelopmentRequester" dr
JOIN "User" u ON u."email" = dr."email"
WHERE t."requesterId" = dr."id";

-- 4. Set Ticket.itPriority = Ticket.requestedPriority
UPDATE "Ticket" SET "itPriority" = "requestedPriority";

-- 5. Drop the old foreign key and column from Ticket
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Ticket" DROP COLUMN "requesterId";

-- 6. Rename the new column to 'requesterId'
ALTER TABLE "Ticket" RENAME COLUMN "newRequesterId" TO "requesterId";

-- 7. Rename the constraint to match Prisma expectations
ALTER TABLE "Ticket" RENAME CONSTRAINT "Ticket_newRequesterId_fkey" TO "Ticket_requesterId_fkey";

-- 8. Enforce NOT NULL on the new requesterId column
ALTER TABLE "Ticket" ALTER COLUMN "requesterId" SET NOT NULL;

-- 9. Drop DevelopmentRequester table
DROP TABLE "DevelopmentRequester";
