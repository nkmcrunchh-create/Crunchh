import { createApp } from "./app.js";
import { assertProductionReadiness, env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { startOutboxWorker } from "./jobs/worker.js";

assertProductionReadiness();

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "CRUNCHH commerce server listening");
});

startOutboxWorker();

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
