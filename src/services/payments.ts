import { prisma } from "../db/prisma.js";
import { AppError, assertApp } from "../utils/errors.js";
import { enqueueJob } from "./outbox.js";

export async function markPaymentCaptured(input: {
  provider: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  amountPaise: number;
  raw?: unknown;
}) {
  const selectors = [
    input.providerPaymentId ? { providerPaymentId: input.providerPaymentId } : undefined,
    input.providerOrderId ? { providerOrderId: input.providerOrderId } : undefined
  ].filter(Boolean) as Array<{ providerPaymentId?: string; providerOrderId?: string }>;
  assertApp(selectors.length, "Provider payment or order ID is required.", 400, "PAYMENT_SELECTOR_REQUIRED");
  const payment = await prisma.payment.findFirst({
    where: {
      provider: input.provider,
      OR: selectors
    },
    include: { order: true }
  });
  assertApp(payment, "Payment record not found.", 404, "PAYMENT_NOT_FOUND");
  if (payment.order.paymentStatus === "CAPTURED") return payment.order;
  if (input.amountPaise !== payment.order.totalPaise) {
    throw new AppError("Captured amount does not match order total.", 409, "AMOUNT_MISMATCH");
  }
  const order = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: input.providerPaymentId || payment.providerPaymentId,
        amountPaise: input.amountPaise,
        status: "CAPTURED",
        capturedAt: new Date(),
        rawResponseJson: input.raw as object
      }
    });
    return tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "CAPTURED", fulfilmentStatus: "PAYMENT_CONFIRMED", confirmedAt: new Date() }
    });
  });
  await enqueueJob("BOOK_SHIPMENT", order.id, { publicOrderId: order.publicOrderId });
  return order;
}

export async function markPaymentFailed(providerOrderId: string | undefined, providerPaymentId: string | undefined, raw: unknown) {
  const selectors = [
    providerPaymentId ? { providerPaymentId } : undefined,
    providerOrderId ? { providerOrderId } : undefined
  ].filter(Boolean) as Array<{ providerPaymentId?: string; providerOrderId?: string }>;
  if (!selectors.length) return null;
  const payment = await prisma.payment.findFirst({
    where: {
      provider: "razorpay",
      OR: selectors
    }
  });
  if (!payment) return null;
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", rawResponseJson: raw as object } });
  return prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: "FAILED" } });
}
