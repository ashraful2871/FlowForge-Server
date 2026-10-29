import type { RequestHandler } from "express";
import { config } from "../config";
import { csrfRejectedError } from "../lib/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const originCheck: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");

  if (!origin || !config.CORS_ORIGINS.includes(origin)) {
    next(csrfRejectedError());
    return;
  }
  next();
};
