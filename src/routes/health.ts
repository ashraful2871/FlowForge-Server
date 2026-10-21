import { Router } from "express";

export const healthRoute = Router();

healthRoute.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

healthRoute.get("/ready", (req, res) => {});
