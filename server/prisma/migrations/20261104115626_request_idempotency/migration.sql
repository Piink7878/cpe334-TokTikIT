-- CreateTable
CREATE TABLE "RequestIdempotency" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestIdempotency_expiresAt_idx" ON "RequestIdempotency"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestIdempotency_userId_endpoint_key_key" ON "RequestIdempotency"("userId", "endpoint", "key");
