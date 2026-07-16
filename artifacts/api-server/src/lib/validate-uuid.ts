import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../middlewares/error-handler";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reusable check — true if `value` is a syntactically valid UUID (any version). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Express `router.param()` handler factory: validates that a route param is a
 * well-formed UUID before any handler runs, so malformed values fail fast with
 * HTTP 400 instead of reaching the database as an invalid-input query error.
 *
 * Usage: `router.param("id", requireUuidParam("id"));`
 */
export function requireUuidParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction, value: string): void => {
    if (!isUuid(value)) {
      next(new HttpError(400, `Invalid ${paramName}: expected a UUID`));
      return;
    }
    next();
  };
}
