import Razorpay from "razorpay";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { AppError, assertApp } from "../../utils/errors.js";
import { hmacSha256Hex, timingSafeEqualText } from "../../utils/crypto.js";

export function verifyRazorpayCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }) {
  assertApp(env.RAZORPAY_KEY_SECRET || env.NODE_ENV !== "production", "Razorpay secret is not configured.", 503, "RAZORPAY_NOT_CONFIGURED");
  const expected = hmacSha256Hex(env.RAZORPAY_KEY_SECRET || "dev_secret", `${input.orderId}|${input.paymentId}`);
  return timingSafeEqualText(expected, input.signature);
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string | undefined) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    if (env.NODE_ENV === "production") throw new AppError("Razorpay webhook secret is not configured.", 503, "RAZORPAY_WEBHOOK_NOT_CONFIGURED");
    return signature === "dev-valid-signature";
  }
  if (!signature) return false;
  const expected = hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  return timingSafeEqualText(expected, signature);
}

export async function createRazorpayOrder(publicOrderId: string) {
  const order = await prisma.order.findUnique({ where: { publicOrderId }, include: { payments: true, customer: true } });
  assertApp(order, "Order not found.", 404, "ORDER_NOT_FOUND");
  assertApp(order.paymentMethod === "PREPAID", "Razorpay is only for prepaid orders.", 400, "NOT_PREPAID");
  assertApp(["PENDING", "FAILED"].includes(order.paymentStatus), "Order is not payable.", 409, "ORDER_NOT_PAYABLE");

  const existing = order.payments.find((payment) => payment.provider === "razorpay" && payment.providerOrderId);
  if (existing?.providerOrderId) {
    return {
      key: env.RAZORPAY_KEY_ID || "rzp_test_mock",
      orderId: existing.providerOrderId,
      amount: order.totalPaise,
      currency: order.currency,
      name: "CRUNCHH",
      description: `Order ${order.publicOrderId}`,
      prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.mobile.replace("+91", "") }
    };
  }

  let providerOrderId = `order_mock_${order.publicOrderId}`;
  let raw: unknown = { mock: true };
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const razorpay = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
    raw = await razorpay.orders.create({
      amount: order.totalPaise,
      currency: order.currency,
      receipt: order.publicOrderId,
      payment_capture: env.RAZORPAY_AUTO_CAPTURE,
      notes: { publicOrderId: order.publicOrderId }
    });
    providerOrderId = String((raw as { id: string }).id);
  }

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: "razorpay",
      providerOrderId,
      amountPaise: order.totalPaise,
      status: "PENDING",
      rawResponseJson: raw as object
    }
  });

  return {
    key: env.RAZORPAY_KEY_ID || "rzp_test_mock",
    orderId: providerOrderId,
    amount: order.totalPaise,
    currency: order.currency,
    name: "CRUNCHH",
    description: `Order ${order.publicOrderId}`,
    prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.mobile.replace("+91", "") }
  };
}

export async function markRazorpayPaymentVerified(input: {
  publicOrderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const valid = verifyRazorpayCheckoutSignature({
    orderId: input.razorpay_order_id,
    paymentId: input.razorpay_payment_id,
    signature: input.razorpay_signature
  });
  assertApp(valid, "Invalid Razorpay signature.", 400, "INVALID_RAZORPAY_SIGNATURE");
  const order = await prisma.order.findUnique({ where: { publicOrderId: input.publicOrderId } });
  assertApp(order, "Order not found.", 404, "ORDER_NOT_FOUND");
  await prisma.payment.upsert({
    where: { provider_providerPaymentId: { provider: "razorpay", providerPaymentId: input.razorpay_payment_id } },
    update: { providerSignature: input.razorpay_signature, status: "AUTHORIZED" },
    create: {
      orderId: order.id,
      provider: "razorpay",
      providerOrderId: input.razorpay_order_id,
      providerPaymentId: input.razorpay_payment_id,
      providerSignature: input.razorpay_signature,
      amountPaise: order.totalPaise,
      status: "AUTHORIZED"
    }
  });
  return { verified: true, authoritativeStatus: order.paymentStatus };
}
