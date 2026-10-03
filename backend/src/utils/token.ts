import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errors";

export type AccessTokenPayload = {
  sub: string;
  role: "CUSTOMER" | "ADMIN";
  email: string;
  type: "access";
  /** Unique per issuance so back-to-back tokens never collide. */
  jti: string;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  type: "refresh";
};

export function signAccessToken(payload: Omit<AccessTokenPayload, "type" | "jti">): string {
  return jwt.sign({ ...payload, jti: randomToken(12), type: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: "cuddlehug",
  });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: "cuddlehug",
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "cuddlehug" }) as AccessTokenPayload;
    if (decoded.type !== "access") throw new Error("wrong token type");
    return decoded;
  } catch {
    throw new AppError("Session expired or invalid", 401, "UNAUTHORIZED");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: "cuddlehug" }) as RefreshTokenPayload;
    if (decoded.type !== "refresh") throw new Error("wrong token type");
    return decoded;
  } catch {
    throw new AppError("Invalid or expired refresh token", 401, "INVALID_TOKEN");
  }
}

/** One-way hash used to persist refresh / reset tokens in the database. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(secret: string, input: string): string {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
