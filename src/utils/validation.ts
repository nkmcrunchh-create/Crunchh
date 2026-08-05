import { z } from "zod";

export const indianPincodeSchema = z.string().regex(/^\d{6}$/, "PIN code must be six digits");

export const checkoutOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(180),
    mobile: z.string().min(10).max(20),
    whatsappOptIn: z.literal(true)
  }),
  shippingAddress: z.object({
    line1: z.string().min(4).max(180),
    line2: z.string().max(180).optional().nullable(),
    landmark: z.string().max(120).optional().nullable(),
    city: z.string().min(2).max(80),
    district: z.string().max(80).optional().nullable(),
    state: z.string().min(2).max(80),
    postalCode: indianPincodeSchema,
    country: z.string().default("IN"),
    addressType: z.string().default("SHIPPING")
  }),
  cartItems: z.array(z.object({
    productId: z.string().min(2),
    quantity: z.coerce.number().int().min(1).max(30),
    claimedUnitPricePaise: z.coerce.number().int().optional()
  })).min(1).max(20),
  paymentMethod: z.enum(["PREPAID", "COD"]),
  couponCode: z.string().max(40).optional().nullable(),
  customerNote: z.string().max(500).optional().nullable(),
  source: z.string().max(40).default("web")
});

export const serviceabilitySchema = z.object({
  postalCode: indianPincodeSchema,
  paymentMethod: z.enum(["PREPAID", "COD"]).default("PREPAID")
});

export const shippingQuoteSchema = z.object({
  postalCode: indianPincodeSchema,
  state: z.string().min(2),
  paymentMethod: z.enum(["PREPAID", "COD"]),
  subtotalPaise: z.coerce.number().int().min(0).optional()
});

export const razorpayOrderSchema = z.object({
  publicOrderId: z.string().regex(/^CRH-\d{8}-[A-Z0-9]{4,10}$/)
});

export const razorpayVerifySchema = z.object({
  publicOrderId: z.string(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string()
});

export const codConfirmSchema = z.object({
  mobile: z.string().min(10),
  otp: z.string().optional()
});

export const invoiceAccessSchema = z.object({
  mobile: z.string().min(10).optional(),
  token: z.string().optional()
});
