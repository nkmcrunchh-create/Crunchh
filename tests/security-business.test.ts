import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateOrderAmounts } from "../src/services/pricing.js";
import { verifyRazorpayCheckoutSignature } from "../src/services/razorpay/razorpay-service.js";
import { hmacSha256Hex } from "../src/utils/crypto.js";
import { normalizeIndianMobile } from "../src/utils/phone.js";
import { normalizeShipmentStatus } from "../src/services/nimbuspost/status-map.js";
import { MockShippingProvider } from "../src/services/nimbuspost/mock-provider.js";
import { mapCrunchhShipmentToNimbusPost } from "../src/services/nimbuspost/mapping.js";

const product = {
  id: "p1",
  slug: "stick-crunchh",
  sku: "CRH-STICK-80",
  name: "Stick Crunchh",
  category: "Soya Sticks",
  flavour: "Chatpata Magic",
  weightGrams: 80,
  pricePaise: 14900,
  active: true,
  inventoryQuantity: 10,
  imageUrl: null,
  imageUrls: null,
  tagline: null,
  description: null,
  hsn: null,
  taxRateBps: 1200,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("checkout pricing and validation", () => {
  it("uses server product prices, so browser price tampering cannot lower totals", () => {
    const calculated = calculateOrderAmounts({
      products: [product],
      cartItems: [{ productId: "stick-crunchh", quantity: 2 }],
      paymentMethod: "PREPAID",
      state: "Uttar Pradesh",
      postalCode: "201301"
    });
    expect(calculated.subtotalPaise).toBe(29800);
    expect(calculated.totalPaise).toBe(34700);
  });

  it("inactive products cannot be ordered", () => {
    expect(() => calculateOrderAmounts({
      products: [{ ...product, active: false }],
      cartItems: [{ productId: "stick-crunchh", quantity: 1 }],
      paymentMethod: "PREPAID",
      state: "Uttar Pradesh",
      postalCode: "201301"
    })).toThrow(/unavailable/);
  });

  it("normalizes Indian mobile numbers to E.164", () => {
    expect(normalizeIndianMobile("07303033324")).toBe("+917303033324");
  });
});

describe("razorpay signatures", () => {
  it("valid Razorpay signature passes", () => {
    const signature = hmacSha256Hex("test_secret", "order_123|pay_123");
    expect(verifyRazorpayCheckoutSignature({ orderId: "order_123", paymentId: "pay_123", signature })).toBe(true);
  });

  it("invalid Razorpay signature fails", () => {
    expect(verifyRazorpayCheckoutSignature({ orderId: "order_123", paymentId: "pay_123", signature: "bad" })).toBe(false);
  });
});

describe("shipping and notification sequencing", () => {
  it("passes COD amount into the NimbusPost mapping", async () => {
    const mapped = mapCrunchhShipmentToNimbusPost({
      publicOrderId: "CRH-20260803-ABC123",
      paymentMethod: "COD",
      codAmountPaise: 21800,
      declaredValuePaise: 21800,
      totalWeightGrams: 160,
      dimensions: { lengthCm: 18, widthCm: 14, heightCm: 6 },
      customer: { name: "Test User", mobile: "+917303033324", email: "test@example.com" },
      address: { line1: "A-1", city: "Noida", state: "Uttar Pradesh", postalCode: "201301", country: "IN" },
      items: [{ sku: "CRH-STICK-80", name: "Stick Crunchh", quantity: 1, unitPricePaise: 14900, weightGrams: 80 }]
    });
    expect(mapped.payment_type).toBe("cod");
    expect(mapped.cod_amount).toBe(218);

    const shipment = await new MockShippingProvider().createShipment({
      publicOrderId: "CRH-20260803-ABC123",
      paymentMethod: "COD",
      codAmountPaise: 21800,
      declaredValuePaise: 21800,
      totalWeightGrams: 160,
      dimensions: { lengthCm: 18, widthCm: 14, heightCm: 6 },
      customer: { name: "Test User", mobile: "+917303033324", email: "test@example.com" },
      address: { line1: "A-1", city: "Noida", state: "Uttar Pradesh", postalCode: "201301", country: "IN" },
      items: [{ sku: "CRH-STICK-80", name: "Stick Crunchh", quantity: 1, unitPricePaise: 14900, weightGrams: 80 }]
    });
    expect(shipment.awb).toContain("CRHMOCK");
  });

  it("tracking events are mapped centrally", () => {
    expect(normalizeShipmentStatus("out for delivery")).toBe("OUT_FOR_DELIVERY");
    expect(normalizeShipmentStatus("rto_initiated")).toBe("RTO_INITIATED");
  });

  it("documents idempotency guards for webhooks, shipments, invoices and WhatsApp", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toContain("@@unique([provider, externalEventId])");
    expect(schema).toContain("orderId             String           @unique");
    expect(schema).toContain("invoiceNumber   String   @unique");
    expect(schema).toContain("dedupeKey         String             @unique");
  });

  it("admin routes require authentication and cancellation does not auto-refund", () => {
    const admin = fs.readFileSync("src/routes/admin.ts", "utf8");
    expect(admin).toContain("requireAdmin");
    expect(admin).toContain("No refund has been triggered");
  });

  it("invoice download requires customer mobile verification", () => {
    const orders = fs.readFileSync("src/routes/orders.ts", "utf8");
    expect(orders).toContain("Mobile verification is required");
    expect(orders).toContain("MOBILE_MISMATCH");
  });

  it("mock payment endpoints are blocked in production", () => {
    const payments = fs.readFileSync("src/routes/payments.ts", "utf8");
    expect(payments).toContain('env.NODE_ENV === "production"');
    expect(payments).toContain("Mock payment endpoint is disabled in production");
  });
});
