import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { success, created } from "../utils/response";
import { authService } from "../services/auth.service";
import { REFRESH_COOKIE } from "../middleware/context";
import { env } from "../config/env";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../validators/auth.validator";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    domain: env.COOKIE_DOMAIN,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    domain: env.COOKIE_DOMAIN,
    path: "/",
  });
}

function requestMeta(req: { ip?: string; headers: Record<string, unknown>; sessionId?: string }) {
  return {
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] ?? ""),
    sessionId: req.sessionId,
  };
}

export const authController = {
  register: asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input, requestMeta(req));
    setRefreshCookie(res, result.refreshToken);
    created(res, { user: result.user, accessToken: result.accessToken });
  }),

  login: asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, requestMeta(req));
    setRefreshCookie(res, result.refreshToken);
    success(res, { user: result.user, accessToken: result.accessToken });
  }),

  refresh: asyncHandler(async (req, res) => {
    // Web sends the httpOnly cookie; native clients (Flutter) send the same
    // token in the body. Both rotate identically — additive, not breaking.
    const bodyToken =
      typeof req.body?.refreshToken === "string" && req.body.refreshToken.length > 0
        ? (req.body.refreshToken as string)
        : undefined;
    const token = bodyToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!token) {
      clearRefreshCookie(res);
      res.status(401).json({ success: false, message: "No active session", code: "INVALID_TOKEN" });
      return;
    }
    try {
      const result = await authService.refresh(token, {
        ip: req.ip,
        userAgent: String(req.headers["user-agent"] ?? ""),
      });
      setRefreshCookie(res, result.refreshToken);
      success(res, { user: result.user, accessToken: result.accessToken });
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  }),

  logout: asyncHandler(async (req, res) => {
    const bodyToken =
      typeof req.body?.refreshToken === "string" && req.body.refreshToken.length > 0
        ? (req.body.refreshToken as string)
        : undefined;
    const token = bodyToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    await authService.logout(token, req.user?.id);
    clearRefreshCookie(res);
    success(res, { ok: true });
  }),

  me: asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.id);
    success(res, result);
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const input = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(input.email);
    success(res, {
      message: "If that email exists, a reset link is on its way.",
      ...(result.devToken ? { devToken: result.devToken } : {}),
    });
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const input = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(input.token, input.password);
    clearRefreshCookie(res);
    success(res, { message: "Password updated. Please sign in again." });
  }),

  changePassword: asyncHandler(async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, input.currentPassword, input.newPassword);
    clearRefreshCookie(res);
    success(res, { message: "Password changed" });
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const result = await authService.updateProfile(req.user!.id, input);
    success(res, result);
  }),
};
