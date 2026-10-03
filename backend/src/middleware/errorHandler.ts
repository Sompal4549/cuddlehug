import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, isAppError } from "../utils/errors";
import { logger } from "../utils/logger";
import { env } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, "NOT_FOUND"));
}

function prismaError(error: Prisma.PrismaClientKnownRequestError): AppError | null {
  switch (error.code) {
    case "P2002":
      return new AppError("A record with this value already exists", 409, "CONFLICT", {
        fields: (error.meta?.target as string[] | undefined) ?? [],
      });
    case "P2025":
      return new AppError("Record not found", 404, "NOT_FOUND");
    case "P2003":
      return new AppError("Related record missing", 400, "BAD_REQUEST");
    case "P2021":
      return new AppError("Table not found - run migrations", 500, "INTERNAL_ERROR");
    case "P2010":
      return new AppError("Database query failed", 500, "INTERNAL_ERROR");
    default:
      return null;
  }
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = "Something went wrong";
  let code = "INTERNAL_ERROR";
  let details: unknown;

  if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
  } else if (isAppError(error)) {
    status = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = prismaError(error);
    if (mapped) {
      status = mapped.statusCode;
      message = mapped.message;
      code = mapped.code;
      details = mapped.details;
    } else {
      message = "Database error";
    }
  } else if (error instanceof SyntaxError && "body" in error) {
    status = 400;
    code = "BAD_REQUEST";
    message = "Malformed JSON body";
  } else if (error instanceof Error) {
    message = error.message;
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status} ${message}`, {
      stack: error instanceof Error ? error.stack : undefined,
    });
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${status} ${code}: ${message}`);
  }

  res.status(status).json({
    success: false,
    message: status >= 500 && env.NODE_ENV === "production" ? "Something went wrong" : message,
    code,
    ...(details !== undefined && env.NODE_ENV !== "production" ? { details } : {}),
  });
}
