import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/security.js";
import { enqueueJob } from "../services/outbox.js";
import { AppError } from "../utils/errors.js";
import { formatPaise } from "../utils/money.js";

export const adminRouter = Router();
const defaultAdminEmail = "admin@crunch";
const defaultAdminPassword = "qawsedrf1234";

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

function parseImageUrls(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    } catch {
      return trimmed.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function serializeProduct(product: any) {
  const imageUrls = parseImageUrls(product.imageUrls);
  if (product.imageUrl && !imageUrls.includes(product.imageUrl)) imageUrls.unshift(product.imageUrl);
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    category: product.category,
    flavour: product.flavour,
    weightGrams: product.weightGrams,
    active: product.active,
    inventoryQuantity: product.inventoryQuantity,
    pricePaise: product.pricePaise,
    priceFormatted: formatPaise(product.pricePaise),
    imageUrl: product.imageUrl,
    imageUrls,
    tagline: product.tagline,
    description: product.description
  };
}

function productPayload(body: any, partial = false) {
  const data: any = {};
  const textFields = ["slug", "sku", "name", "category", "flavour", "tagline", "description", "imageUrl"];
  for (const field of textFields) {
    if (body[field] != null) data[field] = String(body[field]).trim();
  }
  if (body.imageUrls != null) {
    const imageUrls = parseImageUrls(body.imageUrls);
    data.imageUrls = JSON.stringify(imageUrls);
    data.imageUrl = data.imageUrl || imageUrls[0] || "";
  }
  if (body.weightGrams != null) data.weightGrams = Number(body.weightGrams);
  if (body.inventoryQuantity != null) data.inventoryQuantity = Number(body.inventoryQuantity);
  if (body.pricePaise != null) data.pricePaise = Number(body.pricePaise);
  if (typeof body.active === "boolean") data.active = body.active;

  const required = ["slug", "sku", "name", "category", "flavour", "weightGrams", "pricePaise", "inventoryQuantity"];
  if (!partial) {
    for (const field of required) if (data[field] == null || data[field] === "") throw new AppError(`${field} is required.`, 400, "INVALID_PRODUCT");
  }
  if (data.slug != null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) throw new AppError("Slug must use lowercase letters, numbers, and hyphens.", 400, "INVALID_PRODUCT_SLUG");
  if (data.weightGrams != null && (!Number.isInteger(data.weightGrams) || data.weightGrams <= 0)) throw new AppError("Weight must be a positive gram value.", 400, "INVALID_WEIGHT");
  if (data.inventoryQuantity != null && (!Number.isInteger(data.inventoryQuantity) || data.inventoryQuantity < 0)) throw new AppError("Inventory quantity must be a non-negative integer.", 400, "INVALID_INVENTORY");
  if (data.pricePaise != null && (!Number.isInteger(data.pricePaise) || data.pricePaise <= 0)) throw new AppError("Price must be a positive paise value.", 400, "INVALID_PRICE");
  return data;
}

function reviewPayload(body: any, partial = false) {
  const data: any = {};
  if (body.customerName != null) data.customerName = String(body.customerName).trim();
  if (body.quote != null) data.quote = String(body.quote).trim();
  if (body.screenshotUrl != null) data.screenshotUrl = String(body.screenshotUrl).trim();
  if (body.rating != null) data.rating = Number(body.rating);
  if (body.sortOrder != null) data.sortOrder = Number(body.sortOrder);
  if (typeof body.active === "boolean") data.active = body.active;
  if (!partial && !data.customerName) throw new AppError("Customer name is required.", 400, "INVALID_REVIEW");
  if (data.rating != null && (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5)) throw new AppError("Rating must be between 1 and 5.", 400, "INVALID_RATING");
  if (data.sortOrder != null && !Number.isInteger(data.sortOrder)) throw new AppError("Sort order must be an integer.", 400, "INVALID_SORT_ORDER");
  return data;
}

