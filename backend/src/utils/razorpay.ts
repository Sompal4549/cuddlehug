import { env, razorpayConfigured } from "../config/env";
import { AppError } from "./errors";
import { hmacSha256Hex, timingSafeEqualHex } from "./token";
import { logger } from "./logger";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
};

function authHeader(): string {
  return `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

/**
 * Creates a Razorpay order server-side. Amount is always derived from the
 * server-side order total (never from the client).
 */
export async function createRazorpayOrder(params: {
  amountMinor: bigint;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!razorpayConfigured) {
    throw new AppError(
      "Payments are not configured on this server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      503,
      "PAYMENT_NOT_CONFIGURED",
    );
  }

  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Number(params.amountMinor),
      currency: params.currency ?? "INR",
      receipt: params.receipt,
      notes: params.notes ?? {},
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as RazorpayOrder & {
    error?: { code?: string; description?: string };
  };

  if (!response.ok) {
    logger.error("Razorpay order creation failed", payload);
    throw new AppError(
      payload.error?.description ?? "Unable to create payment order",
      502,
      "BAD_REQUEST",
    );
  }

  return payload;
}

/**
 * Verifies the checkout signature returned by Razorpay:
 * HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!razorpayConfigured) return false;
  const expected = hmacSha256Hex(
    env.RAZORPAY_KEY_SECRET,
    `${params.orderId}|${params.paymentId}`,
  );
  return timingSafeEqualHex(expected, params.signature);
}

export function verifyRazorpayWebhookSignature(body: string, signature: string): boolean {
  // Razorpay signs webhook bodies with the webhook secret configured in the
  // dashboard; fall back to the checkout key secret when none is set.
  const secret = env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = hmacSha256Hex(secret, body);
  return timingSafeEqualHex(expected, signature);
}
