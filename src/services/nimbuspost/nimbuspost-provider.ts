import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { mapCrunchhShipmentToNimbusPost } from "./mapping.js";
import { ShippingProvider } from "./types.js";

type Method = "GET" | "POST";

export class NimbusPostShippingProvider implements ShippingProvider {
  private assertConfigured(path?: string) {
    if (!env.NIMBUSPOST_BASE_URL || !path) {
      throw new AppError(
        "NimbusPost production endpoint mapping is incomplete. Supply merchant API documentation and configure the exact path.",
        503,
        "NIMBUSPOST_MAPPING_REQUIRED"
      );
    }
  }

  private async request<T>(method: Method, path: string | undefined, body?: unknown): Promise<T> {
    this.assertConfigured(path);
    const response = await fetch(new URL(path!, env.NIMBUSPOST_BASE_URL), {
      method,
      headers: {
        "content-type": "application/json",
        ...(env.NIMBUSPOST_API_KEY ? { "x-api-key": env.NIMBUSPOST_API_KEY } : {}),
        ...(env.NIMBUSPOST_API_SECRET ? { "x-api-secret": env.NIMBUSPOST_API_SECRET } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new AppError(`NimbusPost API error: ${response.status}`, response.status >= 500 ? 503 : 400, "NIMBUSPOST_ERROR", text);
    }
    return response.json() as Promise<T>;
  }

  async checkServiceability(input: Parameters<ShippingProvider["checkServiceability"]>[0]) {
    const raw = await this.request<Record<string, unknown>>("POST", env.NIMBUSPOST_SERVICEABILITY_PATH, input);
    return {
      serviceable: Boolean(raw.serviceable ?? raw.available),
      codAvailable: Boolean(raw.codAvailable ?? raw.cod_available),
      estimatedDeliveryDate: String(raw.estimatedDeliveryDate ?? raw.edd ?? ""),
      raw
    };
  }

  async getRates(input: Parameters<ShippingProvider["getRates"]>[0]) {
    const raw = await this.request<{ rates?: any[]; data?: any[] }>("POST", env.NIMBUSPOST_RATES_PATH, input);
    const rows = raw.rates || raw.data || [];
    return rows.map((rate) => ({
      courierId: String(rate.courier_id ?? rate.courierId),
      courierName: String(rate.courier_name ?? rate.courierName),
      forwardChargePaise: Math.round(Number(rate.forward_charge ?? rate.forwardCharge ?? 0) * 100),
      codChargePaise: Math.round(Number(rate.cod_charge ?? rate.codCharge ?? 0) * 100),
      rtoChargePaise: Math.round(Number(rate.rto_charge ?? rate.rtoCharge ?? 0) * 100),
      estimatedDeliveryDate: rate.edd || rate.estimatedDeliveryDate,
      performanceScore: Number(rate.performance_score ?? rate.performanceScore ?? 0),
      serviceable: Boolean(rate.serviceable ?? true),
      codAvailable: Boolean(rate.cod_available ?? rate.codAvailable ?? true),
      raw: rate
    }));
  }

  async createShipment(input: Parameters<ShippingProvider["createShipment"]>[0]) {
    const raw = await this.request<Record<string, any>>("POST", env.NIMBUSPOST_CREATE_SHIPMENT_PATH, mapCrunchhShipmentToNimbusPost(input));
    return {
      externalShipmentId: String(raw.shipment_id ?? raw.externalShipmentId ?? raw.data?.shipment_id),
      courierId: String(raw.courier_id ?? raw.data?.courier_id ?? input.courierId ?? ""),
      courierName: String(raw.courier_name ?? raw.data?.courier_name ?? "NimbusPost"),
      awb: String(raw.awb ?? raw.data?.awb),
      trackingUrl: String(raw.tracking_url ?? raw.data?.tracking_url ?? ""),
      labelUrl: raw.label_url ?? raw.data?.label_url,
      chargedWeightGrams: Math.round(Number(raw.charged_weight ?? raw.data?.charged_weight ?? 0) * 1000) || undefined,
      shippingCostPaise: Math.round(Number(raw.shipping_cost ?? raw.data?.shipping_cost ?? 0) * 100) || undefined,
      raw
    };
  }

  async getTracking(input: Parameters<ShippingProvider["getTracking"]>[0]) {
    const raw = await this.request<Record<string, any>>("POST", env.NIMBUSPOST_TRACKING_PATH, input);
    const events = raw.events || raw.data?.events || [];
    return {
      currentStatus: String(raw.current_status ?? raw.data?.current_status ?? events.at(-1)?.status ?? "in_transit"),
      estimatedDeliveryDate: raw.edd ?? raw.data?.edd,
      events: events.map((event: any) => ({
        providerStatus: String(event.status),
        description: event.description,
        location: event.location,
        eventTime: event.event_time || event.time || new Date().toISOString(),
        raw: event
      })),
      raw
    };
  }

  async cancelShipment(input: Parameters<ShippingProvider["cancelShipment"]>[0]) {
    const raw = await this.request<Record<string, unknown>>("POST", env.NIMBUSPOST_CANCEL_PATH, input);
    return { cancelled: Boolean(raw.cancelled ?? raw.success), raw };
  }

  async generateLabel(input: Parameters<ShippingProvider["generateLabel"]>[0]) {
    const raw = await this.request<Record<string, any>>("POST", env.NIMBUSPOST_LABEL_PATH, input);
    return { labelUrl: String(raw.label_url ?? raw.data?.label_url), raw };
  }
}