async function ensureDefaultAdmin() {
  const passwordHash = await bcrypt.hash(defaultAdminPassword, 12);
  return (prisma as any).adminUser.upsert({
    where: { email: defaultAdminEmail },
    update: { passwordHash },
    create: { email: defaultAdminEmail, passwordHash }
  });
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
    if (email === defaultAdminEmail) await ensureDefaultAdmin();
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
    const reviews = await (prisma as any).review.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    const jobs = await (prisma as any).outboxJob.findMany({ orderBy: { createdAt: "desc" }, take: 25 });
    const webhooks = await (prisma as any).webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 25 });
    const notifications = await (prisma as any).notification.findMany({ orderBy: { createdAt: "desc" }, take: 25 });
    const lowStock = products.filter((product: any) => product.inventoryQuantity <= 25);
    res.json({
      summary: summarizeOrders(orders),
      recentOrders: orders.slice(0, 25).map(serializeOrder),
      inventory: products.map(serializeProduct),
      reviews,
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
    res.json({ products: products.map(serializeProduct) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/api/admin/products", requireAdmin, async (req, res, next) => {
  try {
    const data = productPayload(req.body);
    const product = await (prisma as any).product.create({ data: { ...data, active: data.active ?? true, taxRateBps: 1200 } });
    res.status(201).json({ product: serializeProduct(product) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/api/admin/products/:slug", requireAdmin, async (req, res, next) => {
  try {
    const data = productPayload(req.body, true);
    const product = await (prisma as any).product.update({
      where: { slug: req.params.slug },
      data
    });
    res.json({ product: serializeProduct(product) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/api/admin/reviews", requireAdmin, async (req, res, next) => {
  try {
    const review = await (prisma as any).review.create({ data: { ...reviewPayload(req.body), active: req.body.active ?? true, sortOrder: Number(req.body.sortOrder) || 0 } });
    res.status(201).json({ review });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/api/admin/reviews/:id", requireAdmin, async (req, res, next) => {
  try {
    const review = await (prisma as any).review.update({ where: { id: req.params.id }, data: reviewPayload(req.body, true) });
    res.json({ review });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/api/admin/reviews/:id", requireAdmin, async (req, res, next) => {
  try {
    await (prisma as any).review.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
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
  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CRUNCHH Admin</title>
  <link rel="icon" type="image/png" href="/assets/img/optimized/crunchh-favicon.png">
  <link rel="stylesheet" href="/assets/css/style.css">
  <script src="/assets/js/admin.js" defer></script>
</head>
<body>
  <main class="admin-shell">
    <section class="admin-login-panel" id="loginPanel">
      <form class="checkout-form admin-login" id="login">
        <p class="kicker">CRUNCHH operations</p>
        <h2>Admin login</h2>
        <p class="fine-print">Private sales, fulfilment, inventory, reviews, and storefront console.</p>
        <label>Email<input id="email" type="email" autocomplete="username" value="admin@crunch" required></label>
        <label>Password<input id="password" type="password" autocomplete="current-password" required></label>
        <button class="btn primary full">Login</button>
        <p class="fine-print" id="loginError" role="alert"></p>
      </form>
    </section>
    <section class="admin-dashboard" id="dashboard" hidden>
      <div class="admin-topbar">
        <div>
          <p class="kicker">CRUNCHH dashboard</p>
          <h1>Website control</h1>
          <p id="adminIdentity"></p>
        </div>
        <div class="admin-actions">
          <a class="btn secondary" href="/">Storefront</a>
          <button class="btn primary" id="refresh" type="button">Refresh</button>
          <button class="btn secondary" id="logout" type="button">Logout</button>
        </div>
      </div>
      <div class="admin-tabs" role="tablist">
        <button data-tab="overview" class="active" type="button">Overview</button>
        <button data-tab="orders" type="button">Orders</button>
        <button data-tab="inventory" type="button">Products</button>
        <button data-tab="reviews" type="button">Reviews</button>
        <button data-tab="logs" type="button">Logs</button>
      </div>
      <section class="admin-tab-panel" id="tab-overview">
        <div class="metric-grid" id="metrics"></div>
        <div class="admin-two-col">
          <div class="admin-card"><h2>Recent orders</h2><div id="recentOrders" class="admin-table-wrap"></div></div>
          <div class="admin-card"><h2>Low stock</h2><div id="lowStock"></div></div>
        </div>
      </section>
      <section class="admin-tab-panel" id="tab-orders" hidden>
        <div class="admin-card">
          <div class="admin-card-head">
            <h2>Sales orders</h2>
            <div><input id="q" placeholder="Search order, mobile, AWB, payment"><button class="btn secondary" id="search" type="button">Search</button><a class="btn primary" href="/api/admin/export/orders.csv">Export CSV</a></div>
          </div>
          <div id="orders" class="admin-table-wrap"></div>
        </div>
      </section>
      <section class="admin-tab-panel" id="tab-inventory" hidden>
        <div class="admin-two-col">
          <div class="admin-card">
            <h2>Product studio</h2>
            <p class="fine-print">Update live products, copy, stock, price, and image galleries.</p>
            <div id="inventory" class="admin-product-list"></div>
          </div>
          <form class="admin-card admin-product-form" id="newProductForm">
            <h2>Add product</h2>
            <label>Slug<input name="slug" placeholder="new-crunchh" required></label>
            <label>SKU<input name="sku" placeholder="CRH-NEW-80" required></label>
            <label>Name<input name="name" required></label>
            <label>Category<input name="category" required></label>
            <label>Flavour<input name="flavour" required></label>
            <div class="field-grid">
              <label>Weight grams<input name="weightGrams" type="number" min="1" value="80" required></label>
              <label>Price paise<input name="pricePaise" type="number" min="1" required></label>
            </div>
            <label>Stock<input name="inventoryQuantity" type="number" min="0" value="0" required></label>
            <label>Tagline<input name="tagline"></label>
            <label>Description<textarea name="description" rows="3"></textarea></label>
            <label>Image URLs<textarea name="imageUrls" rows="4" placeholder="One URL per line"></textarea></label>
            <label class="consent-line"><input name="active" type="checkbox" checked> Show on storefront</label>
            <button class="btn primary full" type="submit">Create product</button>
          </form>
        </div>
      </section>
      <section class="admin-tab-panel" id="tab-reviews" hidden>
        <div class="admin-two-col">
          <div class="admin-card">
            <h2>Reviews</h2>
            <p class="fine-print">Post customer screenshots, quote text, ratings, and display order.</p>
            <div id="reviews" class="admin-product-list"></div>
          </div>
          <form class="admin-card admin-product-form" id="newReviewForm">
            <h2>Add review</h2>
            <label>Customer name<input name="customerName" required></label>
            <div class="field-grid">
              <label>Rating<input name="rating" type="number" min="1" max="5" value="5" required></label>
              <label>Sort order<input name="sortOrder" type="number" value="0"></label>
            </div>
            <label>Screenshot URL<input name="screenshotUrl" placeholder="assets/img/review.png"></label>
            <label>Quote<textarea name="quote" rows="3"></textarea></label>
            <label class="consent-line"><input name="active" type="checkbox" checked> Show on storefront</label>
            <button class="btn primary full" type="submit">Create review</button>
          </form>
        </div>
      </section>
      <section class="admin-tab-panel" id="tab-logs" hidden>
        <div class="admin-three-col">
          <div class="admin-card"><h2>Outbox jobs</h2><div id="jobLogs"></div></div>
          <div class="admin-card"><h2>Webhooks</h2><div id="webhookLogs"></div></div>
          <div class="admin-card"><h2>WhatsApp</h2><div id="notificationLogs"></div></div>
        </div>
      </section>
    </section>
  </main>
</body>
</html>`);
});
