import { describe, expect, it } from "vitest";
import {
  add,
  applyFixedDiscount,
  applyPercentDiscount,
  clampNonNegative,
  discountFromMrp,
  fromMinor,
  percentOf,
  percentOff,
  subtract,
  toMinor,
} from "../utils/money";

describe("money: conversion", () => {
  it("converts rupee strings to paise", () => {
    expect(toMinor("749")).toBe(74900n);
    expect(toMinor("749.5")).toBe(74950n);
    expect(toMinor("0.05")).toBe(5n);
    expect(toMinor("1234.99")).toBe(123499n);
  });

  it("converts numbers without float drift", () => {
    expect(toMinor(749)).toBe(74900n);
    expect(toMinor(0.1)).toBe(10n);
    expect(toMinor(19.99)).toBe(1999n);
  });

  it("treats bigints as already-minor units (no double conversion)", () => {
    expect(toMinor(74900n)).toBe(74900n);
    expect(toMinor(-100n)).toBe(-100n);
  });

  it("rejects malformed values", () => {
    expect(() => toMinor("abc")).toThrow();
    expect(() => toMinor("1.234.5")).toThrow();
    expect(() => toMinor(Number.NaN)).toThrow();
  });

  it("formats minor units back to strings", () => {
    expect(fromMinor(74900n)).toBe("749.00");
    expect(fromMinor(5n)).toBe("0.05");
    expect(fromMinor(-250n)).toBe("-2.50");
    expect(fromMinor(0n)).toBe("0.00");
  });
});

describe("money: arithmetic", () => {
  it("adds and subtracts mixed inputs", () => {
    expect(add("100.00", 5000n, 0.5)).toBe(15050n);
    expect(subtract("100.00", "40.50")).toBe(5950n);
  });

  it("clamps at zero", () => {
    expect(clampNonNegative(10n - 50n)).toBe(0n);
  });

  it("computes percentages with half-up rounding", () => {
    expect(percentOf(10000n, 18)).toBe(1800n);
    expect(percentOf("100.00", 18)).toBe(1800n);
    expect(percentOf(224700n, 10)).toBe(22470n);
    expect(percentOf("33.33", 15)).toBe(500n); // 499.95 -> 500
  });

  it("caps percentage discounts at the maximum and at the amount", () => {
    expect(applyPercentDiscount("1000.00", 20, "100.00")).toBe(10000n);
    expect(applyPercentDiscount("50.00", 20, "100.00")).toBe(1000n);
    expect(applyPercentDiscount("10.00", 500)).toBe(1000n);
  });

  it("never returns a discount larger than the amount", () => {
    expect(applyFixedDiscount("20.00", "50.00")).toBe(2000n);
    expect(applyFixedDiscount("20.00", "-5.00")).toBe(0n);
  });

  it("derives savings from MRP", () => {
    expect(discountFromMrp("999", "749")).toBe(25000n);
    expect(discountFromMrp("700", "749")).toBe(0n);
    expect(percentOff("999", "749")).toBe(25.02);
  });
});
