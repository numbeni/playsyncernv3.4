import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

/**
 * Thrown by route/middleware code to produce a specific HTTP status with a
 * client-safe message. Anything else (unexpected errors) is treated as a
 * 500 and its details are never sent to the client.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly detail: unknown;

  constructor(statusCode: number, message: string, detail?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

/** 404 handler for routes that don't match anything — must be mounted last. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

/**
 * Centralized error handler — must be mounted last, after all routes.
 * Express recognizes this as an error middleware because it takes 4 args.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    // A response already started streaming; nothing safe to do but log.
    logger.error(err, "Error occurred after response headers were sent");
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.detail !== undefined ? { detail: err.detail } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", issues: err.issues });
    return;
  }

  // express.json() throws a SyntaxError (with a body-parser `type`) on malformed JSON.
  if (
    err instanceof SyntaxError &&
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err as { type?: unknown }).type === "entity.parse.failed"
  ) {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }

  // body-parser reports oversized bodies via this `type`.
  if (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err as { type?: unknown }).type === "entity.too.large"
  ) {
    res.status(413).json({ error: "Request body too large" });
    return;
  }

  logger.error(err, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
}
