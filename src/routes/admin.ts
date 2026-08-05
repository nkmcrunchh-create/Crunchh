import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/security.js";
import { enqueueJob } from "../services/outbox.js";
import { AppError } from "../utils/errors.js";
import { formatPaise } from "../utils/money.js";

export const adminRouter = Router();

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWhatsAppStatus(order: any) {
  const notification = order.notifications?.find((item: any) => item.notificationType === "ORDER_CONFIRMED");
  return notification?.status || "NOT_QUEUED";
}

function serializeOrder(order: any) {
  return {
    id: order.id,
    publicOrderId: order.publicOrderId,
    createdAt: order.createdAt,
    customerName: order.customer?.name,
    mobile: order.customer?.mobile,
    email: order.customer?.email,
    totalPaise: order.totalPaise,
    totalFormatted: formatPaise(order.totalPaise),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    awb: order.shipment?.awb || null,
    courier: order.shipment?.courierName || null,
    invoiceNumber: order.invoice?.invoiceNumber || null,
    whatsappStatus: getWhatsAppStatus(order),
    itemCount: order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0
  };
}

function summarizeOrders(orders: any[]) {
  const today = startOfToday();
  const month = startOfMonth();
  const paid = orders.filter((order) => ["CAPTURED", "COD_COLLECTED", "COD_PENDING"].includes(order.paymentStatus));
  const todayOrders = orders.filter((order) => new Date(order.createdAt) >= today);
  const monthOrders = orders.filter((order) => new Date(order.createdAt) >= month);
  const revenuePaise = paid.reduce((sum, order) => sum + order.totalPaise, 0);
  const monthRevenuePaise = monthOrders
    .filter((order) => ["CAPTURED", "COD_COLLECTED", "COD_PENDING"].includes(order.paymentStatus))
    .reduce((sum, order) => sum + order.totalPaise, 0);
  const pendingShipment = orders.filter((order) => ["PAYMENT_CONFIRMED", "READY_TO_BOOK", "SHIPMENT_BOOKING", "BOOKING_FAILED"].includes(order.fulfilmentStatus)).length;
  const pendingInvoice = orders.filter((order) => (order.shipment?.awb && !order.invoice)).length;
  const whatsappFailed = orders.filter((order) => getWhatsAppStatus(order) === "FAILED").length;
  return {
    totalOrders: orders.length,
    todayOrders: todayOrders.length,
    monthOrders: monthOrders.length,
    paidOrders: paid.length,
    revenuePaise,
    revenueFormatted: formatPaise(revenuePaise),
    monthRevenuePaise,
    monthRevenueFormatted: formatPaise(monthRevenuePaise),
    averageOrderValuePaise: paid.length ? Math.round(revenuePaise / paid.length) : 0,
    averageOrderValueFormatted: paid.length ? formatPaise(Math.round(revenuePaise / paid.length)) : formatPaise(0),
    pendingShipment,
    pendingInvoice,
    whatsappFailed,
    codOrders: orders.filter((order) => order.paymentMethod === "COD").length,
    prepaidOrders: orders.filter((order) => order.paymentMethod === "PREPAID").length
  };
}

adminRouter.post("/api/admin/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase();
    const password = String(req.body.password || "");
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new AppError("Invalid admin credentials.", 401, "INVALID_ADMIN_LOGIN");
    }
    req.session.adminUserId = admin.id;
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

