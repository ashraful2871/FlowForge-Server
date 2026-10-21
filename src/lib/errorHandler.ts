import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errors";
import { ZodError } from "zod";

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestid: unknown,
  fields?: Record<string, string>,
): void {
  res.status(status).json({ error: { code, message, requestid, fields } });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    req.log.warn({ code: err.code, status: err.status }, err.message);
    sendError(res, err.status, err.code, err.message, req.id, err.fields);
    return;
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issues of err.issues) {
      const key = issues.path.map(String).join(",") || "body";
      fields[key] ??= issues.message;
    }

    req.log.warn({ fields }, "validations Failed");
    sendError(res, 422, "VALIDATION_ERROR", "invalid request", req.id, fields);
    return;
  }

  if (typeof err === "object" && err !== null && "type" in err) {
    if (err.type === "entity.parse.failed") {
      req.log.warn("Malformed JSON body");
      sendError(res, 400, "BAD_REQUEST", "Malformed JSON body", req.id);
      return;
    }
    if (err.type === "entity.too.large") {
      req.log.warn("Request body too large");
      sendError(
        res,
        413,
        "PAYLOAD_TOO_LARGE",
        "Request body too large",
        req.id,
      );
      return;
    }
  }

  req.log.error({ err }, "unhandled error");
  sendError(res, 500, "INTERNAL", "Something went wrong", req.id);
}
