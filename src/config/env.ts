import "dotenv/config";
import { z } from "zod";

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  return value;
}, z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  DATABASE_PROVIDER: z.enum(["postgres", "d1"]).default("postgres"),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_D1_DATABASE_ID: z.string().optional(),
  CLOUDFLARE_D1_API_TOKEN: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  INTERNAL_JOB_SECRET: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_AUTO_CAPTURE: booleanEnv.default(true),
  SHIPPING_PROVIDER: z.enum(["mock", "nimbuspost"]).default("mock"),
  NIMBUSPOST_MOCK_MODE: booleanEnv.default(true),
  NIMBUSPOST_BASE_URL: z.string().optional(),
  NIMBUSPOST_AUTH_PATH: z.string().optional(),
  NIMBUSPOST_SERVICEABILITY_PATH: z.string().optional(),
  NIMBUSPOST_RATES_PATH: z.string().optional(),
  NIMBUSPOST_CREATE_SHIPMENT_PATH: z.string().optional(),
  NIMBUSPOST_TRACKING_PATH: z.string().optional(),
  NIMBUSPOST_CANCEL_PATH: z.string().optional(),
  NIMBUSPOST_LABEL_PATH: z.string().optional(),
  NIMBUSPOST_API_EMAIL: z.string().optional(),
  NIMBUSPOST_API_PASSWORD: z.string().optional(),
  NIMBUSPOST_API_KEY: z.string().optional(),
  NIMBUSPOST_API_SECRET: z.string().optional(),
  NIMBUSPOST_WEBHOOK_SECRET: z.string().optional(),
  NIMBUSPOST_WEBHOOK_ROUTE_TOKEN: z.string().optional(),
  NIMBUSPOST_PICKUP_LOCATION_ID: z.string().optional(),
  NIMBUSPOST_PICKUP_PINCODE: z.string().optional(),
  NIMBUSPOST_RETURN_LOCATION_ID: z.string().optional(),
  DEFAULT_PACKAGE_LENGTH_CM: z.coerce.number().default(18),
  DEFAULT_PACKAGE_WIDTH_CM: z.coerce.number().default(14),
  DEFAULT_PACKAGE_HEIGHT_CM: z.coerce.number().default(6),
  DEFAULT_EMPTY_PACKAGE_WEIGHT_GRAMS: z.coerce.number().default(35),
  WHATSAPP_ENABLED: booleanEnv.default(false),
  WHATSAPP_GRAPH_API_VERSION: z.string().default("v21.0"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_ORDER_CONFIRMED_TEMPLATE: z.string().default("crunchh_order_confirmed"),
  WHATSAPP_FALLBACK_ORDER_CONFIRMED_TEMPLATE: z.string().default("crunchh_order_confirmed_text"),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default("en"),
  WHATSAPP_SUPPORT_NUMBER: z.string().default("917303033324"),
  STORAGE_PROVIDER: z.enum(["local", "supabase", "r2"]).default("local"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_INVOICE_BUCKET: z.string().default("invoices"),
  LOCAL_STORAGE_DIR: z.string().default("tmp/storage"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_INVOICE_BUCKET: z.string().default("crunchh-invoices"),
  R2_PUBLIC_CUSTOM_DOMAIN: z.string().optional(),
  SELLER_LEGAL_NAME: z.string().default("TRISHUL GROUPS LLP"),
  SELLER_BRAND_NAME: z.string().default("CRUNCHH"),
  SELLER_GSTIN: z.string().optional(),
  SELLER_REGISTERED_ADDRESS: z.string().optional(),
  SELLER_DISPATCH_ADDRESS: z.string().optional(),
  SELLER_STATE: z.string().optional(),
  SELLER_STATE_CODE: z.string().optional(),
  SELLER_EMAIL: z.string().optional(),
  SELLER_PHONE: z.string().default("917303033324"),
  SELLER_WEBSITE: z.string().url().default("https://crunchh.store"),
  INVOICE_PREFIX: z.string().default("CRH"),
  INVOICE_LOGO_PATH: z.string().default("assets/img/optimized/crunchh-logo-seal.png"),
  NCR_PREPAID_SHIPPING_PAISE: z.coerce.number().default(4900),
  NCR_COD_SHIPPING_PAISE: z.coerce.number().default(6900),
  FREE_SHIPPING_THRESHOLD_PAISE: z.coerce.number().default(49900),
  MAX_COD_ORDER_PAISE: z.coerce.number().default(500000),
  COD_ENABLED: booleanEnv.default(true),
  NCR_STATES: z.string().default("Delhi,Haryana,Uttar Pradesh"),
  NCR_POSTAL_CODES: z.string().default(""),
  FALLBACK_SHIPPING_PAISE: z.coerce.number().default(7900),
  TAX_INCLUSIVE_PRICES: booleanEnv.default(true),
  DEFAULT_PRODUCT_TAX_RATE_BPS: z.coerce.number().default(1200),
  SHIPPING_TAX_RATE_BPS: z.coerce.number().default(1800),
  OUTBOX_ENABLED: booleanEnv.default(false),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(15000),
  MAX_JOB_ATTEMPTS: z.coerce.number().default(8),
  LOG_LEVEL: z.string().default("info")
});

export const env = schema.parse(process.env);

export const corsOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean);

