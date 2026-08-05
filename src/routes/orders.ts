import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { normalizeIndianMobile } from "../utils/phone.js";
import { AppError, assertApp } from "../utils/errors.js";
import { codConfirmSchema } from "../utils/validation.js";
import { confirmCodOrder, getOrderStatus } from "../services/orders.js";
import { getStorageProvider } from "../services/storage/storage-service.js";

export const ordersRouter = Router();

ordersRouter.post("/api/orders/:publicOrderId/confirm-cod", async (req, res, next) => {
  try {
    const parsed = codConfirmSchema.parse(req.body);
    res.json(await confirmCodOrder(req.params.publicOrderId, parsed.mobile));
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/api/orders/:publicOrderId/status", async (req, res, next) => {
  try {
    res.json(await getOrderStatus(req.params.publicOrderId));
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/api/orders/:publicOrderId/tracking", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { publicOrderId: req.params.publicOrderId },
      include: { shipment: { include: { events: { orderBy: { eventTime: "asc" } } } }, items: true }
    });
    assertApp(order, "Order not found.", 404, "ORDER_NOT_FOUND");
    res.json({
      publicOrderId: order.publicOrderId,
      courier: order.shipment?.courierName,
      awb: order.shipment?.awb,
      status: order.shipment?.status || order.fulfilmentStatus,
      trackingUrl: order.shipment?.trackingUrl || `${env.PUBLIC_BASE_URL}/track/${order.publicOrderId}`,
      events: order.shipment?.events || [],
      items: order.items.map((item) => ({ name: item.productNameSnapshot, sku: item.sku, quantity: item.quantity }))
    });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/api/orders/:publicOrderId/invoice", async (req, res, next) => {
  try {
    const mobile = String(req.query.mobile || "");
    if (!mobile) throw new AppError("Mobile verification is required.", 403, "MOBILE_REQUIRED");
    const normalized = normalizeIndianMobile(mobile);
    const order = await prisma.order.findUnique({
      where: { publicOrderId: req.params.publicOrderId },
      include: { customer: true, invoice: true }
    });
    assertApp(order?.invoice, "Invoice not found.", 404, "INVOICE_NOT_FOUND");
    assertApp(order.customer.mobile === normalized, "Mobile number does not match this order.", 403, "MOBILE_MISMATCH");
    const url = await getStorageProvider().getSignedUrl(order.invoice.pdfStoragePath, 10 * 60);
    res.json({ invoiceNumber: order.invoice.invoiceNumber, url });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/track/:publicOrderId", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { publicOrderId: req.params.publicOrderId },
      include: { customer: true, shipment: { include: { events: { orderBy: { eventTime: "asc" } } } }, items: true, invoice: true }
    });
    assertApp(order, "Order not found.", 404, "ORDER_NOT_FOUND");
    const rows = (order.shipment?.events || []).map((event) => `<li><strong>${event.normalizedStatus}</strong><span>${event.description || event.providerStatus}</span><em>${event.location || ""} ${event.eventTime.toLocaleString("en-IN")}</em></li>`).join("");
    res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Track ${order.publicOrderId} | CRUNCHH</title><link rel="stylesheet" href="/assets/css/style.css"></head><body><main class="order-section"><div class="container"><div class="invoice-card"><p class="kicker">CRUNCHH tracking</p><h2>${order.publicOrderId}</h2><p>Courier: ${order.shipment?.courierName || "Being assigned"}<br>AWB: ${order.shipment?.awb || "Pending"}<br>Status: ${order.shipment?.status || order.fulfilmentStatus}<br>Invoice: ${order.invoice?.invoiceNumber || "Preparing"}</p><h3>Products</h3><ul>${order.items.map((item) => `<li>${item.productNameSnapshot} x ${item.quantity}</li>`).join("")}</ul><h3>Timeline</h3><ul>${rows || "<li>Tracking will appear after shipment booking.</li>"}</ul><div class="invoice-actions"><a class="btn primary" href="https://wa.me/${env.WHATSAPP_SUPPORT_NUMBER}">Support WhatsApp</a><a class="btn secondary" href="/">Storefront</a></div></div></div></main></body></html>`);
  } catch (error) {
    next(error);
  }
});
