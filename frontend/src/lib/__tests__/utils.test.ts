import { describe, expect, it } from "vitest";
import { absoluteUrl, cn, resolveAssetUrl } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("px-2", undefined, "py-1")).toBe("px-2 py-1");
  });
});

describe("absoluteUrl", () => {
  it("prefixes the site origin", () => {
    expect(absoluteUrl("/shop")).toContain("/shop");
    expect(absoluteUrl("shop")).toContain("/shop");
    expect(absoluteUrl()).toMatch(/^http/);
  });
});

describe("resolveAssetUrl", () => {
  it("leaves public images untouched", () => {
    expect(resolveAssetUrl("/images/08_product_brown_teddy.jpg")).toBe("/images/08_product_brown_teddy.jpg");
  });

  it("keeps upload paths on the same origin when no API origin is configured", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(resolveAssetUrl("/uploads/abc.jpg")).toBe("/uploads/abc.jpg");
  });

  it("prefixes backend upload paths when an API origin is configured", () => {
    const previous = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:5000";
    expect(resolveAssetUrl("/uploads/abc.jpg")).toBe("http://localhost:5000/uploads/abc.jpg");
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previous;
  });

  it("keeps absolute and data urls", () => {
    expect(resolveAssetUrl("https://cdn.example.com/bear.jpg")).toBe("https://cdn.example.com/bear.jpg");
    expect(resolveAssetUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  it("handles null", () => {
    expect(resolveAssetUrl(null)).toBe("");
    expect(resolveAssetUrl(undefined)).toBe("");
  });
});
