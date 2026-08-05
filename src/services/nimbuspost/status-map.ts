import { FulfilmentStatus } from "@prisma/client";

const statusMap: Record<string, FulfilmentStatus> = {
  booked: "SHIPMENT_BOOKED",
  manifested: "SHIPMENT_BOOKED",
  pickup_scheduled: "SHIPMENT_BOOKED",
  picked_up: "PICKED_UP",
  in_transit: "IN_TRANSIT",
  out_for_delivery: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  ndr: "NDR",
  delivery_failed: "NDR",
  rto_initiated: "RTO_INITIATED",
  rto_delivered: "RTO_DELIVERED",
  cancelled: "CANCELLED"
};

export function normalizeShipmentStatus(providerStatus: string): FulfilmentStatus {
  const normalized = providerStatus.trim().toLowerCase().replace(/\s+/g, "_");
  return statusMap[normalized] || "IN_TRANSIT";
}
