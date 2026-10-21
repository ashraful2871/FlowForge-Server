import express, { type Express } from "express";
import { healthRoute } from "./routes/health";
import { requestLogger } from "./middleware/requestLogger";
import { notFound } from "./lib/notFound";
import { errorHandler } from "./lib/errorHandler";

export const createApp = (): Express => {
  const app = express();
  app.use(requestLogger);
  app.use(express.json({ limit: "100kb" }));
  app.use(healthRoute);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
