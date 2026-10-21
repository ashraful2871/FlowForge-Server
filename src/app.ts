import express, { type Express } from "express";
import { healthRoute } from "./routes/health";
import { requestLogger } from "./middleware/requestLogger";

export const createApp = (): Express => {
  const app = express();
  app.use(requestLogger);
  app.use(healthRoute);

  return app;
};
