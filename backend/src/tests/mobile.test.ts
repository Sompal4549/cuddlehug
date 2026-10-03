import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../config/prisma";
import { api, auth, registerSession, type Session } from "./helpers";

const WEBHOOK_SECRET = "test_webhook_secret";

function sign(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

async function firstVariant(): Promise<{ id: string }> {
  const res = await api().get("/api/products?limit=1");
  const product = res.body.data.items[0];
  const detail = await api().get(`/api/products/${product.slug}`);
  const variant = detail.body.data.variants.find((v: { available: number }) => v.available >= 5);
  if (!variant) throw new Error("no variant with stock >= 5");
  return { id: variant.id };
}

async function createAddress(session: Session): Promise<string> {
  const res = await api()
    .post("/api/addresses")
    .set(auth(session))
    .send({
      label: "Home",
      fullName: "Webhook Tester",
      phone: "+91 90000 00000",
      line1: "7 Reconcile Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      isDefault: true,
    });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

async function createPendingOrder(session: Session, variantId: string, providerOrderId: string) {
  const addressId = await createAddress(session);
  await api().post("/api/cart/items").set(auth(session)).send({ variantId, quantity: 1 });
  const created = await api()
    .post("/api/orders")
    .set(auth(session))
    .send({ addressId, paymentMethod: "RAZORPAY" });
  expect(created.status).toBe(201);
  expect(created.body.data.status).toBe("PENDING");
  // Dev mode never talks to Razorpay, so simulate the provider order id that
  // create-order would have stored in production.
  await prisma.payment.update({
    where: { orderId: created.body.data.id },
    data: { providerOrderId },
  });
  return created.body.data as { id: string; orderNumber: string };
}

async function postWebhook(body: string, signature?: string) {
  return api()
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json")
    .set(signature === undefined ? {} : { "x-razorpay-signature": signature })
    .send(body);
}

describe("razorpay webhook", () => {
  it("confirms a pending order from payment.captured, idempotently", async () => {
    const session = await registerSession("webhook");
    const variant = await firstVariant();
    const order = await createPendingOrder(session, variant.id, "order_wh_capture_1");

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_wh_1", order_id: "order_wh_capture_1", method: "upi" } } },
    });

    const captured = await postWebhook(body, sign(body));
    expect(captured.status).toBe(200);
    expect(captured.body.data.handled).toBe("captured");

    const confirmed = await api().get(`/api/payments/status?orderId=${order.id}`).set(auth(session));
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.paymentStatus).toBe("PAID");
    expect(confirmed.body.data.status).toBe("CONFIRMED");

    // The client app can replay after reconnecting — must not double-capture.
    const replay = await postWebhook(body, sign(body));
    expect(replay.status).toBe(200);
    expect(replay.body.data.handled).toBe("already_paid");

    const stillConfirmed = await api().get(`/api/payments/status?orderId=${order.id}`).set(auth(session));
    expect(stillConfirmed.body.data.paymentStatus).toBe("PAID");
  });

  it("rejects an invalid signature", async () => {
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_bad", order_id: "order_missing" } } },
    });
    const res = await postWebhook(body, sign("tampered"));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("marks a payment failed on payment.failed", async () => {
    const session = await registerSession("whfail");
    const variant = await firstVariant();
    const order = await createPendingOrder(session, variant.id, "order_wh_fail_1");

    const body = JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: { entity: { id: "pay_fail", order_id: "order_wh_fail_1", error_description: "Card declined" } },
      },
    });
    const res = await postWebhook(body, sign(body));
    expect(res.status).toBe(200);
    expect(res.body.data.handled).toBe("failed");

    const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
    expect(payment?.status).toBe("FAILED");
    expect(payment?.failureReason).toBe("Card declined");
  });

  it("acknowledges unknown events without error", async () => {
    const body = JSON.stringify({ event: "subscription.charged", payload: {} });
    const res = await postWebhook(body, sign(body));
    expect(res.status).toBe(200);
    expect(res.body.data.handled).toBe("ignored");
  });
});

