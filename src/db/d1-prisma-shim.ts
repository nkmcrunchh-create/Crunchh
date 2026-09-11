import crypto from "node:crypto";
import { d1 } from "./d1-client.js";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const json = (value: unknown) => value == null ? null : JSON.stringify(value);
const parseJson = (value: unknown) => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
};
const bool = (value: unknown) => value ? 1 : 0;
const fromBool = (row: any, keys: string[]) => {
  for (const key of keys) if (key in row) row[key] = Boolean(row[key]);
  return row;
};
const dates = (row: any) => {
  for (const key of ["createdAt", "updatedAt", "confirmedAt", "cancelledAt", "capturedAt", "bookedAt", "deliveredAt", "lastStatusAt", "generatedAt", "receivedAt", "processedAt", "nextAttemptAt", "lockedAt", "completedAt", "sentAt", "expiresAt", "eventTime"]) {
    if (row?.[key]) row[key] = new Date(row[key]);
  }
  for (const key of ["rawResponseJson", "rawPayloadJson", "payloadJson", "selectedCourierJson", "data"]) {
    if (row?.[key]) row[key] = parseJson(row[key]);
  }
  return row;
};
const normalize = (row: any) => row ? dates(fromBool(row, ["active", "whatsappOptIn", "invoiceReady", "whatsappReady"])) : row;
const inc = (value: any) => typeof value === "object" && value?.increment != null ? value.increment : value;

async function orderWithIncludes(order: any, include?: any) {
  if (!order) return null;
  normalize(order);
  if (include?.customer) order.customer = normalize(await d1.first('SELECT * FROM "Customer" WHERE id = ?', [order.customerId]));
  if (include?.address) order.address = normalize(await d1.first('SELECT * FROM "Address" WHERE id = ?', [order.addressId]));
  if (include?.items) order.items = (await d1.all('SELECT * FROM "OrderItem" WHERE orderId = ?', [order.id])).map(normalize);
  if (include?.payments) order.payments = (await d1.all('SELECT * FROM "Payment" WHERE orderId = ?', [order.id])).map(normalize);
  if (include?.shipment) {
    order.shipment = normalize(await d1.first('SELECT * FROM "Shipment" WHERE orderId = ?', [order.id]));
    if (order.shipment && include.shipment?.include?.events) {
      order.shipment.events = (await d1.all('SELECT * FROM "ShipmentEvent" WHERE shipmentId = ? ORDER BY eventTime ASC', [order.shipment.id])).map(normalize);
    }
  }
  if (include?.invoice) order.invoice = normalize(await d1.first('SELECT * FROM "Invoice" WHERE orderId = ?', [order.id]));
  if (include?.notifications) order.notifications = (await d1.all('SELECT * FROM "Notification" WHERE orderId = ?', [order.id])).map(normalize);
  return order;
}

async function paymentWithOrder(payment: any, include?: any) {
  normalize(payment);
  if (payment && include?.order) payment.order = normalize(await d1.first('SELECT * FROM "Order" WHERE id = ?', [payment.orderId]));
  return payment;
}

