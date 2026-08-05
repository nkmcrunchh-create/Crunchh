import { Router } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { processDueJobs } from "../jobs/worker.js";

export const internalRouter = Router();

internalRouter.post("/api/internal/jobs/process-due", async (req, res, next) => {
  try {
    const secret = req.headers["x-internal-job-secret"];
    if (!env.INTERNAL_JOB_SECRET || secret !== env.INTERNAL_JOB_SECRET) {
      throw new AppError("Internal job trigger rejected.", 401, "INTERNAL_AUTH_REQUIRED");
    }
    res.json(await processDueJobs(25));
  } catch (error) {
    next(error);
  }
});
