/**
 * Money helpers. All arithmetic happens in integer minor units (paise) using
 * BigInt - floats are never used as the source of truth for money.
 */

export type Money = string | number | bigint | { toString(): string };

export function toMinor(value: Money): bigint {
  if (typeof value === "bigint") return value; // already minor units
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Invalid money value: ${value}`);
    value = value.toFixed(2);
  }
  const str = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(str);
  if (!match) throw new Error(`Invalid money value: ${str}`);
  const [, sign, whole, frac = ""] = match;
  const padded = (frac + "0000").slice(0, 2);
  const minor = BigInt(whole) * 100n + BigInt(padded);
  return sign === "-" ? -minor : minor;
}

export function fromMinor(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${negative ? "-" : ""}${whole}.${frac.toString().padStart(2, "0")}`;
}

export const add = (...values: Money[]): bigint => values.reduce<bigint>((acc, v) => acc + toMinor(v), 0n);
export const subtract = (a: Money, ...rest: Money[]): bigint =>
  rest.reduce<bigint>((acc, v) => acc - toMinor(v), toMinor(a));

/** Percentage of an amount, rounded half-up (e.g. 18% of 100.00 -> 18.00). */
export function percentOf(amount: Money, percent: number): bigint {
  const minor = toMinor(amount);
  const bps = BigInt(Math.round(percent * 100));
  const product = minor * bps;
  const half = 10000n;
  const negative = product < 0n;
  const abs = negative ? -product : product;
  const rounded = (abs + half / 2n) / half;
  return negative ? -rounded : rounded;
}

/** Discount from an MRP-based percentage, rounded half-up. */
export function discountFromMrp(mrp: Money, sellingPrice: Money): bigint {
  const diff = toMinor(mrp) - toMinor(sellingPrice);
  return diff > 0n ? diff : 0n;
}

export function applyPercentDiscount(amount: Money, percent: number, cap?: Money | null): bigint {
  let discount = percentOf(amount, percent);
  if (cap !== undefined && cap !== null) {
    const capMinor = toMinor(cap);
    if (discount > capMinor) discount = capMinor;
  }
  const amountMinor = toMinor(amount);
  if (discount > amountMinor) discount = amountMinor;
  if (discount < 0n) discount = 0n;
  return discount;
}

export function applyFixedDiscount(amount: Money, discount: Money): bigint {
  let d = toMinor(discount);
  const amountMinor = toMinor(amount);
  if (d > amountMinor) d = amountMinor;
  if (d < 0n) d = 0n;
  return d;
}

export const clampNonNegative = (v: bigint): bigint => (v < 0n ? 0n : v);

export const percentOff = (mrp: Money, price: Money): number => {
  const m = toMinor(mrp);
  if (m <= 0n) return 0;
  const d = discountFromMrp(mrp, price);
  return Number((d * 10000n) / m) / 100;
};