describe("device tokens", () => {
  it("requires authentication", async () => {
    const res = await api().post("/api/devices/register").send({ token: "a".repeat(40), platform: "ANDROID" });
    expect(res.status).toBe(401);
  });

  it("registers, upserts and unregisters a device token", async () => {
    const session = await registerSession("device");
    const token = `fcm_${session.user.id}_token`;

    const first = await api()
      .post("/api/devices/register")
      .set(auth(session))
      .send({ token, platform: "ANDROID", appId: "com.cuddlehug.app" });
    expect(first.status).toBe(200);

    const upsert = await api()
      .post("/api/devices/register")
      .set(auth(session))
      .send({ token, platform: "IOS" });
    expect(upsert.status).toBe(200);
    const stored = await prisma.deviceToken.findUnique({ where: { token } });
    expect(stored?.platform).toBe("IOS");
    expect(stored?.userId).toBe(session.user.id);

    const removed = await api().post("/api/devices/unregister").set(auth(session)).send({ token });
    expect(removed.status).toBe(200);
    expect(await prisma.deviceToken.findUnique({ where: { token } })).toBeNull();
  });

  it("rejects an unknown platform", async () => {
    const session = await registerSession("device2");
    const res = await api()
      .post("/api/devices/register")
      .set(auth(session))
      .send({ token: "b".repeat(40), platform: "BLACKBERRY" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("mobile auth hardening", () => {
  it("accepts the refresh token in the request body (no cookie)", async () => {
    const session = await registerSession("bodyrefresh");
    const refreshToken = session.cookie.split("=").slice(1).join("=");
    expect(refreshToken.length).toBeGreaterThan(10);

    const res = await api().post("/api/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.accessToken).not.toBe(session.accessToken);
  });

  it("still refreshes from the cookie (web behaviour unchanged)", async () => {
    const session = await registerSession("cookierefresh");
    const res = await api().post("/api/auth/refresh").set("Cookie", session.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it("rejects a garbage refresh token in the body", async () => {
    const res = await api().post("/api/auth/refresh").send({ refreshToken: "not-a-jwt" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });
});

describe("payment status validation", () => {
  it("requires orderId", async () => {
    const session = await registerSession("status");
    const missing = await api().get("/api/payments/status").set(auth(session));
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe("VALIDATION_ERROR");

    const variant = await firstVariant();
    const order = await createPendingOrder(session, variant.id, "order_status_1");
    const ok = await api().get(`/api/payments/status?orderId=${order.id}`).set(auth(session));
    expect(ok.status).toBe(200);
    expect(ok.body.data.orderNumber).toBe(order.orderNumber);
  });
});

describe("order idempotency", () => {
  it("returns the original order when the same key is replayed", async () => {
    const session = await registerSession("idem");
    const variant = await firstVariant();
    const addressId = await createAddress(session);
    await api().post("/api/cart/items").set(auth(session)).send({ variantId: variant.id, quantity: 1 });

    const payload = { addressId, paymentMethod: "COD" };
    const first = await api()
      .post("/api/orders")
      .set(auth(session))
      .set({ "Idempotency-Key": "mobile-key-123" })
      .send(payload);
    expect(first.status).toBe(201);

    const replay = await api()
      .post("/api/orders")
      .set(auth(session))
      .set({ "Idempotency-Key": "mobile-key-123" })
      .send(payload);
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(first.body.data.id);
    expect(replay.body.data.orderNumber).toBe(first.body.data.orderNumber);

    const list = await api().get("/api/orders").set(auth(session));
    expect(list.body.data.items).toHaveLength(1);
  });

  it("creates a fresh order when no key is sent (web behaviour)", async () => {
    const session = await registerSession("noidem");
    const variant = await firstVariant();
    const addressId = await createAddress(session);
    await api().post("/api/cart/items").set(auth(session)).send({ variantId: variant.id, quantity: 1 });
    const res = await api().post("/api/orders").set(auth(session)).send({ addressId, paymentMethod: "COD" });
    expect(res.status).toBe(201);
  });
});
