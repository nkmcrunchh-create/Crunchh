import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { corsOrigins, env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "img-src": ["'self'", "data:", "https:"],
      "script-src": ["'self'"],
      "connect-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"]
    }
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) return callback(null, true);
    callback(new AppError("Origin is not allowed.", 403, "CORS_FORBIDDEN"));
  },
  credentials: true
});

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false
});

export function requireAdmin(req: any, res: any, next: any) {
  if (req.session?.adminUserId) return next();
  return res.status(401).json({ error: { code: "ADMIN_AUTH_REQUIRED", message: "Admin login required." } });
}

export function csrfOriginGuard(req: any, res: any, next: any) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin || corsOrigins.includes(origin)) return next();
  return res.status(403).json({ error: { code: "CSRF_ORIGIN_REJECTED", message: "Request origin rejected." } });
}
