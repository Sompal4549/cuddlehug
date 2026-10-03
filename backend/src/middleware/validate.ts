import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type Source = "body" | "query" | "params";

/** Zod request validation middleware - parses or throws a ZodError. */
export function validate(schema: ZodType, source: Source = "body"): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    // assign parsed value back so services receive coerced, trimmed data
    if (source === "body") req.body = result.data;
    else Object.assign(req[source] as Record<string, unknown>, result.data);
    next();
  };
}
