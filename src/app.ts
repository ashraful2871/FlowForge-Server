import express, { type Express } from "express";
import { healthRoute } from "./routes/health";

export const createApp = (): Express => {
  const app = express();
  app.use(healthRoute);

  return app;
};
