import { Router } from "express";
import { prisma } from "../lib/db";

export const healthRoute = Router();

healthRoute.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

healthRoute.get("/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch (err) {
    req.log.warn({ err }, "Readiness check failed");
    res.status(503).json({ status: "unavailable" });
  }
});
