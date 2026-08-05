import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "crunchh-commerce" });
});

healthRouter.get("/ready", async (_req, res) => {
  const checks: Record<string, boolean> = {
    config: true,
    database: false,
    mockShippingAllowed: env.NODE_ENV !== "production" || env.SHIPPING_PROVIDER !== "mock"
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }
  const ready = Object.values(checks).every(Boolean);
  res.status(ready ? 200 : 503).json({ ready, checks });
});
