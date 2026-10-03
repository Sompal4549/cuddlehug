/**
 * End-to-end smoke test against a running API (default http://localhost:5000).
 * Run: node scripts/smoke.mjs   (backend must be started first)
 */
const BASE = process.env.API_URL ?? "http://localhost:5000";

const results = [];
let cookie = "";
let refreshCookie = "";
let accessToken = "";
let adminToken = "";

function log(name, ok, info = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? ` - ${info}` : ""}`);
}

async function call(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const entry of setCookie) {
    if (entry.startsWith("ch_refresh=")) refreshCookie = entry.split(";")[0];
    if (entry.startsWith("ch_sid=")) {
      const sid = entry.split(";")[0];
      cookie = [cookie, sid].filter(Boolean).join("; ");
    }
  }
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  // 1. health
  {
    const r = await call("GET", "/health");
    log("health", r.status === 200 && r.json.success === true);
  }

  // 2. catalogue
  let variantId = "";
  let productId = "";
  let productSlug = "";
  {
    const r = await call("GET", "/products?limit=5&sort=bestselling");
    const items = r.json.data?.items ?? [];
    log("product listing", r.status === 200 && items.length > 0, `${items.length} products`);
    productId = items[0]?.id;
    productSlug = items[0]?.slug;
    variantId = items[0]?.variants?.[0]?.id;
  }
  {
    const r = await call("GET", "/products?search=giant+teddy");
    log("product search", r.status === 200 && (r.json.data?.items?.length ?? 0) > 0);
  }
  {
    const r = await call("GET", "/categories");
    log("categories", r.status === 200 && r.json.data?.items?.length === 6);
  }
  {
    const r = await call("GET", `/products/${productSlug}`);
    log("product detail by slug", r.status === 200 && (r.json.data?.variants?.length ?? 0) > 0);
  }

  // 3. registration + auth
  const email = `smoke_${Date.now()}@example.com`;
  {
    const r = await call("POST", "/auth/register", {
      firstName: "Smoke",
      lastName: "Tester",
      email,
      password: "Smoke1234",
    });
    accessToken = r.json.data?.accessToken;
    log("register", r.status === 201 && Boolean(accessToken));
  }
  {
    const r = await call("POST", "/auth/login", { email, password: "Smoke1234" });
    accessToken = r.json.data?.accessToken;
    log("login", r.status === 200 && Boolean(accessToken));
  }
  {
    const r = await call("GET", "/auth/me", undefined, accessToken);
    log("me", r.status === 200 && r.json.data?.user?.email === email);
  }

  // 4. refresh token rotation
  {
    const headers = { "Content-Type": "application/json", Cookie: refreshCookie };
    const res = await fetch(`${BASE}/api/auth/refresh`, { method: "POST", headers });
    const json = await res.json();
    const newToken = json.data?.accessToken;
    const newCookie = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("ch_refresh="));
    if (newCookie) refreshCookie = newCookie.split(";")[0];
    log("refresh rotation", res.status === 200 && Boolean(newToken) && newToken !== accessToken, `status=${res.status} code=${json.code} cookie=${refreshCookie.slice(0, 12)} newToken=${Boolean(newToken)} same=${newToken === accessToken}`);
    if (newToken) accessToken = newToken;
  }

  // 5. cart
  {
    const r = await call("POST", "/cart/items", { variantId, quantity: 2 }, accessToken);
    log("add to cart", r.status === 200 && (r.json.data?.items?.length ?? 0) > 0);
  }
  {
    const r = await call("PATCH", "/cart/items", { variantId, quantity: 3 }, accessToken);
    log("update cart quantity", r.status === 200 && r.json.data?.items?.[0]?.quantity === 3);
  }
  let cartSummary;
  {
    const r = await call("GET", "/cart", undefined, accessToken);
    cartSummary = r.json.data;
    log("cart summary", r.status === 200 && Number(cartSummary?.summary?.total) > 0, `total=${cartSummary?.summary?.total}`);
  }

  // 6. coupon
  {
    const r = await call("POST", "/cart/coupon", { code: "CUDDLE10" }, accessToken);
    const applied = r.status === 200 && r.json.data?.coupon?.code === "CUDDLE10";
    const discount = Number(r.json.data?.summary?.couponDiscount ?? 0);
    log("apply coupon", applied && discount > 0, `discount=${discount}`);
  }
  {
    const r = await call("POST", "/cart/coupon", { code: "NOPE99" }, accessToken);
    log("reject invalid coupon", r.status === 400 && r.json.code === "INVALID_COUPON");
  }

  // 7. address
  let addressId = "";
  {
    const r = await call(
      "POST",
      "/addresses",
      {
        label: "Home",
        fullName: "Smoke Tester",
        phone: "+91 90000 00000",
        line1: "42 Test Street",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        isDefault: true,
      },
      accessToken,
    );
    addressId = r.json.data?.id;
    log("create address", r.status === 201 && Boolean(addressId));
  }

  // 8. wishlist
  {
    const r = await call("POST", "/wishlist", { productId }, accessToken);
    log("wishlist add", r.status === 201);
  }
  {
    const r = await call("GET", "/wishlist", undefined, accessToken);
    log("wishlist list", r.status === 200 && (r.json.data?.items?.length ?? 0) > 0);
  }

  // 9. checkout (Razorpay dev flow)
  let orderId = "";
  {
    const r = await call(
      "POST",
      "/orders",
      { addressId, paymentMethod: "RAZORPAY", couponCode: "CUDDLE10" },
      accessToken,
    );
    orderId = r.json.data?.id;
    log("create order", r.status === 201 && Boolean(orderId) && r.json.data?.status === "PENDING", `order=${r.json.data?.orderNumber}`);
  }
  {
    const r = await call("POST", "/payments/create-order", { orderId }, accessToken);
    log("payment intent", r.status === 200 && r.json.data?.devMode === true, "dev payment mode");
  }
  {
    const r = await call("POST", "/payments/dev-complete", { orderId }, accessToken);
    log(
      "payment confirmation",
      r.status === 200 && r.json.data?.status === "CONFIRMED" && r.json.data?.paymentStatus === "PAID",
    );
  }
  {
    // idempotency: repeating the callback must not double-process
    const r = await call("POST", "/payments/dev-complete", { orderId }, accessToken);
    log("payment idempotent repeat", r.status === 200 && r.json.data?.status === "CONFIRMED");
  }
  {
    const r = await call("GET", `/orders/${orderId}`, undefined, accessToken);
    log("order detail", r.status === 200 && r.json.data?.items?.length > 0);
  }
  {
    const r = await call("GET", "/orders", undefined, accessToken);
    log("order list", r.status === 200 && (r.json.data?.items?.length ?? 0) >= 1);
  }

  // 10. cart cleared after order
  {
    const r = await call("GET", "/cart", undefined, accessToken);
    log("cart cleared after order", r.status === 200 && (r.json.data?.items?.length ?? 0) === 0);
  }

  // 11. review (only after purchase)
  {
    const r = await call(
      "POST",
      "/reviews",
      { productId, rating: 5, title: "Great bear", comment: "Soft, well made and delivered early." },
      accessToken,
    );
    log("create review (purchased)", r.status === 201);
  }

  // 12. notifications
  {
    const r = await call("GET", "/notifications", undefined, accessToken);
    log("notifications", r.status === 200 && (r.json.data?.items?.length ?? 0) > 0);
  }

  // 13. admin
  {
    const r = await call("POST", "/auth/login", { email: "admin@cuddlehug.com", password: "Admin@1234" });
    adminToken = r.json.data?.accessToken;
    log("admin login", r.status === 200 && r.json.data?.user?.role === "ADMIN");
  }
  {
    const r = await call("GET", "/admin/dashboard", undefined, adminToken);
    log("admin dashboard", r.status === 200 && Boolean(r.json.data?.cards?.totalOrders));
  }
  {
    const r = await call("GET", "/admin/orders?limit=5", undefined, adminToken);
    log("admin orders", r.status === 200 && (r.json.data?.items?.length ?? 0) > 0);
  }
  {
    const r = await call("PATCH", `/admin/orders/${orderId}/status`, { status: "PROCESSING" }, adminToken);
    log("admin status update", r.status === 200 && r.json.data?.status === "PROCESSING");
  }
  {
    const r = await call("GET", "/admin/customers", undefined, adminToken);
    log("admin customers", r.status === 200 && (r.json.data?.items?.length ?? 0) >= 2);
  }
  {
    const r = await call("GET", "/admin/inventory", undefined, adminToken);
    log("admin inventory", r.status === 200 && Boolean(r.json.data?.summary));
  }
  {
    const r = await call("GET", "/admin/coupons", undefined, adminToken);
    log("admin coupons", r.status === 200 && (r.json.data?.items?.length ?? 0) >= 4);
  }
  {
    const r = await call("GET", "/admin/reports/sales", undefined, adminToken);
    log("admin sales report", r.status === 200 && Boolean(r.json.data?.totals));
  }
  {
    const r = await call("GET", "/admin/settings", undefined, adminToken);
    log("admin settings", r.status === 200 && r.json.data?.["store.name"] === "CuddleHug");
  }

  // 14. RBAC: customer must NOT reach admin endpoints
  {
    const r = await call("GET", "/admin/dashboard", undefined, accessToken);
    log("RBAC blocks customer from admin", r.status === 403);
  }
  {
    const r = await call("GET", "/admin/orders");
    log("RBAC blocks anonymous from admin", r.status === 401);
  }

  // 15. logout
  {
    const headers = { "Content-Type": "application/json", Cookie: `${cookie}; ${refreshCookie}` };
    const res = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers });
    log("logout", res.status === 200);
  }
  {
    const r = await call("GET", "/auth/me", undefined, accessToken);
    log("me still valid until access token expires", r.status === 200);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("Failed:", failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
