import { RequestHandler } from "express";
import { AppError } from "./errors";

export const notFound: RequestHandler = (req, _res, next) => {
  next(
    new AppError(404, "Not Found", `Route ${req.method} ${req.path} not found`),
  );
};
