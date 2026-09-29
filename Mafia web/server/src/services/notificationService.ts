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

/**
 * Single writer for player-facing alerts. Pass a transaction client when the
 * alert must land with the money move that caused it.
 */
export async function writeNotification(client: Tx, input: NotificationInput): Promise<void> {
  await client.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      severity: input.severity,
      heistId: input.heistId,
    },
  });
}

export async function listNotifications(userId: string) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
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
