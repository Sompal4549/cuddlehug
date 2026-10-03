import { describe, expect, it } from "vitest";
import { prisma } from "../config/prisma";
import { api, auth, loginAdmin, registerSession } from "./helpers";

describe("admin API", () => {
  it("summarises the store on the dashboard", async () => {
    const admin = await loginAdmin();
    const res = await api().get("/api/admin/dashboard").set(auth(admin));
    expect(res.status).toBe(200);
    const cards = res.body.data.cards;
    expect(cards.totalOrders).toBeGreaterThanOrEqual(6);
    expect(Number(cards.revenue)).toBeGreaterThanOrEqual(0);
    expect(res.body.data).toHaveProperty("recentOrders");
    expect(res.body.data).toHaveProperty("lowStock");
  });

  it("lists orders with filters and serves order detail", async () => {
    const admin = await loginAdmin();
    const res = await api().get("/api/admin/orders?limit=5&status=CONFIRMED").set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    for (const order of res.body.data.items) expect(order.status).toBe("CONFIRMED");

    const detail = await api().get(`/api/admin/orders/${res.body.data.items[0].id}`).set(auth(admin));
    expect(detail.status).toBe(200);
    expect(detail.body.data).toHaveProperty("history");
  });

  it("rejects an illegal status transition", async () => {
    const admin = await loginAdmin();
    const list = await api().get("/api/admin/orders?limit=1").set(auth(admin));
    const order = list.body.data.items.find((o: { status: string }) => o.status === "CANCELLED") ?? list.body.data.items[0];
    const res = await api()
      .patch(`/api/admin/orders/${order.id}/status`)
      .set(auth(admin))
      .send({ status: "SHIPPED" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("adjusts inventory and records the transaction", async () => {
    const admin = await loginAdmin();
    const list = await api().get("/api/admin/inventory?limit=1").set(auth(admin));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveProperty("summary");
    const row = list.body.data.items[0];
    const before = row.quantity;

    const adjusted = await api()
      .post("/api/admin/inventory/adjust")
      .set(auth(admin))
      .send({ variantId: row.variantId, type: "STOCK_ADDED", quantity: 5, note: "Restock" });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.data.quantity).toBe(before + 5);

    const transactions = await api().get("/api/admin/inventory/transactions").set(auth(admin));
    expect(transactions.status).toBe(200);
    expect(transactions.body.data.items.length).toBeGreaterThan(0);
  });

  it("creates, edits and deletes a coupon", async () => {
    const admin = await loginAdmin();
    const created = await api()
      .post("/api/admin/coupons")
      .set(auth(admin))
      .send({
        code: "TEST20",
        type: "PERCENTAGE",
        value: "20",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        minOrderAmount: "500",
        usageLimit: 50,
      });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const invalid = await api()
      .post("/api/admin/coupons")
      .set(auth(admin))
      .send({
        code: "BAD99",
        type: "PERCENTAGE",
        value: "150",
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(invalid.status).toBe(400);

    const patched = await api().patch(`/api/admin/coupons/${id}`).set(auth(admin)).send({ value: "25" });
    expect(patched.status).toBe(200);
    expect(patched.body.data.value).toBe("25");

    const removed = await api().delete(`/api/admin/coupons/${id}`).set(auth(admin));
    expect(removed.status).toBe(200);
    expect(await prisma.coupon.findUnique({ where: { id } })).toBeNull();
  });

  it("blocks and restores a customer account", async () => {
    const admin = await loginAdmin();
    const customer = await registerSession("blockable");

    const blocked = await api()
      .patch(`/api/admin/customers/${customer.user.id}/status`)
      .set(auth(admin))
      .send({ status: "BLOCKED" });
    expect(blocked.status).toBe(200);

    const login = await api()
      .post("/api/auth/login")
      .send({ email: customer.user.email, password: "Tester@1234" });
    expect(login.status).toBeGreaterThanOrEqual(400);

    const restored = await api()
      .patch(`/api/admin/customers/${customer.user.id}/status`)
      .set(auth(admin))
      .send({ status: "ACTIVE" });
    expect(restored.status).toBe(200);

    const retry = await api()
      .post("/api/auth/login")
      .send({ email: customer.user.email, password: "Tester@1234" });
    expect(retry.status).toBe(200);
  });

  it("serves sales, order and product reports", async () => {
    const admin = await loginAdmin();
    const sales = await api().get("/api/admin/reports/sales").set(auth(admin));
    expect(sales.status).toBe(200);
    expect(sales.body.data.totals).toHaveProperty("revenue");
    expect(Array.isArray(sales.body.data.series)).toBe(true);

    const orders = await api().get("/api/admin/reports/orders").set(auth(admin));
    expect(orders.status).toBe(200);

    const products = await api().get("/api/admin/reports/products").set(auth(admin));
    expect(products.status).toBe(200);
    expect(products.body.data.items.length).toBeGreaterThan(0);
  });

  it("updates and re-reads store settings", async () => {
    const admin = await loginAdmin();
    const before = await api().get("/api/admin/settings").set(auth(admin));
    expect(before.status).toBe(200);

    const updated = await api()
      .put("/api/admin/settings")
      .set(auth(admin))
      .send({ "store.tagline": "More Happiness. More Hugs.", "tax.rate": 18 });
    expect(updated.status).toBe(200);
    expect(updated.body.data["tax.rate"]).toBe(18);

    const publicSettings = await api().get("/api/settings");
    expect(publicSettings.status).toBe(200);
    expect(publicSettings.body.data["store.name"]).toBe("CuddleHug");
    expect(publicSettings.body.data).not.toHaveProperty("store.logoUrl");
  });

  it("moderates a review", async () => {
    const admin = await loginAdmin();
    const res = await api().get("/api/reviews/admin/all?limit=1").set(auth(admin));
    expect(res.status).toBe(200);
    const review = res.body.data.items[0];

    const hidden = await api()
      .patch(`/api/reviews/${review.id}`)
      .set(auth(admin))
      .send({ status: "REJECTED" });
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.status).toBe("REJECTED");

    const restored = await api()
      .patch(`/api/reviews/${review.id}`)
      .set(auth(admin))
      .send({ status: "APPROVED" });
    expect(restored.status).toBe(200);
    expect(restored.body.data.status).toBe("APPROVED");
  });

  it("keeps an audit trail", async () => {
    const admin = await loginAdmin();
    const res = await api().get("/api/admin/audit-logs?limit=5").set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0]).toHaveProperty("action");
  });
});