export function assertProductionReadiness() {
  if (env.NODE_ENV !== "production") return;
  const missing = [
    ["SESSION_SECRET", env.SESSION_SECRET],
    ["INTERNAL_JOB_SECRET", env.INTERNAL_JOB_SECRET],
    ["SELLER_GSTIN", env.SELLER_GSTIN],
    ["SELLER_REGISTERED_ADDRESS", env.SELLER_REGISTERED_ADDRESS],
    ["SELLER_DISPATCH_ADDRESS", env.SELLER_DISPATCH_ADDRESS],
    ["SELLER_STATE", env.SELLER_STATE],
    ["SELLER_STATE_CODE", env.SELLER_STATE_CODE]
  ].filter(([, value]) => !value);
  if (missing.length) {
    throw new Error(`Production readiness failed. Missing: ${missing.map(([key]) => key).join(", ")}`);
  }
  if (env.DATABASE_PROVIDER === "postgres" && !env.DATABASE_URL) {
    throw new Error("Production readiness failed. DATABASE_URL is required for Postgres.");
  }
  if (env.DATABASE_PROVIDER === "d1") {
    const missingD1 = [
      ["CLOUDFLARE_ACCOUNT_ID", env.CLOUDFLARE_ACCOUNT_ID],
      ["CLOUDFLARE_D1_DATABASE_ID", env.CLOUDFLARE_D1_DATABASE_ID],
      ["CLOUDFLARE_D1_API_TOKEN", env.CLOUDFLARE_D1_API_TOKEN]
    ].filter(([, value]) => !value);
    if (missingD1.length) throw new Error(`Production readiness failed. Missing D1 settings: ${missingD1.map(([key]) => key).join(", ")}`);
  }
  if (env.WHATSAPP_ENABLED) {
    const missingWhatsApp = [
      ["WHATSAPP_ACCESS_TOKEN", env.WHATSAPP_ACCESS_TOKEN],
      ["WHATSAPP_PHONE_NUMBER_ID", env.WHATSAPP_PHONE_NUMBER_ID],
      ["WHATSAPP_BUSINESS_ACCOUNT_ID", env.WHATSAPP_BUSINESS_ACCOUNT_ID],
      ["WHATSAPP_APP_SECRET", env.WHATSAPP_APP_SECRET],
      ["WHATSAPP_WEBHOOK_VERIFY_TOKEN", env.WHATSAPP_WEBHOOK_VERIFY_TOKEN]
    ].filter(([, value]) => !value);
    if (missingWhatsApp.length) throw new Error(`Production readiness failed. Missing WhatsApp settings: ${missingWhatsApp.map(([key]) => key).join(", ")}`);
  }
  if (env.STORAGE_PROVIDER === "r2") {
    const missingR2 = [
      ["R2_ACCOUNT_ID", env.R2_ACCOUNT_ID],
      ["R2_ACCESS_KEY_ID", env.R2_ACCESS_KEY_ID],
      ["R2_SECRET_ACCESS_KEY", env.R2_SECRET_ACCESS_KEY],
      ["R2_INVOICE_BUCKET", env.R2_INVOICE_BUCKET]
    ].filter(([, value]) => !value);
    if (missingR2.length) throw new Error(`Production readiness failed. Missing R2 settings: ${missingR2.map(([key]) => key).join(", ")}`);
  }
}

export const redactedKeys = [
  "secret",
  "token",
  "password",
  "authorization",
  "service_role",
  "key_secret",
  "app_secret"
];
