import type { Prisma } from "@prisma/client";
import { GameError } from "../game/errors.js";

export type Tx = Prisma.TransactionClient;

export function assertPositiveInteger(amount: number, label = "Amount"): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new GameError(400, "INVALID_AMOUNT", `${label} must be a positive integer.`);
  }
}

/** Conditional cash debit. Fails closed when the wallet cannot cover the amount. */
export async function debitCash(tx: Tx, userId: string, amount: number): Promise<void> {
  assertPositiveInteger(amount, "Cash amount");
  const updated = await tx.user.updateMany({
    where: { id: userId, cash: { gte: amount } },
    data: { cash: { decrement: amount } },
  });
  if (updated.count !== 1) {
    throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough cash.");
  }
}

export async function creditCash(tx: Tx, userId: string, amount: number): Promise<void> {
  assertPositiveInteger(amount, "Cash amount");
  await tx.user.update({
    where: { id: userId },
    data: { cash: { increment: amount } },
  });
}

/**
 * Conditional vault debit used by heists and withdrawals.
 * Returns false when the row no longer has the funds, so two jobs cannot overdraw.
 */
export async function debitVault(tx: Tx, userId: string, amount: number): Promise<boolean> {
  assertPositiveInteger(amount, "Vault amount");
  const updated = await tx.vault.updateMany({
    where: { userId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  return updated.count === 1;
}
