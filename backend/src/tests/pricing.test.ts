import { describe, expect, it } from "vitest";
import { computePricing, pricingToDto, type PricingLine } from "../services/pricing";
import type { Settings } from "../services/settings.service";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  "store.name": "CuddleHug",
  "store.tagline": "More Happiness. More Hugs.",
  "store.logo": "/images/logo.svg",
  "store.status": "open",
  "store.currency": "INR",
  "tax.enabled": true,
  "tax.rate": 18,
  "shipping.fee": 79,
  "shipping.freeThreshold": 1499,
  "shipping.codEnabled": true,
  "contact.email": "hello@cuddlehug.com",
  "contact.phone": "+91 98765 43210",
  "contact.address": "Bengaluru, Karnataka, India",
  "social.instagram": "https://instagram.com/cuddlehug",
  "social.facebook": "https://facebook.com/cuddlehug",
  "social.twitter": "https://x.com/cuddlehug",
  "social.youtube": "https://youtube.com/@cuddlehug",
  "payment.razorpayEnabled": true,
  ...overrides,
});

const mini: PricingLine = { variantId: "v-mini", unitPrice: "749", mrp: "999", quantity: 3 };
const giant: PricingLine = { variantId: "v-giant", unitPrice: "4999", mrp: "5999", quantity: 1 };

describe("computePricing", () => {
  it("computes line totals from server-side prices only", () => {
    const result = computePricing({ lines: [mini], settings: settings() });
    expect(result.subtotal).toBe(224700n);
    expect(result.mrpTotal).toBe(299700n);
    expect(result.productSavings).toBe(75000n);
    expect(result.lines[0].lineTotal).toBe("2247.00");
  });

  it("applies a percentage coupon and unlocks free shipping", () => {
    const result = computePricing({
      lines: [mini],
      coupon: { type: "PERCENTAGE", value: "10" },
      settings: settings(),
    });
    expect(result.couponDiscount).toBe(22470n);
    expect(result.discountedSubtotal).toBe(202230n);
    expect(result.shipping).toBe(0n);
    expect(result.freeShippingUnlocked).toBe(true);
    expect(result.tax).toBe(36401n);
    expect(result.total).toBe(238631n);
    expect(pricingToDto(result).total).toBe("2386.31");
  });

  it("charges shipping below the free threshold", () => {
    const result = computePricing({
      lines: [{ variantId: "v", unitPrice: "199", mrp: "249", quantity: 1 }],
      settings: settings(),
    });
    expect(result.freeShippingUnlocked).toBe(false);
    expect(result.shipping).toBe(7900n);
    expect(result.tax).toBe(3582n); // 18% of 199.00
    expect(result.total).toBe(19900n + 7900n + 3582n);
  });

  it("skips tax when tax is disabled", () => {
    const result = computePricing({ lines: [mini], settings: settings({ "tax.enabled": false }) });
    expect(result.tax).toBe(0n);
    expect(result.total).toBe(result.discountedSubtotal + result.shipping);
  });

  it("caps coupon discount at maxDiscount", () => {
    const result = computePricing({
      lines: [mini],
      coupon: { type: "PERCENTAGE", value: "50", maxDiscount: "100" },
      settings: settings(),
    });
    expect(result.couponDiscount).toBe(10000n);
  });

  it("restricts coupon eligibility to matching variants", () => {
    const result = computePricing({
      lines: [mini, giant],
      coupon: { type: "PERCENTAGE", value: "10", variantIds: ["v-giant"] },
      settings: settings(),
    });
    expect(result.subtotal).toBe(724600n);
    expect(result.couponDiscount).toBe(49990n); // 10% of 4999.00 only
  });

  it("honours a minimum order amount", () => {
    const result = computePricing({
      lines: [mini],
      coupon: { type: "FIXED", value: "500", minOrderAmount: "5000" },
      settings: settings(),
    });
    expect(result.couponDiscount).toBe(0n);
  });

  it("clamps fixed discounts to the order value", () => {
    const result = computePricing({
      lines: [{ variantId: "v", unitPrice: "100", mrp: "120", quantity: 1 }],
      coupon: { type: "FIXED", value: "500" },
      settings: settings(),
    });
    expect(result.couponDiscount).toBe(10000n);
    expect(result.discountedSubtotal).toBe(0n);
  });

  it("never produces a negative total", () => {
    const result = computePricing({
      lines: [{ variantId: "v", unitPrice: "100", mrp: "120", quantity: 1 }],
      coupon: { type: "FIXED", value: "999" },
      settings: settings({ "tax.enabled": true }),
    });
    expect(result.total).toBeGreaterThanOrEqual(0n);
  });
});
