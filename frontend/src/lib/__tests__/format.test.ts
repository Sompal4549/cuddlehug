import { describe, expect, it } from "vitest";
import {
  discountLabel,
  formatMoney,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  orderStatusTone,
  pluralize,
} from "@/lib/format";

describe("formatMoney", () => {
  it("formats rupee amounts", () => {
    expect(formatMoney(1499)).toBe("₹1,499");
    expect(formatMoney("2499.5")).toBe("₹2,499.5");
    expect(formatMoney("0")).toBe("₹0");
  });

  it("handles null-ish values", () => {
    expect(formatMoney(null)).toBe("₹0");
    expect(formatMoney(undefined)).toBe("₹0");
    expect(formatMoney("")).toBe("₹0");
    expect(formatMoney("not-a-number")).toBe("₹0");
  });
});

describe("discountLabel", () => {
  it("computes percentage off", () => {
    expect(discountLabel("2499", "1799")).toBe("28% off");
  });

  it("returns nothing when there is no discount", () => {
    expect(discountLabel("999", "999")).toBe("");
    expect(discountLabel("999", "1099")).toBe("");
  });
});

describe("order helpers", () => {
  it("labels every status", () => {
    for (const status of Object.keys(ORDER_STATUS_FLOW)) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("keeps terminal states terminal", () => {
    expect(ORDER_STATUS_FLOW.CANCELLED).toEqual([]);
    expect(ORDER_STATUS_FLOW.REFUNDED).toEqual([]);
  });

  it("assigns sensible tones", () => {
    expect(orderStatusTone("DELIVERED")).toBe("success");
    expect(orderStatusTone("PENDING")).toBe("warning");
    expect(orderStatusTone("CANCELLED")).toBe("destructive");
    expect(orderStatusTone("SHIPPED")).toBe("info");
  });
});

describe("pluralize", () => {
  it("handles singular and plural", () => {
    expect(pluralize(1, "bear")).toBe("1 bear");
    expect(pluralize(3, "bear")).toBe("3 bears");
    expect(pluralize(2, "box", "boxes")).toBe("2 boxes");
  });
});
