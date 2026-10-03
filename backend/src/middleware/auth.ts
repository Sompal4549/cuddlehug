import type { RequestHandler } from "express";
import { verifyAccessToken, hashToken } from "../utils/token";
import { AppError } from "../utils/errors";
import { prisma } from "../config/prisma";

/** Parses the access token when present, but never rejects the request. */
export const attachUser: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(header.slice(7));
      req.user = { id: payload.sub, role: payload.role, email: payload.email };
    } catch {
      // expired / invalid access token -> treated as anonymous
    }
  }
  next();
};

/** Requires a valid access token. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized("You must be signed in"));
  next();
};

/** Requires an authenticated ADMIN. Backend-side RBAC - never rely on the UI. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized("You must be signed in"));
  if (req.user.role !== "ADMIN") return next(AppError.forbidden("Admin access required"));
  next();
};

export const optionalAuth = attachUser;

/**
 * Validates that the refresh token cookie exists in the database (rotation
 * aware) before the auth service consumes it.
 */
export async function assertRefreshTokenAlive(token: string): Promise<void> {
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!stored) throw new AppError("Refresh token no longer valid", 401, "INVALID_TOKEN");
  if (stored.revokedAt) throw new AppError("Refresh token was revoked", 401, "INVALID_TOKEN");
  if (stored.expiresAt.getTime() < Date.now()) throw new AppError("Refresh token expired", 401, "INVALID_TOKEN");
}