export const d1Prisma = {
  async $queryRaw() { return [{ ok: 1 }]; },
  async $transaction<T>(fn: (tx: any) => Promise<T>) { return fn(d1Prisma); },
  product: {
    async findMany(args: any = {}) {
      if (args.where?.active === true) return (await d1.all('SELECT * FROM "Product" WHERE active = 1 ORDER BY name ASC')).map(normalize);
      const or = args.where?.OR;
      if (or?.length) {
        const ids = or[0]?.id?.in || [];
        const slugs = or[1]?.slug?.in || [];
        const params = [...ids, ...slugs];
        if (!params.length) return [];
        return (await d1.all(`SELECT * FROM "Product" WHERE id IN (${ids.map(() => "?").join(",") || "NULL"}) OR slug IN (${slugs.map(() => "?").join(",") || "NULL"})`, params)).map(normalize);
      }
      return (await d1.all('SELECT * FROM "Product"')).map(normalize);
    },
    async updateMany(args: any) {
      const result = await d1.run('UPDATE "Product" SET inventoryQuantity = inventoryQuantity - ?, updatedAt = ? WHERE id = ? AND active = 1 AND inventoryQuantity >= ?', [args.data.inventoryQuantity.decrement, now(), args.where.id, args.where.inventoryQuantity.gte]);
      return { count: result.meta?.changes || 0 };
    },
    async upsert(args: any) {
      const existing = await d1.first('SELECT * FROM "Product" WHERE slug = ?', [args.where.slug]);
      const data = existing ? args.update : { id: id(), ...args.create };
      if (existing) {
        await d1.run('UPDATE "Product" SET sku=?, name=?, category=?, flavour=?, weightGrams=?, pricePaise=?, active=?, inventoryQuantity=?, imageUrl=?, imageUrls=?, tagline=?, description=?, updatedAt=? WHERE slug=?', [data.sku, data.name, data.category, data.flavour, data.weightGrams ?? 80, data.pricePaise, bool(data.active), data.inventoryQuantity, data.imageUrl, data.imageUrls, data.tagline, data.description, now(), args.where.slug]);
        return normalize(await d1.first('SELECT * FROM "Product" WHERE slug = ?', [args.where.slug]));
      }
      await d1.run('INSERT INTO "Product" (id,slug,sku,name,category,flavour,weightGrams,pricePaise,active,inventoryQuantity,imageUrl,imageUrls,tagline,description,taxRateBps,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [data.id, data.slug, data.sku, data.name, data.category, data.flavour, data.weightGrams, data.pricePaise, bool(data.active ?? true), data.inventoryQuantity ?? 0, data.imageUrl ?? null, data.imageUrls ?? null, data.tagline ?? null, data.description ?? null, data.taxRateBps ?? 1200, now(), now()]);
      return normalize(await d1.first('SELECT * FROM "Product" WHERE slug = ?', [args.where.slug]));
    },
    async create(args: any) {
      const data = { id: id(), ...args.data };
      await d1.run('INSERT INTO "Product" (id,slug,sku,name,category,flavour,weightGrams,pricePaise,active,inventoryQuantity,imageUrl,imageUrls,tagline,description,taxRateBps,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [data.id, data.slug, data.sku, data.name, data.category, data.flavour, data.weightGrams, data.pricePaise, bool(data.active ?? true), data.inventoryQuantity ?? 0, data.imageUrl ?? null, data.imageUrls ?? null, data.tagline ?? null, data.description ?? null, data.taxRateBps ?? 1200, now(), now()]);
      return normalize(await d1.first('SELECT * FROM "Product" WHERE slug = ?', [data.slug]));
    },
    async update(args: any) {
      const existing = await d1.first('SELECT * FROM "Product" WHERE slug = ?', [args.where.slug]);
      if (!existing) return null;
      await d1.run(
        'UPDATE "Product" SET sku=COALESCE(?,sku), name=COALESCE(?,name), category=COALESCE(?,category), flavour=COALESCE(?,flavour), weightGrams=COALESCE(?,weightGrams), inventoryQuantity=COALESCE(?,inventoryQuantity), active=COALESCE(?, active), pricePaise=COALESCE(?, pricePaise), imageUrl=COALESCE(?, imageUrl), imageUrls=COALESCE(?, imageUrls), tagline=COALESCE(?, tagline), description=COALESCE(?, description), updatedAt=? WHERE slug=?',
        [args.data.sku, args.data.name, args.data.category, args.data.flavour, args.data.weightGrams, args.data.inventoryQuantity, args.data.active == null ? null : bool(args.data.active), args.data.pricePaise ?? null, args.data.imageUrl, args.data.imageUrls, args.data.tagline, args.data.description, now(), args.where.slug]
      );
      return normalize(await d1.first('SELECT * FROM "Product" WHERE slug = ?', [args.where.slug]));
    }
  },
  review: {
    async findMany(args: any = {}) {
      const whereActive = args.where?.active === true ? 'WHERE active = 1' : args.where?.active === false ? 'WHERE active = 0' : '';
      const limit = args.take || 100;
      return (await d1.all(`SELECT * FROM "Review" ${whereActive} ORDER BY sortOrder ASC, createdAt DESC LIMIT ?`, [limit])).map(normalize);
    },
    async create(args: any) {
      const row = { id: args.data.id || id(), ...args.data, createdAt: now(), updatedAt: now() };
      await d1.run('INSERT INTO "Review" (id,customerName,rating,quote,screenshotUrl,active,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)', [row.id, row.customerName, row.rating ?? 5, row.quote ?? null, row.screenshotUrl ?? null, bool(row.active ?? true), row.sortOrder ?? 0, row.createdAt, row.updatedAt]);
      return normalize(await d1.first('SELECT * FROM "Review" WHERE id=?', [row.id]));
    },
    async update(args: any) {
      await d1.run('UPDATE "Review" SET customerName=COALESCE(?,customerName), rating=COALESCE(?,rating), quote=COALESCE(?,quote), screenshotUrl=COALESCE(?,screenshotUrl), active=COALESCE(?,active), sortOrder=COALESCE(?,sortOrder), updatedAt=? WHERE id=?', [args.data.customerName, args.data.rating, args.data.quote, args.data.screenshotUrl, args.data.active == null ? null : bool(args.data.active), args.data.sortOrder, now(), args.where.id]);
      return normalize(await d1.first('SELECT * FROM "Review" WHERE id=?', [args.where.id]));
    },
    async delete(args: any) {
      const row = normalize(await d1.first('SELECT * FROM "Review" WHERE id=?', [args.where.id]));
      await d1.run('DELETE FROM "Review" WHERE id=?', [args.where.id]);
      return row;
    },
    async upsert(args: any) {
      const existing = await d1.first('SELECT * FROM "Review" WHERE id=?', [args.where.id]);
      if (existing) return d1Prisma.review.update({ where: { id: args.where.id }, data: args.update });
      return d1Prisma.review.create({ data: { id: args.where.id, ...args.create } });
    }
  },
  customer: {
    async create(args: any) {
      const row = { id: id(), ...args.data, createdAt: now(), updatedAt: now() };
      await d1.run('INSERT INTO "Customer" (id,name,email,mobile,whatsappOptIn,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)', [row.id, row.name, row.email, row.mobile, bool(row.whatsappOptIn), row.createdAt, row.updatedAt]);
      return normalize(row);
    }
  },
  address: {
    async create(args: any) {
      const row = { id: id(), ...args.data };
      await d1.run('INSERT INTO "Address" (id,customerId,line1,line2,landmark,city,district,state,postalCode,country,addressType) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.customerId, row.line1, row.line2, row.landmark, row.city, row.district, row.state, row.postalCode, row.country || "IN", row.addressType || "SHIPPING"]);
      return row;
    }
  },
  order: {
    async create(args: any) {
      const row = { id: id(), ...args.data, selectedCourierJson: json(args.data.selectedCourierJson), invoiceReady: false, whatsappReady: false, createdAt: now(), updatedAt: now() };
      await d1.run('INSERT INTO "Order" (id,publicOrderId,customerId,addressId,paymentMethod,paymentStatus,fulfilmentStatus,subtotalPaise,discountPaise,shippingPaise,taxableAmountPaise,taxPaise,totalPaise,currency,couponCode,customerNote,source,selectedCourierJson,invoiceReady,whatsappReady,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.publicOrderId, row.customerId, row.addressId, row.paymentMethod, row.paymentStatus, row.fulfilmentStatus, row.subtotalPaise, row.discountPaise || 0, row.shippingPaise, row.taxableAmountPaise, row.taxPaise, row.totalPaise, row.currency || "INR", row.couponCode, row.customerNote, row.source || "web", row.selectedCourierJson, 0, 0, row.createdAt, row.updatedAt]);
      for (const item of args.data.items?.create || []) {
        await d1.run('INSERT INTO "OrderItem" (id,orderId,productId,sku,productNameSnapshot,quantity,unitPricePaise,taxRateSnapshot,lineSubtotalPaise,lineTaxPaise,lineTotalPaise,weightGramsSnapshot,hsnSnapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [id(), row.id, item.productId, item.sku, item.productNameSnapshot, item.quantity, item.unitPricePaise, item.taxRateSnapshot, item.lineSubtotalPaise, item.lineTaxPaise, item.lineTotalPaise, item.weightGramsSnapshot, item.hsnSnapshot]);
      }
      return orderWithIncludes(await d1.first('SELECT * FROM "Order" WHERE id = ?', [row.id]), args.include);
    },
    async findUnique(args: any) {
      const key = args.where.publicOrderId ? "publicOrderId" : "id";
      return orderWithIncludes(await d1.first(`SELECT * FROM "Order" WHERE ${key} = ?`, [args.where[key]]), args.include);
    },
    async update(args: any) {
      const data = args.data;
      const existing = await d1.first('SELECT * FROM "Order" WHERE id = ? OR publicOrderId = ?', [args.where.id || "", args.where.publicOrderId || ""]);
      if (!existing) return null;
      const merged = { ...existing, ...data, selectedCourierJson: data.selectedCourierJson ? json(data.selectedCourierJson) : existing.selectedCourierJson, updatedAt: now() };
      await d1.run('UPDATE "Order" SET paymentStatus=?, fulfilmentStatus=?, confirmedAt=COALESCE(?, confirmedAt), selectedCourierJson=?, updatedAt=? WHERE id=?', [merged.paymentStatus, merged.fulfilmentStatus, data.confirmedAt ? new Date(data.confirmedAt).toISOString() : null, merged.selectedCourierJson, merged.updatedAt, existing.id]);
      return normalize(await d1.first('SELECT * FROM "Order" WHERE id = ?', [existing.id]));
    },
    async findMany(args: any = {}) {
      const rows = (await d1.all('SELECT * FROM "Order" ORDER BY createdAt DESC LIMIT ?', [args.take || 100])).map(normalize);
      const enriched = [];
      for (const row of rows) enriched.push(await orderWithIncludes(row, args.include));
      return enriched;
    }
  },
  payment: {
    async create(args: any) {
      const row = { id: id(), ...args.data, rawResponseJson: json(args.data.rawResponseJson), createdAt: now(), updatedAt: now() };
      await d1.run('INSERT INTO "Payment" (id,orderId,provider,providerOrderId,providerPaymentId,providerSignature,amountPaise,status,rawResponseJson,capturedAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.orderId, row.provider, row.providerOrderId, row.providerPaymentId, row.providerSignature, row.amountPaise, row.status, row.rawResponseJson, row.capturedAt, row.createdAt, row.updatedAt]);
      return normalize(row);
    },
    async findFirst(args: any) {
      const ors = args.where?.OR || [];
      const provider = args.where?.provider;
      for (const cond of ors) {
        if (cond.providerPaymentId) return paymentWithOrder(await d1.first('SELECT * FROM "Payment" WHERE provider=? AND providerPaymentId=?', [provider, cond.providerPaymentId]), args.include);
        if (cond.providerOrderId) return paymentWithOrder(await d1.first('SELECT * FROM "Payment" WHERE provider=? AND providerOrderId=?', [provider, cond.providerOrderId]), args.include);
      }
      return null;
    },
    async update(args: any) {
      const row = await d1.first('SELECT * FROM "Payment" WHERE id=?', [args.where.id]);
      const data = args.data;
      await d1.run('UPDATE "Payment" SET providerPaymentId=COALESCE(?,providerPaymentId), amountPaise=COALESCE(?,amountPaise), status=?, rawResponseJson=COALESCE(?,rawResponseJson), capturedAt=COALESCE(?,capturedAt), updatedAt=? WHERE id=?', [data.providerPaymentId, data.amountPaise, data.status, json(data.rawResponseJson), data.capturedAt ? new Date(data.capturedAt).toISOString() : null, now(), args.where.id]);
      return normalize({ ...row, ...data });
    },
    async upsert(args: any) {
      const key = args.where.provider_providerPaymentId;
      const existing = await d1.first('SELECT * FROM "Payment" WHERE provider=? AND providerPaymentId=?', [key.provider, key.providerPaymentId]);
      if (existing) return d1Prisma.payment.update({ where: { id: existing.id }, data: args.update });
      return d1Prisma.payment.create({ data: args.create });
    }
  },
  shipment: {
    async findUnique(args: any) { return normalize(await d1.first('SELECT * FROM "Shipment" WHERE orderId=?', [args.where.orderId])); },
    async findFirst(args: any) {
      const where = args.where?.OR || [];
      for (const cond of where) {
        if (cond.awb) return normalize(await d1.first('SELECT * FROM "Shipment" WHERE awb=?', [cond.awb]));
        if (cond.externalShipmentId) return normalize(await d1.first('SELECT * FROM "Shipment" WHERE externalShipmentId=?', [cond.externalShipmentId]));
      }
      return null;
    },
    async upsert(args: any) {
      const existing = await d1.first('SELECT * FROM "Shipment" WHERE orderId=?', [args.where.orderId]);
      const data = existing ? args.update : { id: id(), ...args.create };
      if (existing) await d1.run('DELETE FROM "Shipment" WHERE orderId=?', [args.where.orderId]);
      await d1.run('INSERT INTO "Shipment" (id,orderId,provider,externalShipmentId,courierId,courierName,awb,trackingUrl,labelUrl,manifestUrl,paymentMode,codAmountPaise,chargedWeightGrams,actualWeightGrams,lengthCm,widthCm,heightCm,shippingCostPaise,status,lastStatusAt,rawResponseJson,bookedAt,deliveredAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [data.id, data.orderId || args.where.orderId, data.provider, data.externalShipmentId, data.courierId, data.courierName, data.awb, data.trackingUrl, data.labelUrl, data.manifestUrl, data.paymentMode, data.codAmountPaise || 0, data.chargedWeightGrams, data.actualWeightGrams, data.lengthCm, data.widthCm, data.heightCm, data.shippingCostPaise, data.status, data.lastStatusAt ? new Date(data.lastStatusAt).toISOString() : null, json(data.rawResponseJson), data.bookedAt ? new Date(data.bookedAt).toISOString() : null, data.deliveredAt ? new Date(data.deliveredAt).toISOString() : null, now(), now()]);
      return normalize(await d1.first('SELECT * FROM "Shipment" WHERE orderId=?', [data.orderId || args.where.orderId]));
    },
    async update(args: any) {
      const data = args.data;
      await d1.run('UPDATE "Shipment" SET status=?, lastStatusAt=?, deliveredAt=COALESCE(?,deliveredAt), updatedAt=? WHERE id=?', [data.status, data.lastStatusAt ? new Date(data.lastStatusAt).toISOString() : now(), data.deliveredAt ? new Date(data.deliveredAt).toISOString() : null, now(), args.where.id]);
      return normalize(await d1.first('SELECT * FROM "Shipment" WHERE id=?', [args.where.id]));
    }
  },
  shipmentEvent: {
    async create(args: any) {
      const row = { id: id(), ...args.data, rawPayloadJson: json(args.data.rawPayloadJson), eventTime: new Date(args.data.eventTime).toISOString(), createdAt: now() };
      await d1.run('INSERT INTO "ShipmentEvent" (id,shipmentId,providerStatus,normalizedStatus,description,location,eventTime,rawPayloadJson,createdAt) VALUES (?,?,?,?,?,?,?,?,?)', [row.id, row.shipmentId, row.providerStatus, row.normalizedStatus, row.description, row.location, row.eventTime, row.rawPayloadJson, row.createdAt]);
      return normalize(row);
    }
  },
  invoiceSequence: {
    async upsert(args: any) {
      const existing = await d1.first('SELECT * FROM "InvoiceSequence" WHERE financialYear=?', [args.where.financialYear]);
      if (existing) await d1.run('UPDATE "InvoiceSequence" SET lastNumber=lastNumber+1 WHERE financialYear=?', [args.where.financialYear]);
      else await d1.run('INSERT INTO "InvoiceSequence" (financialYear,lastNumber) VALUES (?,?)', [args.create.financialYear, args.create.lastNumber]);
      return d1.first('SELECT * FROM "InvoiceSequence" WHERE financialYear=?', [args.where.financialYear]);
    }
  },
  invoice: {
    async findUnique(args: any) { return normalize(await d1.first(`SELECT * FROM "Invoice" WHERE ${args.where.orderId ? "orderId" : "invoiceNumber"}=?`, [args.where.orderId || args.where.invoiceNumber])); },
    async create(args: any) {
      const row = { id: id(), ...args.data, generatedAt: now() };
      await d1.run('INSERT INTO "Invoice" (id,orderId,invoiceNumber,financialYear,pdfStoragePath,pdfUrl,subtotalPaise,taxPaise,totalPaise,generatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)', [row.id, row.orderId, row.invoiceNumber, row.financialYear, row.pdfStoragePath, row.pdfUrl, row.subtotalPaise, row.taxPaise, row.totalPaise, row.generatedAt]);
      return normalize(row);
    }
  },
  webhookEvent: {
    async findMany(args: any = {}) {
      return (await d1.all('SELECT * FROM "WebhookEvent" ORDER BY receivedAt DESC LIMIT ?', [args.take || 25])).map(normalize);
    },
    async upsert(args: any) {
      const key = args.where.provider_externalEventId;
      const existing = await d1.first('SELECT * FROM "WebhookEvent" WHERE provider=? AND externalEventId=?', [key.provider, key.externalEventId]);
      if (existing) return normalize(existing);
      const row = { id: id(), ...args.create, payloadJson: json(args.create.payloadJson), receivedAt: now() };
      await d1.run('INSERT INTO "WebhookEvent" (id,provider,externalEventId,eventType,payloadHash,payloadJson,processingStatus,attempts,errorMessage,receivedAt,processedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.provider, row.externalEventId, row.eventType, row.payloadHash, row.payloadJson, row.processingStatus || "RECEIVED", row.attempts || 0, row.errorMessage, row.receivedAt, null]);
      return normalize(row);
    },
    async update(args: any) {
      const data = args.data;
      await d1.run('UPDATE "WebhookEvent" SET processingStatus=?, attempts=attempts+?, processedAt=?, errorMessage=COALESCE(?,errorMessage) WHERE id=?', [data.processingStatus, inc(data.attempts) || 0, data.processedAt ? new Date(data.processedAt).toISOString() : null, data.errorMessage, args.where.id]);
    }
  },
  notification: {
    async findMany(args: any = {}) {
      return (await d1.all('SELECT * FROM "Notification" ORDER BY createdAt DESC LIMIT ?', [args.take || 25])).map(normalize);
    },
    async findUnique(args: any) { return normalize(await d1.first('SELECT * FROM "Notification" WHERE dedupeKey=?', [args.where.dedupeKey])); },
    async create(args: any) {
      const row = { id: id(), ...args.data, payloadJson: json(args.data.payloadJson), createdAt: now() };
      await d1.run('INSERT INTO "Notification" (id,orderId,dedupeKey,channel,notificationType,recipient,providerMessageId,status,attempts,errorMessage,payloadJson,sentAt,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.orderId, row.dedupeKey, row.channel, row.notificationType, row.recipient, row.providerMessageId, row.status || "QUEUED", row.attempts || 0, row.errorMessage, row.payloadJson, row.sentAt, row.createdAt]);
      return normalize(row);
    },
    async update(args: any) {
      const data = args.data;
      await d1.run('UPDATE "Notification" SET status=?, providerMessageId=?, attempts=attempts+?, payloadJson=?, sentAt=?, errorMessage=COALESCE(?,errorMessage) WHERE id=?', [data.status, data.providerMessageId, inc(data.attempts) || 0, json(data.payloadJson), data.sentAt ? new Date(data.sentAt).toISOString() : null, data.errorMessage, args.where.id]);
      return normalize(await d1.first('SELECT * FROM "Notification" WHERE id=?', [args.where.id]));
    }
  },
  outboxJob: {
    async findFirst(args: any) { return normalize(await d1.first('SELECT * FROM "OutboxJob" WHERE jobType=? AND entityId=? AND status IN ("PENDING","PROCESSING") LIMIT 1', [args.where.jobType, args.where.entityId])); },
    async create(args: any) {
      const row = { id: id(), ...args.data, payloadJson: json(args.data.payloadJson), status: "PENDING", attempts: 0, nextAttemptAt: now(), createdAt: now() };
      await d1.run('INSERT INTO "OutboxJob" (id,jobType,entityId,payloadJson,status,attempts,nextAttemptAt,lockedAt,completedAt,lastError,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [row.id, row.jobType, row.entityId, row.payloadJson, row.status, row.attempts, row.nextAttemptAt, null, null, null, row.createdAt]);
      return normalize(row);
    },
    async findMany(args: any = {}) {
      if (args.where?.status === "PENDING" && args.where?.nextAttemptAt?.lte) {
        return (await d1.all('SELECT * FROM "OutboxJob" WHERE status="PENDING" AND nextAttemptAt <= ? ORDER BY createdAt ASC LIMIT ?', [new Date(args.where.nextAttemptAt.lte).toISOString(), args.take || 10])).map(normalize);
      }
      return (await d1.all('SELECT * FROM "OutboxJob" ORDER BY createdAt DESC LIMIT ?', [args.take || 25])).map(normalize);
    },
    async updateMany(args: any) {
      const result = await d1.run('UPDATE "OutboxJob" SET status=?, lockedAt=?, attempts=attempts+1 WHERE id=? AND status=?', [args.data.status, new Date(args.data.lockedAt).toISOString(), args.where.id, args.where.status]);
      return { count: result.meta?.changes || 0 };
    },
    async update(args: any) {
      const data = args.data;
      await d1.run('UPDATE "OutboxJob" SET status=?, completedAt=COALESCE(?,completedAt), lockedAt=?, attempts=COALESCE(?,attempts), nextAttemptAt=COALESCE(?,nextAttemptAt), lastError=COALESCE(?,lastError) WHERE id=?', [data.status, data.completedAt ? new Date(data.completedAt).toISOString() : null, data.lockedAt ? new Date(data.lockedAt).toISOString() : null, data.attempts, data.nextAttemptAt ? new Date(data.nextAttemptAt).toISOString() : null, data.lastError, args.where.id]);
      return normalize(await d1.first('SELECT * FROM "OutboxJob" WHERE id=?', [args.where.id]));
    }
  },
  adminUser: {
    async findUnique(args: any) {
      if (args.where.email) return normalize(await d1.first('SELECT * FROM "AdminUser" WHERE email=?', [args.where.email]));
      if (args.where.id) return normalize(await d1.first('SELECT * FROM "AdminUser" WHERE id=?', [args.where.id]));
      return null;
    },
    async upsert(args: any) {
      const existing = await d1.first('SELECT * FROM "AdminUser" WHERE email=?', [args.where.email]);
      if (existing) {
        await d1.run('UPDATE "AdminUser" SET passwordHash=?, updatedAt=? WHERE email=?', [args.update.passwordHash || existing.passwordHash, now(), args.where.email]);
        return normalize(await d1.first('SELECT * FROM "AdminUser" WHERE email=?', [args.where.email]));
      }
      const row = { id: id(), ...args.create, createdAt: now(), updatedAt: now() };
      await d1.run('INSERT INTO "AdminUser" (id,email,passwordHash,createdAt,updatedAt) VALUES (?,?,?,?,?)', [row.id, row.email, row.passwordHash, row.createdAt, row.updatedAt]);
      return normalize(row);
    }
  },
  adminSession: {
    async findUnique(args: any) { return normalize(await d1.first('SELECT * FROM "AdminSession" WHERE id=?', [args.where.id])); },
    async upsert(args: any) {
      await d1.run('INSERT INTO "AdminSession" (id,data,expiresAt,createdAt,updatedAt) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, expiresAt=excluded.expiresAt, updatedAt=excluded.updatedAt', [args.create.id, json(args.create.data), new Date(args.create.expiresAt).toISOString(), now(), now()]);
    },
    async deleteMany(args: any) { await d1.run('DELETE FROM "AdminSession" WHERE id=?', [args.where.id]); }
  }
};
