-- AlterTable
ALTER TABLE "Bounty" ADD COLUMN "funded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Bounty" ADD COLUMN "goal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Bounty" ADD COLUMN "stolenTotal" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows
UPDATE "Bounty" SET "funded" = "amount", "goal" = "amount" WHERE "funded" = 0 OR "goal" = 0;

-- CreateTable
CREATE TABLE "BountyFund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bountyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BountyFund_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "Bounty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BountyFund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BountyFund_bountyId_idx" ON "BountyFund"("bountyId");
CREATE INDEX "BountyFund_userId_idx" ON "BountyFund"("userId");
