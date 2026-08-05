import { env } from "./env.js";

export const sellerConfig = {
  legalName: env.SELLER_LEGAL_NAME,
  brandName: env.SELLER_BRAND_NAME,
  gstin: env.SELLER_GSTIN || "DEV_PLACEHOLDER_GSTIN",
  registeredAddress: env.SELLER_REGISTERED_ADDRESS || "DEV PLACEHOLDER REGISTERED ADDRESS",
  dispatchAddress: env.SELLER_DISPATCH_ADDRESS || "DEV PLACEHOLDER DISPATCH ADDRESS",
  state: env.SELLER_STATE || "DEV_PLACEHOLDER_STATE",
  stateCode: env.SELLER_STATE_CODE || "00",
  phone: env.SELLER_PHONE,
  email: env.SELLER_EMAIL || "support@crunchh.store",
  website: env.SELLER_WEBSITE,
  invoicePrefix: env.INVOICE_PREFIX,
  logoPath: env.INVOICE_LOGO_PATH
};

export const shippingSettings = {
  ncrPrepaidShippingPaise: env.NCR_PREPAID_SHIPPING_PAISE,
  ncrCodShippingPaise: env.NCR_COD_SHIPPING_PAISE,
  freeShippingThresholdPaise: env.FREE_SHIPPING_THRESHOLD_PAISE,
  maxCodOrderPaise: env.MAX_COD_ORDER_PAISE,
  codEnabled: env.COD_ENABLED,
  ncrStates: env.NCR_STATES.split(",").map((state) => state.trim().toLowerCase()).filter(Boolean),
  ncrPostalCodes: env.NCR_POSTAL_CODES.split(",").map((pin) => pin.trim()).filter(Boolean),
  fallbackShippingPaise: env.FALLBACK_SHIPPING_PAISE,
  defaultDimensions: {
    lengthCm: env.DEFAULT_PACKAGE_LENGTH_CM,
    widthCm: env.DEFAULT_PACKAGE_WIDTH_CM,
    heightCm: env.DEFAULT_PACKAGE_HEIGHT_CM,
    emptyWeightGrams: env.DEFAULT_EMPTY_PACKAGE_WEIGHT_GRAMS
  }
};
