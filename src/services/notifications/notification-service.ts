import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { formatPaise } from "../../utils/money.js";
import { sendOrderConfirmedTemplate } from "../whatsapp/whatsapp-service.js";
import { paymentLabel } from "../orders.js";

export async function sendOrderConfirmedWhatsApp(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, shipment: true, invoice: true, notifications: true }
  });
  if (!order || !order.shipment?.awb || !order.shipment.trackingUrl || !order.invoice?.pdfUrl) {
    throw new Error("WhatsApp confirmation requires confirmed order, AWB, tracking URL, and invoice PDF.");
  }
  const dedupeKey = `ORDER_CONFIRMED:${order.id}`;
  const existing = await prisma.notification.findUnique({ where: { dedupeKey } });
  if (existing?.status === "SENT") return existing;
  const notification = existing || await prisma.notification.create({
    data: {
      orderId: order.id,
      dedupeKey,
      channel: "WHATSAPP",
      notificationType: "ORDER_CONFIRMED",
      recipient: order.customer.mobile,
      payloadJson: { publicOrderId: order.publicOrderId }
    }
  });
  const sent = await sendOrderConfirmedTemplate({
    recipient: order.customer.mobile,
    firstName: order.customer.name.split(/\s+/)[0] || "there",
    publicOrderId: order.publicOrderId,
    amount: formatPaise(order.totalPaise),
    paymentLabel: paymentLabel(order.paymentMethod),
    courierName: order.shipment.courierName || "Courier",
    awb: order.shipment.awb,
    trackingUrl: `${env.PUBLIC_BASE_URL}/track/${order.publicOrderId}`,
    invoiceUrl: order.invoice.pdfUrl
  });
  return prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: "SENT",
      providerMessageId: sent.providerMessageId,
      attempts: { increment: 1 },
      payloadJson: sent.raw as object,
      sentAt: new Date()
    }
  });
}
