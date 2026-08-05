import path from "node:path";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { PrismaAdminSessionStore } from "./db/admin-session-store.js";
import { apiRateLimit, corsMiddleware, csrfOriginGuard, helmetMiddleware } from "./middleware/security.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { productsRouter } from "./routes/products.js";
import { checkoutRouter } from "./routes/checkout.js";
import { paymentsRouter } from "./routes/payments.js";
import { shippingRouter } from "./routes/shipping.js";
import { ordersRouter } from "./routes/orders.js";
import { adminRouter } from "./routes/admin.js";
import { internalRouter } from "./routes/internal.js";

export function createApp() {
  const app = express();
  const httpLogger = pinoHttp as unknown as (options: { logger: typeof logger }) => express.RequestHandler;
  app.set("trust proxy", 1);
  app.use(httpLogger({ logger }));
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(cookieParser());

  app.use("/api/webhooks", express.raw({ type: "application/json", limit: "1mb" }));
  app.use(webhooksRouter);

  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "128kb" }));
  app.use(apiRateLimit);
  app.use(csrfOriginGuard);
  app.use(session({
    store: new PrismaAdminSessionStore(),
    name: "crunchh.sid",
    secret: env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000
    }
  }));

  app.use(healthRouter);
  app.use(productsRouter);
  app.use(checkoutRouter);
  app.use(paymentsRouter);
  app.use(shippingRouter);
  app.use(ordersRouter);
  app.use(adminRouter);
  app.use(internalRouter);

  app.use("/assets", express.static(path.join(process.cwd(), "assets"), { immutable: false, maxAge: "1h" }));
  app.get("/", (_req, res) => res.sendFile(path.join(process.cwd(), "index.html")));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
