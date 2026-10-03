export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "OUT_OF_STOCK"
  | "INVALID_COUPON"
  | "PAYMENT_NOT_CONFIGURED"
  | "PAYMENT_SIGNATURE_INVALID"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_BLOCKED"
  | "INVALID_TOKEN"
  | "CART_EMPTY"
  | "INVALID_STATE"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = "INTERNAL_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = statusCode < 500;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, code: ErrorCode = "BAD_REQUEST", details?: unknown) {
    return new AppError(message, 400, code, details);
  }
  static unauthorized(message = "Authentication required", code: ErrorCode = "UNAUTHORIZED") {
    return new AppError(message, 401, code);
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new AppError(message, 403, "FORBIDDEN");
  }
  static notFound(message = "Resource not found") {
    return new AppError(message, 404, "NOT_FOUND");
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(message, 409, "CONFLICT", details);
  }
}

export const isAppError = (err: unknown): err is AppError => err instanceof AppError;
