import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  hashToken,
  randomToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/token";
import { emails } from "../utils/mailer";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import { audit } from "../middleware/context";
import { mergeCarts } from "./cart.service";
import { pushService } from "./push.service";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "../validators/auth.validator";

const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const RESET_TTL_MS = 1000 * 60 * 30;

export type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
};

export function toSafeUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    status: user.status,
    createdAt: user.createdAt,
  };
}

async function issueTokens(user: { id: string; email: string; role: Role }, meta: { ip?: string; userAgent?: string }) {
  const jti = randomToken(16);
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
    },
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput, meta: { ip?: string; userAgent?: string; sessionId?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw AppError.conflict("An account with this email already exists");

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        role: Role.CUSTOMER,
        wishlist: { create: {} },
      },
    });

    if (meta.sessionId) await mergeCarts({ sessionId: meta.sessionId, userId: user.id });

    const tokens = await issueTokens(user, meta);
    await audit({ userId: user.id, action: "auth.register", entity: "User", entityId: user.id, ip: meta.ip });
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "GENERAL",
        title: "Welcome to CuddleHug",
        body: "Thanks for joining! Use cuddle10 on your first order for 10% off.",
      },
    });
    void pushService.sendToUser(user.id, {
      title: "Welcome to CuddleHug",
      body: "Thanks for joining! Use cuddle10 on your first order for 10% off.",
      data: { type: "GENERAL" },
    });

    return { user: toSafeUser(user), ...tokens };
  },

  async login(input: LoginInput, meta: { ip?: string; userAgent?: string; sessionId?: string }) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    if (user.status === "BLOCKED") throw new AppError("This account has been blocked", 403, "ACCOUNT_BLOCKED");

    if (meta.sessionId) await mergeCarts({ sessionId: meta.sessionId, userId: user.id });

    const tokens = await issueTokens(user, meta);
    await audit({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id, ip: meta.ip });
    return { user: toSafeUser(user), ...tokens };
  },

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const payload = verifyRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!stored) throw new AppError("Session expired, please sign in again", 401, "INVALID_TOKEN");
    if (stored.revokedAt) {
      // A rotated token is being replayed: assume compromise and revoke every
      // active session for this user instead of only the presented one.
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError("Session expired, please sign in again", 401, "INVALID_TOKEN");
    }
    if (stored.expiresAt.getTime() < Date.now())
      throw new AppError("Session expired, please sign in again", 401, "INVALID_TOKEN");
    if (stored.userId !== payload.sub) throw new AppError("Invalid session", 401, "INVALID_TOKEN");

    const user = stored.user;
    if (user.status === "BLOCKED") throw new AppError("This account has been blocked", 403, "ACCOUNT_BLOCKED");

    // refresh token rotation
    const next = await issueTokens(user, meta);
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return { user: toSafeUser(user), accessToken: next.accessToken, refreshToken: next.refreshToken };
  },

  async logout(refreshToken: string | undefined, userId?: string) {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (userId) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("User not found");
    const counts = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.wishlistItem.count({ where: { wishlist: { userId } } }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return {
      user: toSafeUser(user),
      stats: { orders: counts[0], wishlist: counts[1], unreadNotifications: counts[2] },
    };
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    // Always answer the same way to avoid account enumeration.
    if (!user) return { ok: true, devToken: undefined as string | undefined };

    const raw = randomToken(32);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${raw}`;
    await emails.passwordReset(user.email, resetUrl);

    // Convenience for local development without an email provider.
    const devToken = env.NODE_ENV === "production" ? undefined : raw;
    if (devToken) logger.info(`[dev] password reset token for ${email}: ${devToken}`);
    return { ok: true, devToken };
  },

  async resetPassword(token: string, password: string) {
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new AppError("This reset link is invalid or has expired", 400, "INVALID_TOKEN");
    }
    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await audit({ userId: record.userId, action: "auth.reset_password", entity: "User", entityId: record.userId });
    return { ok: true };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("User not found");
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new AppError("Current password is incorrect", 400, "BAD_REQUEST");

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit({ userId, action: "auth.change_password", entity: "User", entityId: userId });
    return { ok: true };
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone === undefined ? undefined : input.phone,
        avatarUrl: input.avatarUrl,
      },
    });
    await audit({ userId, action: "user.update_profile", entity: "User", entityId: userId });
    return { user: toSafeUser(user) };
  },
};
