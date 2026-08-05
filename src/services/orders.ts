import { PaymentMethod } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { shippingSettings } from "../config/business.js";
import { env } from "../config/env.js";
import { buildPublicOrderId } from "../utils/order-id.js";
import { normalizeIndianMobile } from "../utils/phone.js";
import { AppError, assertApp } from "../utils/errors.js";
import { checkoutOrderSchema } from "../utils/validation.js";
import { calculateOrderAmounts } from "./pricing.js";
import { getProductsForCart } from "./products.js";
import { getShippingProvider } from "./nimbuspost/index.js";
import { enqueueJob } from "./outbox.js";

type CheckoutInput = unknown;

export async function createCheckoutOrder(input: CheckoutInput) {
  const parsed = checkoutOrderSchema.parse(input);
  const mobile = normalizeIndianMobile(parsed.customer.mobile);
  const productIds = parsed.cartItems.map((item) => item.productId);
  const products = await getProductsForCart(productIds);
  const pricing = calculateOrderAmounts({
    products,
    cartItems: parsed.cartItems,
    paymentMethod: parsed.paymentMethod,
    state: parsed.shippingAddress.state,
    postalCode: parsed.shippingAddress.postalCode,
    couponCode: parsed.couponCode
  });
  parsed.cartItems.forEach((item) => {
    if (item.claimedUnitPricePaise == null) return;
    const line = pricing.lines.find((candidate) => candidate.product.id === item.productId || candidate.product.slug === item.productId);
    if (line && item.claimedUnitPricePaise !== line.unitPricePaise) {
      throw new AppError("Cart price changed. Please refresh and try again.", 409, "PRICE_TAMPERING_DETECTED");
    }
  });

  let selectedCourierJson: object | undefined;
  if (parsed.paymentMethod === "COD") {
    const serviceability = await getShippingProvider().checkServiceability({
      pickupPincode: env.NIMBUSPOST_PICKUP_PINCODE || "201301",
      deliveryPincode: parsed.shippingAddress.postalCode,
      paymentMethod: "COD",
      codAmountPaise: pricing.totalPaise
    });
    assertApp(serviceability.serviceable && serviceability.codAvailable, "COD is not serviceable for this PIN code.", 400, "COD_NOT_SERVICEABLE");
    selectedCourierJson = serviceability;
  }

  const publicOrderId = buildPublicOrderId();
  const order = await prisma.$transaction(async (tx) => {
    for (const line of pricing.lines) {
      const updated = await tx.product.updateMany({
        where: { id: line.product.id, active: true, inventoryQuantity: { gte: line.quantity } },
        data: { inventoryQuantity: { decrement: line.quantity } }
      });
      if (updated.count !== 1) throw new AppError(`${line.product.name} is out of stock.`, 409, "INVENTORY_CHANGED");
    }

    const customer = await tx.customer.create({
      data: {
        name: parsed.customer.name.trim(),
        email: parsed.customer.email.trim().toLowerCase(),
        mobile,
        whatsappOptIn: parsed.customer.whatsappOptIn
      }
    });
    const address = await tx.address.create({
      data: {
        customerId: customer.id,
        line1: parsed.shippingAddress.line1,
        line2: parsed.shippingAddress.line2 || null,
        landmark: parsed.shippingAddress.landmark || null,
        city: parsed.shippingAddress.city,
        district: parsed.shippingAddress.district || null,
        state: parsed.shippingAddress.state,
        postalCode: parsed.shippingAddress.postalCode,
        country: parsed.shippingAddress.country || "IN",
        addressType: parsed.shippingAddress.addressType || "SHIPPING"
      }
    });
    const created = await tx.order.create({
      data: {
        publicOrderId,
        customerId: customer.id,
        addressId: address.id,
        paymentMethod: parsed.paymentMethod,
        paymentStatus: parsed.paymentMethod === "COD" ? "COD_PENDING" : "PENDING",
        fulfilmentStatus: parsed.paymentMethod === "COD" ? "READY_TO_BOOK" : "PENDING_PAYMENT",
        subtotalPaise: pricing.subtotalPaise,
        discountPaise: pricing.discountPaise,
        shippingPaise: pricing.shippingPaise,
        taxableAmountPaise: pricing.taxableAmountPaise,
        taxPaise: pricing.taxPaise,
        totalPaise: pricing.totalPaise,
        couponCode: parsed.couponCode || null,
        customerNote: parsed.customerNote || null,
        source: parsed.source,
        selectedCourierJson,
        items: {
          create: pricing.lines.map((line) => ({
            productId: line.product.id,
            sku: line.product.sku,
            productNameSnapshot: line.product.name,
            quantity: line.quantity,
            unitPricePaise: line.unitPricePaise,
            taxRateSnapshot: line.taxRateBps,
            lineSubtotalPaise: line.lineSubtotalPaise,
            lineTaxPaise: line.lineTaxPaise,
            lineTotalPaise: line.lineTotalPaise,
            weightGramsSnapshot: line.product.weightGrams,
            hsnSnapshot: line.product.hsn
          }))
        }
      },
      include: { customer: true, address: true, items: true }
    });
    return created;
  });

  if (parsed.paymentMethod === "COD") {
    await enqueueJob("BOOK_SHIPMENT", order.id, { publicOrderId: order.publicOrderId });
  }

  return {
    publicOrderId: order.publicOrderId,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    amountPaise: order.totalPaise,
    currency: order.currency,
    shippingPaise: order.shippingPaise,
    taxPaise: order.taxPaise,
    items: order.items.map((item) => ({ sku: item.sku, name: item.productNameSnapshot, quantity: item.quantity, lineTotalPaise: item.lineTotalPaise }))
  };
}