adminRouter.get("/api/admin/me", requireAdmin, async (req, res, next) => {
  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: req.session.adminUserId } as any });
    res.json({ admin: admin ? { email: admin.email } : null });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/api/admin/dashboard", requireAdmin, async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: { customer: true, shipment: true, invoice: true, notifications: true, payments: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 250
    });
    const products = await prisma.product.findMany({ orderBy: { name: "asc" } as any });
    const jobs = await (prisma as any).outboxJob.findMany({ orderBy: { createdAt: "desc" }, take: 25 });
    const webhooks = await (prisma as any).webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 25 });
    const notifications = await (prisma as any).notification.findMany({ orderBy: { createdAt: "desc" }, take: 25 });
    const lowStock = products.filter((product: any) => product.inventoryQuantity <= 25);
    res.json({
      summary: summarizeOrders(orders),
      recentOrders: orders.slice(0, 25).map(serializeOrder),
      inventory: products.map((product: any) => ({
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        category: product.category,
        flavour: product.flavour,
        active: product.active,
        inventoryQuantity: product.inventoryQuantity,
        pricePaise: product.pricePaise,
        priceFormatted: formatPaise(product.pricePaise)
      })),
      lowStock: lowStock.map((product: any) => ({ slug: product.slug, name: product.name, inventoryQuantity: product.inventoryQuantity })),
      logs: {
        jobs,
        webhooks,
        notifications
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/api/admin/orders", requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || "");
    const where = q ? {
      OR: [
        { publicOrderId: { contains: q, mode: "insensitive" as const } },
        { customer: { mobile: { contains: q } } },
        { shipment: { awb: { contains: q, mode: "insensitive" as const } } },
        { payments: { some: { providerPaymentId: { contains: q, mode: "insensitive" as const } } } }
      ]
    } : {};
    const orders = await prisma.order.findMany({
      where,
      include: { customer: true, shipment: true, invoice: true, notifications: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json({ orders: orders.map(serializeOrder) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/api/admin/products", requireAdmin, async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { name: "asc" } as any });
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/api/admin/products/:slug", requireAdmin, async (req, res, next) => {
  try {
    const inventoryQuantity = Number(req.body.inventoryQuantity);
    const active = typeof req.body.active === "boolean" ? req.body.active : undefined;
    const pricePaise = req.body.pricePaise == null ? undefined : Number(req.body.pricePaise);
    if (!Number.isInteger(inventoryQuantity) || inventoryQuantity < 0) {
      throw new AppError("Inventory quantity must be a non-negative integer.", 400, "INVALID_INVENTORY");
    }
    if (pricePaise != null && (!Number.isInteger(pricePaise) || pricePaise <= 0)) {
      throw new AppError("Price must be a positive paise value.", 400, "INVALID_PRICE");
    }
    const product = await (prisma as any).product.update({
      where: { slug: req.params.slug },
      data: {
        inventoryQuantity,
        ...(active == null ? {} : { active }),
        ...(pricePaise == null ? {} : { pricePaise })
      }
    });
    res.json({ product });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/api/admin/orders/:publicOrderId/retry/:jobType", requireAdmin, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({ where: { publicOrderId: req.params.publicOrderId } });
    if (!order) throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");
    const jobMap: Record<string, string> = {
      shipment: "BOOK_SHIPMENT",
      invoice: "GENERATE_INVOICE",
      whatsapp: "SEND_WHATSAPP_ORDER_CONFIRMED"
    };
    const jobType = jobMap[req.params.jobType];
    if (!jobType) throw new AppError("Unsupported retry type.", 400, "BAD_RETRY_TYPE");
    res.json(await enqueueJob(jobType, order.id, { manual: true }));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/api/admin/orders/:publicOrderId/cancel-shipment", requireAdmin, async (_req, res) => {
  res.status(501).json({ error: { code: "MANUAL_PROVIDER_ACTION_REQUIRED", message: "Shipment cancellation is intentionally not automated until NimbusPost API mapping is verified. No refund has been triggered." } });
});

adminRouter.get("/api/admin/export/orders.csv", requireAdmin, async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({ include: { customer: true, shipment: true }, orderBy: { createdAt: "desc" } });
    const lines = ["publicOrderId,createdAt,mobile,totalPaise,paymentStatus,fulfilmentStatus,awb"];
    orders.forEach((order) => lines.push([order.publicOrderId, order.createdAt.toISOString(), order.customer.mobile, order.totalPaise, order.paymentStatus, order.fulfilmentStatus, order.shipment?.awb || ""].join(",")));
    res.type("text/csv").send(lines.join("\n"));
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin", (_req, res) => {
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CRUNCHH Admin</title><link rel="stylesheet" href="/assets/css/style.css"><link rel="stylesheet" href="/assets/css/experience.css"></head><body><main class="admin-shell"><section class="admin-login-panel" id="loginPanel"><form class="checkout-form admin-login" id="login"><p class="kicker">CRUNCHH operations</p><h2>Admin login</h2><p class="fine-print">Private sales, fulfilment, inventory, and notification console.</p><label>Email<input id="email" type="email" autocomplete="username" required></label><label>Password<input id="password" type="password" autocomplete="current-password" required></label><button class="btn primary full">Login</button><p class="fine-print" id="loginError"></p></form></section><section class="admin-dashboard" id="dashboard" hidden><div class="admin-topbar"><div><p class="kicker">CRUNCHH dashboard</p><h1>Sales and inventory</h1><p id="adminIdentity"></p></div><div class="admin-actions"><a class="btn secondary" href="/">Storefront</a><button class="btn primary" id="refresh" type="button">Refresh</button><button class="btn secondary" id="logout" type="button">Logout</button></div></div><div class="admin-tabs"><button data-tab="overview" class="active">Overview</button><button data-tab="orders">Orders</button><button data-tab="inventory">Inventory</button><button data-tab="logs">Logs</button></div><section class="admin-tab-panel" id="tab-overview"><div class="metric-grid" id="metrics"></div><div class="admin-two-col"><div class="admin-card"><h2>Recent orders</h2><div id="recentOrders" class="admin-table-wrap"></div></div><div class="admin-card"><h2>Low stock</h2><div id="lowStock"></div></div></div></section><section class="admin-tab-panel" id="tab-orders" hidden><div class="admin-card"><div class="admin-card-head"><h2>Sales orders</h2><div><input id="q" placeholder="Search order, mobile, AWB, payment"><button class="btn secondary" id="search">Search</button><a class="btn primary" href="/api/admin/export/orders.csv">Export CSV</a></div></div><div id="orders" class="admin-table-wrap"></div></div></section><section class="admin-tab-panel" id="tab-inventory" hidden><div class="admin-card"><h2>Inventory management</h2><p class="fine-print">Update stock, live status, and price in paise.</p><div id="inventory" class="admin-table-wrap"></div></div></section><section class="admin-tab-panel" id="tab-logs" hidden><div class="admin-three-col"><div class="admin-card"><h2>Outbox jobs</h2><div id="jobLogs"></div></div><div class="admin-card"><h2>Webhooks</h2><div id="webhookLogs"></div></div><div class="admin-card"><h2>WhatsApp</h2><div id="notificationLogs"></div></div></div></section></section></main><script src="/assets/js/admin.js"></script></body></html>`);
});
