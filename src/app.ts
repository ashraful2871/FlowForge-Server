import cors from "cors";
import express, { type Express } from "express";
import { healthRoute } from "./routes/health";
import { requestLogger } from "./middleware/requestLogger";
import { notFound } from "./lib/notFound";
import { errorHandler } from "./lib/errorHandler";
import helmet from "helmet";
import { config } from "./config";
import { createApiRouter } from "./routes";
import cookieParser from "cookie-parser";
import { originCheck } from "./middleware/originCheck";

export const createApp = (): Express => {
  const app = express();
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(healthRoute);
  app.use(originCheck);
  app.use("/api/v1", createApiRouter());
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
