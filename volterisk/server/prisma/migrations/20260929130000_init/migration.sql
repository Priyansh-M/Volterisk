-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "usernameKey" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "cash" INTEGER NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    CONSTRAINT "Vault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Weapon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "UserWeapon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "weaponId" TEXT NOT NULL,
    "upgradeLevel" INTEGER NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserWeapon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserWeapon_weaponId_fkey" FOREIGN KEY ("weaponId") REFERENCES "Weapon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Heist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attackerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "weaponId" TEXT NOT NULL,
    "weaponLevel" INTEGER NOT NULL,
    "vaultLevel" INTEGER NOT NULL,
    "successChance" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "amountStolen" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Heist_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Heist_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Heist_weaponId_fkey" FOREIGN KEY ("weaponId") REFERENCES "Weapon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "heistId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_heistId_fkey" FOREIGN KEY ("heistId") REFERENCES "Heist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "heistId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_heistId_fkey" FOREIGN KEY ("heistId") REFERENCES "Heist" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameKey_key" ON "User"("usernameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_userId_key" ON "Vault"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Weapon_number_key" ON "Weapon"("number");

-- CreateIndex
CREATE INDEX "UserWeapon_userId_equipped_idx" ON "UserWeapon"("userId", "equipped");

-- CreateIndex
CREATE UNIQUE INDEX "UserWeapon_userId_weaponId_key" ON "UserWeapon"("userId", "weaponId");

-- CreateIndex
CREATE INDEX "Heist_attackerId_createdAt_idx" ON "Heist"("attackerId", "createdAt");

-- CreateIndex
CREATE INDEX "Heist_targetId_success_createdAt_idx" ON "Heist"("targetId", "success", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_heistId_key" ON "Transaction"("heistId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_heistId_key" ON "Notification"("heistId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

