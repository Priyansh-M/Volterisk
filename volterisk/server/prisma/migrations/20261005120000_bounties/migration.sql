-- CreateTable
CREATE TABLE "Bounty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "posterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "hunterId" TEXT,
    "huntStartedAt" DATETIME,
    "heistId" TEXT,
    "claimedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bounty_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bounty_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bounty_hunterId_fkey" FOREIGN KEY ("hunterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Bounty_status_createdAt_idx" ON "Bounty"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Bounty_posterId_targetId_status_idx" ON "Bounty"("posterId", "targetId", "status");

-- CreateIndex
CREATE INDEX "Bounty_hunterId_status_idx" ON "Bounty"("hunterId", "status");

-- CreateIndex
CREATE INDEX "Bounty_targetId_status_idx" ON "Bounty"("targetId", "status");
