import { prisma } from "../db/prisma.js";
import { sha256Hex } from "../utils/crypto.js";
import { markPaymentCaptured, markPaymentFailed } from "./payments.js";
import { applyShipmentEvent } from "./shipments.js";

export async function recordWebhook(provider: string, externalEventId: string, eventType: string, payload: unknown, raw: Buffer) {
  const payloadHash = sha256Hex(raw);
  return prisma.webhookEvent.upsert({
    where: { provider_externalEventId: { provider, externalEventId } },
    update: {},
    create: {
      provider,
      externalEventId,
      eventType,
      payloadHash,
      payloadJson: payload as object
    }
  });
}

export async function processRazorpayWebhook(eventId: string, payload: any) {
  const type = payload.event || payload.type;
  if (type === "payment.captured" || type === "order.paid") {
    const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity || payload;
    const providerOrderId = entity.order_id || entity.id;
    const providerPaymentId = entity.id && String(entity.id).startsWith("pay_") ? entity.id : entity.payment_id;
    const amountPaise = Number(entity.amount_paid ?? entity.amount);
    await markPaymentCaptured({ provider: "razorpay", providerOrderId, providerPaymentId, amountPaise, raw: payload });
  } else if (type === "payment.failed") {
    const entity = payload.payload?.payment?.entity || payload;
    await markPaymentFailed(entity.order_id, entity.id, payload);
  }
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { processingStatus: "PROCESSED", attempts: { increment: 1 }, processedAt: new Date() }
  });
}

export async function processNimbusPostWebhook(eventId: string, payload: any) {
  await applyShipmentEvent({
    awb: payload.awb || payload.data?.awb,
    externalShipmentId: payload.shipment_id || payload.data?.shipment_id,
    providerStatus: payload.status || payload.data?.status,
    description: payload.description || payload.data?.description,
    location: payload.location || payload.data?.location,
    eventTime: payload.event_time || payload.data?.event_time,
    raw: payload
  });
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { processingStatus: "PROCESSED", attempts: { increment: 1 }, processedAt: new Date() }
  });
}
