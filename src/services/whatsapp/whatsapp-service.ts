import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { hmacSha256Hex, timingSafeEqualText } from "../../utils/crypto.js";

export function verifyMetaSignature(rawBody: Buffer, signature: string | undefined) {
  if (!env.WHATSAPP_APP_SECRET) return env.NODE_ENV !== "production";
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${hmacSha256Hex(env.WHATSAPP_APP_SECRET, rawBody)}`;
  return timingSafeEqualText(expected, signature);
}

export async function sendOrderConfirmedTemplate(input: {
  recipient: string;
  firstName: string;
  publicOrderId: string;
  amount: string;
  paymentLabel: string;
  courierName: string;
  awb: string;
  trackingUrl: string;
  invoiceUrl?: string | null;
}) {
  if (!env.WHATSAPP_ENABLED) {
    return { providerMessageId: `mock-wa-${input.publicOrderId}`, raw: { mock: true } };
  }
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new AppError("WhatsApp Cloud API is not configured.", 503, "WHATSAPP_NOT_CONFIGURED");
  }

  const templateName = input.invoiceUrl ? env.WHATSAPP_ORDER_CONFIRMED_TEMPLATE : env.WHATSAPP_FALLBACK_ORDER_CONFIRMED_TEMPLATE;
  const components: any[] = [];
  if (input.invoiceUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "document", document: { link: input.invoiceUrl, filename: `${input.publicOrderId}.pdf` } }]
    });
  }
  components.push({
    type: "body",
    parameters: [
      input.firstName,
      input.publicOrderId,
      input.amount,
      input.paymentLabel,
      input.courierName,
      input.awb,
      input.trackingUrl
    ].map((text) => ({ type: "text", text }))
  });

  const response = await fetch(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.recipient.replace("+", ""),
      type: "template",
      template: { name: templateName, language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE }, components }
    }),
    signal: AbortSignal.timeout(15000)
  });
  const raw = await response.json() as any;
  if (!response.ok) throw new AppError("WhatsApp message failed.", 503, "WHATSAPP_SEND_FAILED", raw);
  return { providerMessageId: raw.messages?.[0]?.id || null, raw };
}
