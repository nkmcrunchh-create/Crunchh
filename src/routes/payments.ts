import { Router } from "express";
import { env } from "../config/env.js";
import { razorpayOrderSchema, razorpayVerifySchema } from "../utils/validation.js";
import { createRazorpayOrder, markRazorpayPaymentVerified } from "../services/razorpay/razorpay-service.js";
import { hmacSha256Hex } from "../utils/crypto.js";
import { prisma } from "../db/prisma.js";
import { markPaymentCaptured } from "../services/payments.js";
import { AppError } from "../utils/errors.js";

export const paymentsRouter = Router();

paymentsRouter.post("/api/payments/razorpay/order", async (req, res, next) => {
  try {
    const parsed = razorpayOrderSchema.parse(req.body);
    res.json(await createRazorpayOrder(parsed.publicOrderId));
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post("/api/payments/razorpay/verify", async (req, res, next) => {
  try {
    const parsed = razorpayVerifySchema.parse(req.body);
    res.json(await markRazorpayPaymentVerified(parsed));
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post("/api/dev/mock-razorpay/capture", async (req, res, next) => {
  try {
    if (env.NODE_ENV === "production") throw new AppError("Mock payment endpoint is disabled in production.", 404, "NOT_FOUND");
    const publicOrderId = String(req.body.publicOrderId || "");
    const order = await prisma.order.findUnique({ where: { publicOrderId }, include: { payments: true } });
    if (!order) throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    const payment = order.payments.find((item) => item.provider === "razorpay");
    if (!payment?.providerOrderId) throw new AppError("Create a Razorpay order first.", 409, "RAZORPAY_ORDER_REQUIRED");
    const providerPaymentId = `pay_mock_${publicOrderId.split("-").at(-1)}`;
    const signature = hmacSha256Hex(env.RAZORPAY_KEY_SECRET || "dev_secret", `${payment.providerOrderId}|${providerPaymentId}`);
    await markPaymentCaptured({
      provider: "razorpay",
      providerOrderId: payment.providerOrderId,
      providerPaymentId,
      amountPaise: order.totalPaise,
      raw: { mock: true }
    });
    res.json({ razorpay_order_id: payment.providerOrderId, razorpay_payment_id: providerPaymentId, razorpay_signature: signature });
  } catch (error) {
    next(error);
  }
});