export async function getOrderStatus(publicOrderId: string) {
  const order = await prisma.order.findUnique({
    where: { publicOrderId },
    include: { shipment: true, invoice: true, notifications: true }
  });
  assertApp(order, "Order not found.", 404, "ORDER_NOT_FOUND");
  return {
    publicOrderId: order.publicOrderId,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    totalPaise: order.totalPaise,
    invoiceNumber: order.invoice?.invoiceNumber || null,
    invoiceDownloadReady: Boolean(order.invoice),
    awb: order.shipment?.awb || null,
    courierName: order.shipment?.courierName || null,
    stages: {
      paymentReceived: order.paymentStatus === "CAPTURED" || order.paymentStatus === "COD_PENDING",
      bookingShipment: ["READY_TO_BOOK", "SHIPMENT_BOOKING"].includes(order.fulfilmentStatus),
      shipmentBooked: Boolean(order.shipment?.awb),
      invoicePrepared: Boolean(order.invoice),
      whatsappConfirmationSent: order.notifications.some((notification) => notification.notificationType === "ORDER_CONFIRMED" && notification.status === "SENT")
    },
    trackingUrl: order.shipment?.trackingUrl || `${env.PUBLIC_BASE_URL}/track/${order.publicOrderId}`
  };
}

export async function confirmCodOrder(publicOrderId: string, mobileInput: string) {
  if (!shippingSettings.codEnabled) throw new AppError("COD is disabled.", 400, "COD_DISABLED");
  const mobile = normalizeIndianMobile(mobileInput);
  const order = await prisma.order.findUnique({ where: { publicOrderId }, include: { customer: true } });
  assertApp(order, "Order not found.", 404, "ORDER_NOT_FOUND");
  assertApp(order.paymentMethod === "COD", "Order is not COD.", 400, "NOT_COD");
  assertApp(order.customer.mobile === mobile, "Mobile number does not match this order.", 403, "MOBILE_MISMATCH");
  await enqueueJob("BOOK_SHIPMENT", order.id, { publicOrderId });
  return { confirmed: true };
}

export function paymentLabel(method: PaymentMethod) {
  return method === "COD" ? "COD" : "Prepaid";
}
