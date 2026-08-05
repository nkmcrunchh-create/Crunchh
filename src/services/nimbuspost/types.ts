import { PaymentMethod } from "@prisma/client";

export type ServiceabilityInput = {
  pickupPincode: string;
  deliveryPincode: string;
  paymentMethod: PaymentMethod;
  codAmountPaise: number;
};

export type ServiceabilityResult = {
  serviceable: boolean;
  codAvailable: boolean;
  estimatedDeliveryDate?: string;
  raw?: unknown;
};

export type RateRequest = ServiceabilityInput & {
  weightGrams: number;
  declaredValuePaise: number;
};

export type ShippingRate = {
  courierId: string;
  courierName: string;
  forwardChargePaise: number;
  codChargePaise: number;
  rtoChargePaise?: number;
  estimatedDeliveryDate?: string;
  performanceScore?: number;
  serviceable: boolean;
  codAvailable: boolean;
  raw?: unknown;
};

export type CreateShipmentInput = {
  publicOrderId: string;
  paymentMethod: PaymentMethod;
  codAmountPaise: number;
  declaredValuePaise: number;
  totalWeightGrams: number;
  dimensions: { lengthCm: number; widthCm: number; heightCm: number };
  courierId?: string;
  customer: { name: string; mobile: string; email: string };
  address: {
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: Array<{ sku: string; name: string; quantity: number; unitPricePaise: number; weightGrams: number }>;
};

export type CreatedShipment = {
  externalShipmentId: string;
  courierId?: string;
  courierName: string;
  awb: string;
  trackingUrl: string;
  labelUrl?: string;
  chargedWeightGrams?: number;
  shippingCostPaise?: number;
  raw?: unknown;
};

export type TrackingRequest = { awb?: string; externalShipmentId?: string };
export type TrackingResult = {
  currentStatus: string;
  estimatedDeliveryDate?: string;
  events: Array<{ providerStatus: string; description?: string; location?: string; eventTime: string; raw?: unknown }>;
  raw?: unknown;
};
export type CancelShipmentInput = TrackingRequest & { reason?: string };
export type CancelResult = { cancelled: boolean; raw?: unknown };
export type LabelRequest = TrackingRequest;
export type LabelResult = { labelUrl: string; raw?: unknown };

export interface ShippingProvider {
  checkServiceability(input: ServiceabilityInput): Promise<ServiceabilityResult>;
  getRates(input: RateRequest): Promise<ShippingRate[]>;
  createShipment(input: CreateShipmentInput): Promise<CreatedShipment>;
  getTracking(input: TrackingRequest): Promise<TrackingResult>;
  cancelShipment(input: CancelShipmentInput): Promise<CancelResult>;
  generateLabel(input: LabelRequest): Promise<LabelResult>;
}
