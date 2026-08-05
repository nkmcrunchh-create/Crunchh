import { OutboxStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export async function enqueueJob(jobType: string, entityId: string, payloadJson: object = {}) {
  const existing = await prisma.outboxJob.findFirst({
    where: { jobType, entityId, status: { in: ["PENDING", "PROCESSING"] } }
  });
  if (existing) return existing;
  return prisma.outboxJob.create({ data: { jobType, entityId, payloadJson } });
}

export function nextRetryDate(attempts: number) {
  const seconds = Math.min(3600, 2 ** attempts * 10);
  return new Date(Date.now() + seconds * 1000);
}

export async function markJobFailed(id: string, attempts: number, lastError: string, terminal = false) {
  return prisma.outboxJob.update({
    where: { id },
    data: {
      status: terminal ? "FAILED" : "PENDING",
      attempts,
      lockedAt: null,
      nextAttemptAt: terminal ? new Date("2999-01-01") : nextRetryDate(attempts),
      lastError
    }
  });
}

export async function markJobCompleted(id: string) {
  return prisma.outboxJob.update({
    where: { id },
    data: { status: "COMPLETED" as OutboxStatus, completedAt: new Date(), lockedAt: null }
  });
}
