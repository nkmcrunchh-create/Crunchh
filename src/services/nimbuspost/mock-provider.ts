import { env } from "../../config/env.js";
import { shippingSettings } from "../../config/business.js";
import { CreatedShipment, ShippingProvider } from "./types.js";

export class MockShippingProvider implements ShippingProvider {
  async checkServiceability() {
    return {
      serviceable: true,
      codAvailable: true,
      estimatedDeliveryDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
      raw: { mock: true }
    };
  }

  async getRates(input: Parameters<ShippingProvider["getRates"]>[0]) {
    return [
      {
        courierId: "mock-fast",
        courierName: "Mock Express",
        forwardChargePaise: input.paymentMethod === "COD" ? shippingSettings.ncrCodShippingPaise : shippingSettings.ncrPrepaidShippingPaise,
        codChargePaise: input.paymentMethod === "COD" ? 2000 : 0,
        rtoChargePaise: 4500,
        estimatedDeliveryDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        performanceScore: 94,
        serviceable: true,
        codAvailable: true,
        raw: { mock: true }
      }
    ];
  }

  async createShipment(input: Parameters<ShippingProvider["createShipment"]>[0]): Promise<CreatedShipment> {
    const suffix = input.publicOrderId.split("-").at(-1) || Date.now().toString();
    return {
      externalShipmentId: `MOCK-SHP-${suffix}`,
      courierId: input.courierId || "mock-fast",
      courierName: "Mock Express",
      awb: `CRHMOCK${suffix}`,
      trackingUrl: `${env.PUBLIC_BASE_URL}/track/${input.publicOrderId}`,
      labelUrl: `${env.PUBLIC_BASE_URL}/api/orders/${input.publicOrderId}/label/mock`,
      chargedWeightGrams: Math.max(input.totalWeightGrams, 500),
      shippingCostPaise: input.paymentMethod === "COD" ? shippingSettings.ncrCodShippingPaise : shippingSettings.ncrPrepaidShippingPaise,
      raw: { mock: true, input }
    };
  }

  async getTracking() {
    const now = new Date();
    return {
      currentStatus: "booked",
      estimatedDeliveryDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      events: [
        { providerStatus: "booked", description: "Shipment booked", location: "Noida", eventTime: now.toISOString(), raw: { mock: true } }
      ],
      raw: { mock: true }
    };
  }

  async cancelShipment() {
    return { cancelled: true, raw: { mock: true } };
  }

  async generateLabel() {
    return { labelUrl: `${env.PUBLIC_BASE_URL}/mock-label.pdf`, raw: { mock: true } };
  }
}
