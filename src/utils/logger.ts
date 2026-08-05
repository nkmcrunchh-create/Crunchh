import pino from "pino";
import { env, redactedKeys } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: redactedKeys.map((key) => `*.${key}`).concat(["req.headers.authorization", "req.headers.cookie"]),
    censor: "[redacted]"
  }
});
