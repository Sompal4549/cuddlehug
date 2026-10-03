import { prisma } from "../config/prisma";
import { env } from "../config/env";

export type Settings = {
  "store.name": string;
  "store.tagline": string;
  "store.logo": string;
  "store.status": "open" | "closed";
  "store.currency": string;
  "tax.enabled": boolean;
  "tax.rate": number;
  "shipping.fee": number;
  "shipping.freeThreshold": number;
  "shipping.codEnabled": boolean;
  "contact.email": string;
  "contact.phone": string;
  "contact.address": string;
  "social.instagram": string;
  "social.facebook": string;
  "social.twitter": string;
  "social.youtube": string;
  "payment.razorpayEnabled": boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  "store.name": "CuddleHug",
  "store.tagline": "More Happiness. More Hugs.",
  "store.logo": "/images/logo.svg",
  "store.status": "open",
  "store.currency": "INR",
  "tax.enabled": true,
  "tax.rate": env.DEFAULT_TAX_RATE,
  "shipping.fee": env.DEFAULT_SHIPPING_FEE,
  "shipping.freeThreshold": env.FREE_SHIPPING_THRESHOLD,
  "shipping.codEnabled": true,
  "contact.email": "hello@cuddlehug.com",
  "contact.phone": "+91 98765 43210",
  "contact.address": "CuddleHug Studios, Bengaluru, Karnataka, India",
  "social.instagram": "https://instagram.com/cuddlehug",
  "social.facebook": "https://facebook.com/cuddlehug",
  "social.twitter": "https://x.com/cuddlehug",
  "social.youtube": "https://youtube.com/@cuddlehug",
  "payment.razorpayEnabled": env.NODE_ENV !== "production",
};

let cache: { value: Settings; at: number } | null = null;
const TTL_MS = 15_000;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await prisma.siteSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
  }
  cache = { value: merged as Settings, at: Date.now() };
  return merged as Settings;
}

export function invalidateSettingsCache() {
  cache = null;
}

export async function updateSettings(input: Record<string, unknown>): Promise<Settings> {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const entries = Object.entries(input).filter(([key]) => allowed.includes(key));
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.siteSetting.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      }),
    ),
  );
  invalidateSettingsCache();
  return getSettings();
}

export function publicSettings(settings: Settings) {
  return {
    ...settings,
    // the backend (not the frontend) decides whether payments are usable
    "payment.razorpayEnabled": settings["payment.razorpayEnabled"] && env.RAZORPAY_KEY_ID !== "",
  };
}
