import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { markJobCompleted, markJobFailed } from "../services/outbox.js";
import { bookShipmentForOrder } from "../services/shipments.js";
import { generateInvoiceForOrder } from "../services/invoice/invoice-service.js";
import { sendOrderConfirmedWhatsApp } from "../services/notifications/notification-service.js";

export async function processDueJobs(limit = 10) {
  const jobs = await prisma.outboxJob.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit
  });
  for (const job of jobs) {
    const locked = await prisma.outboxJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } }
    });
    if (!locked.count) continue;
    const attempts = job.attempts + 1;
    try {
      if (job.jobType === "BOOK_SHIPMENT") {
        await bookShipmentForOrder(job.entityId);
      } else if (job.jobType === "GENERATE_INVOICE") {
        await generateInvoiceForOrder(job.entityId);
        await import("../services/outbox.js").then(({ enqueueJob }) => enqueueJob("SEND_WHATSAPP_ORDER_CONFIRMED", job.entityId, {}));
      } else if (job.jobType === "SEND_WHATSAPP_ORDER_CONFIRMED") {
        await sendOrderConfirmedWhatsApp(job.entityId);
      } else {
        throw new Error(`Unknown job type: ${job.jobType}`);
      }
      await markJobCompleted(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ jobId: job.id, jobType: job.jobType, err: message }, "outbox job failed");
      await markJobFailed(job.id, attempts, message, attempts >= env.MAX_JOB_ATTEMPTS);
    }
  }
  return { processed: jobs.length };
}

export function startOutboxWorker() {
  if (env.NODE_ENV === "test") return undefined;
  const timer = setInterval(() => {
    processDueJobs().catch((error) => logger.error({ err: error }, "outbox loop failed"));
  }, env.OUTBOX_POLL_INTERVAL_MS);
  timer.unref();
  return timer;
}
