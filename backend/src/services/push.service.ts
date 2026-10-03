import { DevicePlatform } from "@prisma/client";
import { readFileSync } from "node:fs";
import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging, type MulticastMessage } from "firebase-admin/messaging";
import { env, pushConfigured } from "../config/env";
import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";

let app: App | null = null;
let messaging: Messaging | null = null;
let initFailed = false;

/**
 * Lazily initialises firebase-admin from FIREBASE_SERVICE_ACCOUNT
 * (inline JSON or a path to a service-account file). Any failure is
 * swallowed after the first attempt: push must never break the
 * notification write path.
 */
function getMessagingClient(): Messaging | null {
  if (initFailed) return null;
  if (messaging) return messaging;
  try {
    const raw = env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (!raw) return null;

    const serviceAccount: unknown = raw.startsWith("{")
      ? JSON.parse(raw)
      : JSON.parse(readFileSync(raw, "utf8"));

    const existing = getApps();
    app = existing.length > 0 ? existing[0] : initializeApp({ credential: cert(serviceAccount as never) });
    messaging = getMessaging(app);
    return messaging;
  } catch (error) {
    initFailed = true;
    logger.warn(`[push] firebase-admin init failed: ${(error as Error).message}`);
    return null;
  }
}

/** FCM payloads only accept string maps. */
function toStringData(data?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;
      out[key] = String(value);
    }
  }
  return out;
}

const INVALID_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export const pushService = {
  configured: () => pushConfigured,

  async registerDevice(params: {
    userId: string;
    token: string;
    platform: DevicePlatform;
    appId?: string | null;
  }) {
    const token = params.token.trim();
    await prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId: params.userId,
        token,
        platform: params.platform,
        appId: params.appId ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        userId: params.userId,
        platform: params.platform,
        appId: params.appId ?? null,
        lastSeenAt: new Date(),
      },
    });
    return { ok: true as const };
  },

  async unregisterDevice(userId: string, token: string) {
    await prisma.deviceToken.deleteMany({ where: { token: token.trim(), userId } });
    return { ok: true as const };
  },

  /**
   * Best-effort push delivery for an already-persisted Notification row.
   * Never throws: a push failure must not roll back business operations.
   */
  async sendToUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ): Promise<void> {
    if (!pushConfigured) return;
    const client = getMessagingClient();
    if (!client) return;

    try {
      const devices = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
      if (devices.length === 0) return;

      const message: MulticastMessage = {
        tokens: devices.map((d) => d.token),
        notification: { title: payload.title, body: payload.body },
        data: toStringData(payload.data),
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      };

      const response = await client.sendEachForMulticast(message);

      // Cleanup tokens FCM reports as invalid so we stop retrying them.
      const stale: string[] = [];
      response.responses.forEach((item, index) => {
        if (item.error && INVALID_TOKEN_ERRORS.has(item.error.code)) {
          stale.push(devices[index]!.token);
        }
      });
      if (stale.length > 0) {
        await prisma.deviceToken.deleteMany({ where: { token: { in: stale } } });
      }
    } catch (error) {
      logger.warn(`[push] send failed: ${(error as Error).message}`);
    }
  },
};
