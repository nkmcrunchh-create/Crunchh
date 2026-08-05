import { Router } from "express";
import { createCheckoutOrder } from "../services/orders.js";

export const checkoutRouter = Router();

checkoutRouter.post("/api/checkout/orders", async (req, res, next) => {
  try {
    const order = await createCheckoutOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});
