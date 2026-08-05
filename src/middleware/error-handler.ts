import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function notFound(_req: any, res: any) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
}

export function errorHandler(error: unknown, _req: any, res: any, _next: any) {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request.", details: error.flatten() } });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: { code: error.code, message: error.message, details: error.details } });
  }
  logger.error({ err: error }, "unhandled request error");
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error." } });
}
