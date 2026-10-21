import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./lib/db";
import { logger } from "./lib/logger";

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

let shuttingDown = false;

async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;

  shuttingDown = true;
  logger.info({ reason }, "Shutting down");

  const forceExit = setTimeout(() => {
    logger.error("Shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();
  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
    logger.info("Shutdown complete");
    process.exit(exitCode);
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "Unhandled promise rejection");
  void shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  void shutdown("uncaughtException", 1);
});
