import type { Settings } from "./settings.service";
import {
  applyFixedDiscount,
  applyPercentDiscount,
  clampNonNegative,
  fromMinor,
  percentOf,
  subtract,
  toMinor,
  type Money,
} from "../utils/money";

export type PricingLine = {
  variantId: string;
  unitPrice: Money;
  mrp: Money;
  quantity: number;
};

export type CouponForPricing = {
  type: "PERCENTAGE" | "FIXED";
  value: Money;
  maxDiscount?: Money | null;
  minOrderAmount?: Money;
  /** Restriction: only these variant ids are eligible (empty = all). */
  variantIds?: string[];
};

export type LinePricing = {
  variantId: string;
  quantity: number;
  unitPrice: string;
  mrp: string;
  lineTotal: string;
  lineMrpTotal: string;
  savings: string;
};

export type PricingResult = {
  lines: LinePricing[];
  subtotal: bigint;
  mrpTotal: bigint;
  productSavings: bigint;
  couponDiscount: bigint;
  discountedSubtotal: bigint;
  shipping: bigint;
  tax: bigint;
  total: bigint;
  freeShippingUnlocked: boolean;
};

/**
 * Single source of truth for cart / order money math. Everything is computed
 * in integer minor units (paise) from server-side prices.
 */
export function computePricing(params: {
  lines: PricingLine[];
  coupon?: CouponForPricing | null;
  settings: Settings;
  couponCode?: string | null;
}): PricingResult {
  const { lines, coupon, settings } = params;

  let subtotal = 0n;
  let mrpTotal = 0n;
  const lineResults: LinePricing[] = [];

  for (const line of lines) {
    const unit = toMinor(line.unitPrice);
    const mrp = toMinor(line.mrp);
    const qty = BigInt(Math.max(0, line.quantity));
    const lineTotal = unit * qty;
    const lineMrpTotal = mrp * qty;
    subtotal += lineTotal;
    mrpTotal += lineMrpTotal;
    lineResults.push({
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: fromMinor(unit),
      mrp: fromMinor(mrp),
      lineTotal: fromMinor(lineTotal),
      lineMrpTotal: fromMinor(lineMrpTotal),
      savings: fromMinor(clampNonNegative(lineMrpTotal - lineTotal)),
    });
  }

  const productSavings = clampNonNegative(mrpTotal - subtotal);

  let couponDiscount = 0n;
  if (coupon) {
    const restricted = coupon.variantIds && coupon.variantIds.length > 0;
    const eligibleBase = restricted
      ? lines
          .filter((l) => coupon.variantIds!.includes(l.variantId))
          .reduce<bigint>((acc, l) => acc + toMinor(l.unitPrice) * BigInt(l.quantity), 0n)
      : subtotal;

    const minOrder = coupon.minOrderAmount ? toMinor(coupon.minOrderAmount) : 0n;
    if (subtotal >= minOrder) {
      couponDiscount =
        coupon.type === "PERCENTAGE"
          ? applyPercentDiscount(eligibleBase, Number(coupon.value), coupon.maxDiscount ?? null)
          : applyFixedDiscount(eligibleBase, coupon.value);
    }
  }

  const discountedSubtotal = clampNonNegative(subtotal - couponDiscount);
  const freeThreshold = toMinor(settings["shipping.freeThreshold"]);
  const freeShippingUnlocked = freeThreshold > 0n && discountedSubtotal >= freeThreshold;
  const shipping = freeShippingUnlocked ? 0n : toMinor(settings["shipping.fee"]);
  const tax = settings["tax.enabled"]
    ? percentOf(discountedSubtotal, Number(settings["tax.rate"]))
    : 0n;
  const total = discountedSubtotal + shipping + tax;

  return {
    lines: lineResults,
    subtotal,
    mrpTotal,
    productSavings,
    couponDiscount,
    discountedSubtotal,
    shipping,
    tax,
    total,
    freeShippingUnlocked,
  };
}

export function pricingToDto(pricing: PricingResult) {
  return {
    subtotal: fromMinor(pricing.subtotal),
    mrpTotal: fromMinor(pricing.mrpTotal),
    productSavings: fromMinor(pricing.productSavings),
    couponDiscount: fromMinor(pricing.couponDiscount),
    discountedSubtotal: fromMinor(pricing.discountedSubtotal),
    shipping: fromMinor(pricing.shipping),
    tax: fromMinor(pricing.tax),
    total: fromMinor(pricing.total),
    freeShippingUnlocked: pricing.freeShippingUnlocked,
    lines: pricing.lines,
  };
}

export const moneyDifference = (a: Money, b: Money) => fromMinor(subtract(a, b));
