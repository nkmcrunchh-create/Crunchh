import { Router } from "express";
import { env } from "../config/env.js";
import { serviceabilitySchema, shippingQuoteSchema } from "../utils/validation.js";
import { getShippingProvider } from "../services/nimbuspost/index.js";
import { calculateShipping } from "../services/pricing.js";

export const shippingRouter = Router();

shippingRouter.post("/api/shipping/serviceability", async (req, res, next) => {
  try {
    const parsed = serviceabilitySchema.parse(req.body);
    const result = await getShippingProvider().checkServiceability({
      pickupPincode: env.NIMBUSPOST_PICKUP_PINCODE || "201301",
      deliveryPincode: parsed.postalCode,
      paymentMethod: parsed.paymentMethod,
      codAmountPaise: 0
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

shippingRouter.post("/api/shipping/quote", async (req, res, next) => {
  try {
    const parsed = shippingQuoteSchema.parse(req.body);
    const shippingPaise = calculateShipping({
      subtotalPaise: parsed.subtotalPaise || 0,
      state: parsed.state,
      postalCode: parsed.postalCode,
      paymentMethod: parsed.paymentMethod
    });
    res.json({ shippingPaise });
  } catch (error) {
    next(error);
  }
});
