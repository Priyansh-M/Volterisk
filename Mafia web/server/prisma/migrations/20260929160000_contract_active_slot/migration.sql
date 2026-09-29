-- AlterTable
ALTER TABLE "ContractRun" ADD COLUMN "activeSlot" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ContractRun_activeSlot_key" ON "ContractRun"("activeSlot");
