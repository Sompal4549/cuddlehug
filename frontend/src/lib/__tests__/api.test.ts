import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";

type Call = { url: string; method: string; body?: string };

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(responder: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    return responder(call);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("returns data from a success envelope", async () => {
    mockFetch(() => jsonResponse({ success: true, data: { items: [{ id: "1" }] } }));
    const result = await api.get<{ items: { id: string }[] }>("/products");
    expect(result.items).toHaveLength(1);
  });

  it("surfaces meta for paginated lists", async () => {
    mockFetch(() =>
      jsonResponse({
        success: true,
        data: { items: [] },
        meta: { page: 2, limit: 12, total: 40, totalPages: 4 },
      }),
    );
    const { data, meta } = await api.getFull<{ items: unknown[] }>("/admin/orders", { query: { page: 2 } });
    expect(data.items).toEqual([]);
    expect(meta?.totalPages).toBe(4);
  });

  it("serializes query parameters and skips empty values", async () => {
    const { calls } = mockFetch(() => jsonResponse({ success: true, data: null }));
    await api.get("/products", { query: { search: "teddy", page: 1, category: undefined, q: "" } });
    const url = new URL(calls[0].url);
    expect(url.searchParams.get("search")).toBe("teddy");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.has("category")).toBe(false);
    expect(url.searchParams.has("q")).toBe(false);
  });

  it("throws ApiError with the server message", async () => {
    mockFetch(() => jsonResponse({ success: false, message: "Cart is empty", code: "EMPTY_CART" }, 400));
    await expect(api.get("/cart")).rejects.toMatchObject({
      name: "ApiError",
      message: "Cart is empty",
      status: 400,
      code: "EMPTY_CART",
    });
    await expect(api.get("/cart")).rejects.toBeInstanceOf(ApiError);
  });

  it("refreshes the session once and retries after a 401", async () => {
    const { calls, fetchMock } = mockFetch((call) => {
      if (call.url.includes("/api/auth/refresh")) return jsonResponse({ success: true, data: { ok: true } });
      const firstAttempt = calls.filter((entry) => entry.url === call.url).length <= 1;
      if (call.url.includes("/api/orders") && firstAttempt) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
      }
      return jsonResponse({ success: true, data: { id: "order-1" } });
    });

    const result = await api.get<{ id: string }>("/orders");
    expect(result.id).toBe("order-1");
    expect(fetchMock).toHaveBeenCalledTimes(3); // original + refresh + retry
  });

  it("reports network failures clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api.get("/products")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });
});
