import { prisma } from "../prisma.js";
import type { Tx } from "./economyService.js";

export type Severity = "INFO" | "WARNING" | "CRITICAL";

export type NotificationInput = {
  userId: string;
  title: string;
  body: string;
  severity: Severity;
  heistId?: string;
};

type NotifyClient = Tx | typeof prisma;

/**
 * Single writer for player-facing alerts. Pass a transaction client when the
 * alert must land with the money move that caused it.
 */
export async function writeNotification(client: NotifyClient, input: NotificationInput): Promise<void> {
  await client.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      severity: input.severity,
      heistId: input.heistId,
    },
  });
  const stale = await client.notification.findMany({
    where: { userId: input.userId },
    orderBy: { createdAt: "desc" },
    skip: 10,
    select: { id: true },
  });
  if (stale.length > 0) {
    await client.notification.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}

export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.notification.updateMany({
    where: { userId, id: { in: ids }, read: false },
    data: { read: true },
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const row = await prisma.notification.findFirst({ where: { id: notificationId, userId } });
  if (!row) return null;
  if (!row.read) {
    await prisma.notification.update({ where: { id: row.id }, data: { read: true } });
  }
  return { id: row.id, read: true };
}

const HEAT_TITLES = ["Heat check", "Cash seized", "Heat cleared", "Heat is high"];

export async function listNotifications(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputationLevel: true, vaultCreditCard: true },
  });
  if (user && (user.vaultCreditCard || user.reputationLevel >= 11)) {
    await prisma.notification.updateMany({
      where: { userId, title: { in: HEAT_TITLES }, read: false },
      data: { read: true },
    });
  }
  const rows = await prisma.notification.findMany({
    where: {
      userId,
      ...(user && (user.vaultCreditCard || user.reputationLevel >= 11) ? { title: { notIn: HEAT_TITLES } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    severity: normalizeSeverity(row.severity),
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }));
}

function normalizeSeverity(value: string): Severity {
  return value === "WARNING" || value === "CRITICAL" ? value : "INFO";
}
