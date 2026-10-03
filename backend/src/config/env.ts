import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  COOKIE_DOMAIN: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional().default(""),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("CuddleHug <onboarding@resend.dev>"),
  DEFAULT_TAX_RATE: z.coerce.number().min(0).max(100).default(18),
  DEFAULT_SHIPPING_FEE: z.coerce.number().min(0).default(79),
  FREE_SHIPPING_THRESHOLD: z.coerce.number().min(0).default(1499),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message instead of a Prisma/JWT stack trace.
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
  throw new Error(`Invalid environment configuration:\n  ${issues}`);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

export const razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

/**
 * Dev payment mode: Razorpay keys are absent and we are not in production.
 * The checkout flow stays fully functional (real order + inventory state
 * transitions) but the payment step is simulated through the very same
 * confirmation service used for real signature verification.
 */
export const devPaymentMode = !razorpayConfigured && !isProd;

export const resendConfigured = Boolean(env.RESEND_API_KEY);

/**
 * Secret used to verify Razorpay webhook signatures. Falls back to the
 * checkout key secret when no dedicated webhook secret is configured.
 */
export const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;
export const webhookConfigured = Boolean(webhookSecret);

/** True when a Firebase service account is provided and push can be sent. */
export const pushConfigured = Boolean(env.FIREBASE_SERVICE_ACCOUNT);
