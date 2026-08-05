import { FulfilmentStatus } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { shippingSettings } from "../config/business.js";
import { AppError, assertApp } from "../utils/errors.js";
import { getShippingProvider } from "./nimbuspost/index.js";
import { normalizeShipmentStatus } from "./nimbuspost/status-map.js";
import { enqueueJob } from "./outbox.js";

export async function bookShipmentForOrder(orderId: string) {
  const existing = await prisma.shipment.findUnique({ where: { orderId } });
  if (existing?.awb) return existing;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, address: true, items: true, shipment: true }
  });
  assertApp(order, "Order not found.", 404, "ORDER_NOT_FOUND");
  assertApp(order.paymentStatus === "CAPTURED" || order.paymentStatus === "COD_PENDING", "Order is not ready for shipment.", 409, "PAYMENT_NOT_CONFIRMED");
  assertApp(!order.shipment?.awb, "Shipment already booked.", 409, "SHIPMENT_ALREADY_BOOKED");

  await prisma.order.update({ where: { id: order.id }, data: { fulfilmentStatus: "SHIPMENT_BOOKING" } });
  const rates = await getShippingProvider().getRates({
    pickupPincode: env.NIMBUSPOST_PICKUP_PINCODE || "201301",
    deliveryPincode: order.address.postalCode,
    paymentMethod: order.paymentMethod,
    codAmountPaise: order.paymentMethod === "COD" ? order.totalPaise : 0,
    weightGrams: order.items.reduce((sum, item) => sum + item.weightGramsSnapshot * item.quantity, shippingSettings.defaultDimensions.emptyWeightGrams),
    declaredValuePaise: order.totalPaise
  });
  const selected = rates
    .filter((rate) => rate.serviceable && (order.paymentMethod !== "COD" || rate.codAvailable))
    .sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0) || a.forwardChargePaise + a.codChargePaise - (b.forwardChargePaise + b.codChargePaise))[0];
  assertApp(selected, "No serviceable courier found.", 503, "NO_COURIER");

  const shipment = await getShippingProvider().createShipment({
    publicOrderId: order.publicOrderId,
    paymentMethod: order.paymentMethod,
    codAmountPaise: order.paymentMethod === "COD" ? order.totalPaise : 0,
    declaredValuePaise: order.totalPaise,
    totalWeightGrams: order.items.reduce((sum, item) => sum + item.weightGramsSnapshot * item.quantity, shippingSettings.defaultDimensions.emptyWeightGrams),
    dimensions: {
      lengthCm: shippingSettings.defaultDimensions.lengthCm,
      widthCm: shippingSettings.defaultDimensions.widthCm,
      heightCm: shippingSettings.defaultDimensions.heightCm
    },
    courierId: selected.courierId,
    customer: { name: order.customer.name, mobile: order.customer.mobile, email: order.customer.email },
    address: order.address,
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.productNameSnapshot,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      weightGrams: item.weightGramsSnapshot
    }))
  });

  const saved = await prisma.shipment.upsert({
    where: { orderId: order.id },
    update: {
      provider: "nimbuspost",
      externalShipmentId: shipment.externalShipmentId,
      courierId: shipment.courierId,
      courierName: shipment.courierName,
      awb: shipment.awb,
      trackingUrl: shipment.trackingUrl || `${env.PUBLIC_BASE_URL}/track/${order.publicOrderId}`,
      labelUrl: shipment.labelUrl,
      paymentMode: order.paymentMethod,
      codAmountPaise: order.paymentMethod === "COD" ? order.totalPaise : 0,
      chargedWeightGrams: shipment.chargedWeightGrams,
      actualWeightGrams: order.items.reduce((sum, item) => sum + item.weightGramsSnapshot * item.quantity, 0),
      lengthCm: shippingSettings.defaultDimensions.lengthCm,
      widthCm: shippingSettings.defaultDimensions.widthCm,
      heightCm: shippingSettings.defaultDimensions.heightCm,
      shippingCostPaise: shipment.shippingCostPaise,
      status: "SHIPMENT_BOOKED",
      lastStatusAt: new Date(),
      rawResponseJson: shipment.raw as object,
      bookedAt: new Date()
    },
    create: {
      orderId: order.id,
      provider: "nimbuspost",
      externalShipmentId: shipment.externalShipmentId,
      courierId: shipment.courierId,
      courierName: shipment.courierName,
      awb: shipment.awb,
      trackingUrl: shipment.trackingUrl || `${env.PUBLIC_BASE_URL}/track/${order.publicOrderId}`,
      labelUrl: shipment.labelUrl,
      paymentMode: order.paymentMethod,
      codAmountPaise: order.paymentMethod === "COD" ? order.totalPaise : 0,
      chargedWeightGrams: shipment.chargedWeightGrams,
      actualWeightGrams: order.items.reduce((sum, item) => sum + item.weightGramsSnapshot * item.quantity, 0),
      lengthCm: shippingSettings.defaultDimensions.lengthCm,
      widthCm: shippingSettings.defaultDimensions.widthCm,
      heightCm: shippingSettings.defaultDimensions.heightCm,
      shippingCostPaise: shipment.shippingCostPaise,
      status: "SHIPMENT_BOOKED",
      lastStatusAt: new Date(),
      rawResponseJson: shipment.raw as object,
      bookedAt: new Date()
    }
  });
  await prisma.order.update({ where: { id: order.id }, data: { fulfilmentStatus: "SHIPMENT_BOOKED", selectedCourierJson: selected as object } });
  await enqueueJob("GENERATE_INVOICE", order.id, { publicOrderId: order.publicOrderId });
  return saved;
}

export async function applyShipmentEvent(input: { awb?: string; externalShipmentId?: string; providerStatus: string; description?: string; location?: string; eventTime?: string; raw: unknown }) {
  const shipment = await prisma.shipment.findFirst({
    where: { OR: [{ awb: input.awb }, { externalShipmentId: input.externalShipmentId }].filter((item) => Object.values(item)[0]) as any }
  });
  assertApp(shipment, "Shipment not found.", 404, "SHIPMENT_NOT_FOUND");
  const normalized = normalizeShipmentStatus(input.providerStatus);
  await prisma.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      providerStatus: input.providerStatus,
      normalizedStatus: normalized,
      description: input.description,
      location: input.location,
      eventTime: input.eventTime ? new Date(input.eventTime) : new Date(),
      rawPayloadJson: input.raw as object
    }
  });
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: normalized,
      lastStatusAt: input.eventTime ? new Date(input.eventTime) : new Date(),
      deliveredAt: normalized === "DELIVERED" ? new Date() : undefined
    }
  });
  await prisma.order.update({ where: { id: shipment.orderId }, data: { fulfilmentStatus: normalized as FulfilmentStatus } });
}
