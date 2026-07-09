-- CreateTable: sandboxes (training/sandbox mode)
CREATE TABLE "sandboxes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sampleSize" TEXT NOT NULL DEFAULT 'MEDIUM',
    "resetCount" INTEGER NOT NULL DEFAULT 0,
    "resetToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sandboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sandboxes_companyId_key" ON "sandboxes"("companyId");
CREATE INDEX "sandboxes_createdAt_idx" ON "sandboxes"("createdAt");
