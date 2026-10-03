import rateLimit from "express-rate-limit";
import { env, isTest } from "../config/env";

const disabled = isTest;

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
  message: { success: false, message: "Too many requests, please try again later", code: "RATE_LIMITED" },
});

/** Tighter limit for credential endpoints. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
  message: { success: false, message: "Too many attempts, please try again later", code: "RATE_LIMITED" },
});

/** Password reset / forgot-password endpoint limit. */
export const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => disabled,
  message: { success: false, message: "Too many requests, please try again later", code: "RATE_LIMITED" },
});
