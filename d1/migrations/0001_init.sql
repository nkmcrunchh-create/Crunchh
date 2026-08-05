PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Product" (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  flavour TEXT NOT NULL,
  weightGrams INTEGER NOT NULL,
  pricePaise INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  inventoryQuantity INTEGER NOT NULL DEFAULT 0 CHECK (inventoryQuantity >= 0),
  imageUrl TEXT,
  hsn TEXT,
  taxRateBps INTEGER NOT NULL DEFAULT 1200,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Customer" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  whatsappOptIn INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS Customer_mobile_idx ON "Customer"(mobile);
CREATE INDEX IF NOT EXISTS Customer_email_idx ON "Customer"(email);

CREATE TABLE IF NOT EXISTS "Address" (
  id TEXT PRIMARY KEY,
  customerId TEXT NOT NULL REFERENCES "Customer"(id),
  line1 TEXT NOT NULL,
  line2 TEXT,
  landmark TEXT,
  city TEXT NOT NULL,
  district TEXT,
  state TEXT NOT NULL,
  postalCode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'IN',
  addressType TEXT NOT NULL DEFAULT 'SHIPPING'
);

CREATE TABLE IF NOT EXISTS "Order" (
  id TEXT PRIMARY KEY,
  publicOrderId TEXT NOT NULL UNIQUE,
  customerId TEXT NOT NULL REFERENCES "Customer"(id),
  addressId TEXT NOT NULL REFERENCES "Address"(id),
  paymentMethod TEXT NOT NULL,
  paymentStatus TEXT NOT NULL,
  fulfilmentStatus TEXT NOT NULL,
  subtotalPaise INTEGER NOT NULL,
  discountPaise INTEGER NOT NULL DEFAULT 0,
  shippingPaise INTEGER NOT NULL,
  taxableAmountPaise INTEGER NOT NULL,
  taxPaise INTEGER NOT NULL,
  totalPaise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  couponCode TEXT,
  customerNote TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  selectedCourierJson TEXT,
  invoiceReady INTEGER NOT NULL DEFAULT 0,
  whatsappReady INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmedAt TEXT,
  cancelledAt TEXT
);
CREATE INDEX IF NOT EXISTS Order_createdAt_idx ON "Order"(createdAt);
CREATE INDEX IF NOT EXISTS Order_payment_fulfilment_idx ON "Order"(paymentStatus, fulfilmentStatus);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL REFERENCES "Order"(id),
  productId TEXT NOT NULL REFERENCES "Product"(id),
  sku TEXT NOT NULL,
  productNameSnapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unitPricePaise INTEGER NOT NULL,
  taxRateSnapshot INTEGER NOT NULL,
  lineSubtotalPaise INTEGER NOT NULL,
  lineTaxPaise INTEGER NOT NULL,
  lineTotalPaise INTEGER NOT NULL,
  weightGramsSnapshot INTEGER NOT NULL,
  hsnSnapshot TEXT
);

CREATE TABLE IF NOT EXISTS "Payment" (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL REFERENCES "Order"(id),
  provider TEXT NOT NULL,
  providerOrderId TEXT,
  providerPaymentId TEXT,
  providerSignature TEXT,
  amountPaise INTEGER NOT NULL,
  status TEXT NOT NULL,
  rawResponseJson TEXT,
  capturedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, providerOrderId),
  UNIQUE(provider, providerPaymentId)
);
CREATE INDEX IF NOT EXISTS Payment_orderId_idx ON "Payment"(orderId);

CREATE TABLE IF NOT EXISTS "Shipment" (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL UNIQUE REFERENCES "Order"(id),
  provider TEXT NOT NULL,
  externalShipmentId TEXT,
  courierId TEXT,
  courierName TEXT,
  awb TEXT UNIQUE,
  trackingUrl TEXT,
  labelUrl TEXT,
  manifestUrl TEXT,
  paymentMode TEXT NOT NULL,
  codAmountPaise INTEGER NOT NULL DEFAULT 0,
  chargedWeightGrams INTEGER,
  actualWeightGrams INTEGER,
  lengthCm INTEGER,
  widthCm INTEGER,
  heightCm INTEGER,
  shippingCostPaise INTEGER,
  status TEXT NOT NULL DEFAULT 'SHIPMENT_BOOKING',
  lastStatusAt TEXT,
  rawResponseJson TEXT,
  bookedAt TEXT,
  deliveredAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ShipmentEvent" (
  id TEXT PRIMARY KEY,
  shipmentId TEXT NOT NULL REFERENCES "Shipment"(id),
  providerStatus TEXT NOT NULL,
  normalizedStatus TEXT NOT NULL,
  description TEXT,
  location TEXT,
  eventTime TEXT NOT NULL,
  rawPayloadJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ShipmentEvent_shipment_time_idx ON "ShipmentEvent"(shipmentId, eventTime);

CREATE TABLE IF NOT EXISTS "InvoiceSequence" (
  financialYear TEXT PRIMARY KEY,
  lastNumber INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Invoice" (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL UNIQUE REFERENCES "Order"(id),
  invoiceNumber TEXT NOT NULL UNIQUE,
  financialYear TEXT NOT NULL,
  pdfStoragePath TEXT NOT NULL,
  pdfUrl TEXT,
  subtotalPaise INTEGER NOT NULL,
  taxPaise INTEGER NOT NULL,
  totalPaise INTEGER NOT NULL,
  generatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  externalEventId TEXT NOT NULL,
  eventType TEXT NOT NULL,
  payloadHash TEXT NOT NULL,
  payloadJson TEXT NOT NULL,
  processingStatus TEXT NOT NULL DEFAULT 'RECEIVED',
  attempts INTEGER NOT NULL DEFAULT 0,
  errorMessage TEXT,
  receivedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processedAt TEXT,
  UNIQUE(provider, externalEventId),
  UNIQUE(provider, payloadHash)
);
CREATE INDEX IF NOT EXISTS WebhookEvent_status_received_idx ON "WebhookEvent"(processingStatus, receivedAt);

CREATE TABLE IF NOT EXISTS "Notification" (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL REFERENCES "Order"(id),
  dedupeKey TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  notificationType TEXT NOT NULL,
  recipient TEXT NOT NULL,
  providerMessageId TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER NOT NULL DEFAULT 0,
  errorMessage TEXT,
  payloadJson TEXT,
  sentAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OutboxJob" (
  id TEXT PRIMARY KEY,
  jobType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  payloadJson TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  nextAttemptAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lockedAt TEXT,
  completedAt TEXT,
  lastError TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS OutboxJob_status_next_idx ON "OutboxJob"(status, nextAttemptAt);
CREATE UNIQUE INDEX IF NOT EXISTS OutboxJob_pending_unique_idx ON "OutboxJob"(jobType, entityId, status);

CREATE TABLE IF NOT EXISTS "AdminUser" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AdminSession" (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS AdminSession_expires_idx ON "AdminSession"(expiresAt);
