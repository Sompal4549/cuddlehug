import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "../config/prisma";

export const requestId: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
};

/**
 * Guest carts: the browser gets an httpOnly session cookie that identifies the
 * anonymous cart. It is merged into the user cart on login/register.
 */
export const sessionIdCookie = "ch_sid";
export const REFRESH_COOKIE = "ch_refresh";

export const sessionMiddleware: RequestHandler = (req, res, next) => {
  const existing = req.cookies?.[sessionIdCookie] as string | undefined;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) {
    req.sessionId = existing;
    next();
    return;
  }
  const sid = randomUUID();
  req.sessionId = sid;
  res.cookie(sessionIdCookie, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  next();
};

export async function audit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        meta: (params.meta ?? undefined) as never,
        ip: params.ip ?? null,
      },
    });
  } catch (error) {
    // Auditing must never break the main flow.
    void error;
  }
}
