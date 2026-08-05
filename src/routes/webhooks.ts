import { Router } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { verifyRazorpayWebhookSignature } from "../services/razorpay/razorpay-service.js";
import { verifyMetaSignature } from "../services/whatsapp/whatsapp-service.js";
import { recordWebhook, processNimbusPostWebhook, processRazorpayWebhook } from "../services/webhooks.js";
import { hmacSha256Hex, timingSafeEqualText } from "../utils/crypto.js";

export const webhooksRouter = Router();

function parseRawJson(raw: Buffer) {
  return JSON.parse(raw.toString("utf8"));
}

webhooksRouter.post("/api/webhooks/razorpay", async (req, res, next) => {
  try {
    const raw = req.body as Buffer;
    if (!verifyRazorpayWebhookSignature(raw, req.headers["x-razorpay-signature"] as string | undefined)) {
      throw new AppError("Invalid Razorpay webhook signature.", 401, "INVALID_WEBHOOK_SIGNATURE");
    }
    const payload = parseRawJson(raw);
    const event = await recordWebhook("razorpay", String(payload.id || payload.event_id || hmacSha256Hex("event", raw)), String(payload.event || payload.type || "unknown"), payload, raw);
    res.status(202).json({ received: true });
    if (event.processingStatus !== "PROCESSED") processRazorpayWebhook(event.id, payload).catch(next);
  } catch (error) {
    next(error);
  }
});

webhooksRouter.post("/api/webhooks/nimbuspost/:token?", async (req, res, next) => {
  try {
    const raw = req.body as Buffer;
    const signature = req.headers["x-nimbuspost-signature"] as string | undefined;
    const tokenOk = env.NIMBUSPOST_WEBHOOK_ROUTE_TOKEN && req.params.token === env.NIMBUSPOST_WEBHOOK_ROUTE_TOKEN;
    const signatureOk = env.NIMBUSPOST_WEBHOOK_SECRET && signature && timingSafeEqualText(hmacSha256Hex(env.NIMBUSPOST_WEBHOOK_SECRET, raw), signature);
    if (!tokenOk && !signatureOk && env.NODE_ENV === "production") {
      throw new AppError("Invalid NimbusPost webhook authentication.", 401, "INVALID_WEBHOOK_AUTH");
    }
    const payload = parseRawJson(raw);
    const externalEventId = String(payload.event_id || payload.id || payload.awb || payload.data?.awb || hmacSha256Hex("nimbuspost", raw));
    const event = await recordWebhook("nimbuspost", externalEventId, String(payload.status || payload.event || "tracking"), payload, raw);
    res.status(202).json({ received: true });
    if (event.processingStatus !== "PROCESSED") processNimbusPostWebhook(event.id, payload).catch(next);
  } catch (error) {
    next(error);
  }
});

webhooksRouter.get("/api/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

webhooksRouter.post("/api/webhooks/whatsapp", async (req, res, next) => {
  try {
    const raw = req.body as Buffer;
    if (!verifyMetaSignature(raw, req.headers["x-hub-signature-256"] as string | undefined)) {
      throw new AppError("Invalid WhatsApp webhook signature.", 401, "INVALID_WEBHOOK_SIGNATURE");
    }
    const payload = parseRawJson(raw);
    await recordWebhook("whatsapp", String(payload.entry?.[0]?.id || hmacSha256Hex("whatsapp", raw)), "whatsapp_event", payload, raw);
    res.status(202).json({ received: true });
  } catch (error) {
    next(error);
  }
});
