import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { logger } from "../lib/logger";
const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const incoming = req.headers["x-request-id"];
    const id =
      typeof incoming === "string" && VALID_ID.test(incoming)
        ? incoming
        : randomUUID();

    res.setHeader("X-Request-Id", id);

    return id;
  },
});
