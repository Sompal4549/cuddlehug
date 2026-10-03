import { describe, expect, it } from "vitest";
import { prisma } from "../config/prisma";
import { api, auth, registerSession, type Session } from "./helpers";

async function firstVariant(): Promise<{ id: string; sku: string }> {
  const res = await api().get("/api/products?limit=1");
  const product = res.body.data.items[0];
  const detail = await api().get(`/api/products/${product.slug}`);
  const variant = detail.body.data.variants.find((v: { available: number }) => v.available >= 5);
  if (!variant) throw new Error("no variant with stock >= 5");
  return { id: variant.id, sku: variant.sku };
}

async function createAddress(session: Session): Promise<string> {
  const res = await api()
    .post("/api/addresses")
    .set(auth(session))
    .send({
      label: "Home",
      fullName: "Integration Tester",
      phone: "+91 90000 00000",
      line1: "42 Hug Street",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      isDefault: true,
    });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

async function stockOf(variantId: string) {
  const inventory = await prisma.inventory.findUnique({ where: { variantId } });
  return { quantity: inventory!.quantity, reserved: inventory!.reserved };
}

describe("checkout flow", () => {
  it("builds a cart, prices it and rejects bad coupons", async () => {
    const session = await registerSession("cart");
    const variant = await firstVariant();

    const added = await api()
      .post("/api/cart/items")
      .set(auth(session))
      .send({ variantId: variant.id, quantity: 2 });
    expect(added.status).toBe(200);
    expect(added.body.data.items[0].quantity).toBe(2);
    expect(Number(added.body.data.summary.total)).toBeGreaterThan(0);

    const qty = await api()
      .patch("/api/cart/items")
      .set(auth(session))
      .send({ variantId: variant.id, quantity: 3 });
    expect(qty.body.data.items[0].quantity).toBe(3);

    // line quantity is clamped to the per-line maximum rather than rejected
    const tooMany = await api()
      .post("/api/cart/items")
      .set(auth(session))
      .send({ variantId: variant.id, quantity: 99 });
    expect(tooMany.status).toBe(200);
    expect(tooMany.body.data.items[0].quantity).toBeLessThanOrEqual(10);
    await api()
      .patch("/api/cart/items")
      .set(auth(session))
      .send({ variantId: variant.id, quantity: 3 });

    const badCoupon = await api()
      .post("/api/cart/coupon")
      .set(auth(session))
      .send({ code: "NOT-A-CODE" });
    expect(badCoupon.status).toBe(400);
    expect(badCoupon.body.code).toBe("INVALID_COUPON");

    const goodCoupon = await api()
      .post("/api/cart/coupon")
      .set(auth(session))
      .send({ code: "CUDDLE10" });
    expect(goodCoupon.status).toBe(200);
    expect(goodCoupon.body.data.coupon.code).toBe("CUDDLE10");
    expect(Number(goodCoupon.body.data.summary.couponDiscount)).toBeGreaterThan(0);

    const removed = await api().delete("/api/cart/coupon").set(auth(session));
    expect(removed.status).toBe(200);
    expect(removed.body.data.coupon).toBeNull();
  });

  it("creates a COD order, reserves stock and clears the cart", async () => {
    const session = await registerSession("cod");
    const variant = await firstVariant();
    const addressId = await createAddress(session);

    const before = await stockOf(variant.id);

    await api().post("/api/cart/items").set(auth(session)).send({ variantId: variant.id, quantity: 2 });

    const badAddress = await api()
      .post("/api/orders")
      .set(auth(session))
      .send({ addressId: "cm0000000000000000000000", paymentMethod: "COD" });
    expect(badAddress.status).toBeGreaterThanOrEqual(400);

    const created = await api()
      .post("/api/orders")
      .set(auth(session))
      .send({ addressId, paymentMethod: "COD" });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("CONFIRMED");
    expect(created.body.data.paymentMethod).toBe("COD");
    expect(created.body.data.orderNumber).toMatch(/^CH-\d{4}-\d{6}$/);
    expect(created.body.data.items).toHaveLength(1);

    const after = await stockOf(variant.id);
    expect(after.quantity).toBe(before.quantity - 2);

    const cart = await api().get("/api/cart").set(auth(session));
    expect(cart.body.data.items).toHaveLength(0);

    const list = await api().get("/api/orders").set(auth(session));
    expect(list.status).toBe(200);
    expect(list.body.data.items.some((o: { id: string }) => o.id === created.body.data.id)).toBe(true);

    const detail = await api().get(`/api/orders/${created.body.data.id}`).set(auth(session));
    expect(detail.status).toBe(200);
    expect(detail.body.data.history.length).toBeGreaterThan(0);

    const someoneElses = await api()
      .get(`/api/orders/${created.body.data.id}`)
      .set(auth(await registerSession("noscope")));
    expect(someoneElses.status).toBe(404);
  });

  it("takes payment in dev mode exactly once and confirms the order", async () => {
    const session = await registerSession("pay");
    const variant = await firstVariant();
    const addressId = await createAddress(session);
    await api().post("/api/cart/items").set(auth(session)).send({ variantId: variant.id, quantity: 1 });

    const created = await api()
      .post("/api/orders")
      .set(auth(session))
      .send({ addressId, paymentMethod: "RAZORPAY" });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("PENDING");

    const reserved = await stockOf(variant.id);
    expect(reserved.reserved).toBeGreaterThan(0);

    const intent = await api()
      .post("/api/payments/create-order")
      .set(auth(session))
      .send({ orderId: created.body.data.id });
    expect(intent.status).toBe(200);
    expect(intent.body.data.devMode).toBe(true);

    const captured = await api()
      .post("/api/payments/dev-complete")
      .set(auth(session))
      .send({ orderId: created.body.data.id });
    expect(captured.status).toBe(200);
    expect(captured.body.data.status).toBe("CONFIRMED");
    expect(captured.body.data.paymentStatus).toBe("PAID");
    expect(captured.body.data.paidAt).toBeTruthy();

    const confirmed = await stockOf(variant.id);
    expect(confirmed.reserved).toBe(reserved.reserved - 1);
    expect(confirmed.quantity).toBe(reserved.quantity - 1);

    // Replaying the callback must not move stock a second time.
    const repeat = await api()
      .post("/api/payments/dev-complete")
      .set(auth(session))
      .send({ orderId: created.body.data.id });
    expect(repeat.status).toBe(200);
    const still = await stockOf(variant.id);
    expect(still.quantity).toBe(confirmed.quantity);
    expect(still.reserved).toBe(confirmed.reserved);
  });

  it("lets a buyer review only what they bought, once", async () => {
    const session = await registerSession("review");
    const variant = await firstVariant();
    const addressId = await createAddress(session);
    const product = await prisma.productVariant.findUnique({
      where: { id: variant.id },
      select: { productId: true },
    });

    const stranger = await api()
      .post("/api/reviews")
      .set(auth(session))
      .send({ productId: product!.productId, rating: 5, title: "Nope", comment: "Not purchased yet" });
    expect(stranger.status).toBe(403);

    await api().post("/api/cart/items").set(auth(session)).send({ variantId: variant.id, quantity: 1 });
    await api().post("/api/orders").set(auth(session)).send({ addressId, paymentMethod: "COD" });

    const first = await api()
      .post("/api/reviews")
      .set(auth(session))
      .send({
        productId: product!.productId,
        rating: 5,
        title: "Perfect hug",
        comment: "Incredibly soft and the stitching is flawless.",
      });
    expect(first.status).toBe(201);

    const again = await api()
      .post("/api/reviews")
      .set(auth(session))
      .send({ productId: product!.productId, rating: 4, title: "Second", comment: "Trying again." });
    expect(again.status).toBe(409);

    const mine = await api().get("/api/reviews/mine").set(auth(session));
    expect(mine.status).toBe(200);
    expect(mine.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it("cancels an order and releases the reservation", async () => {
    const session = await registerSession("cancel");
    const variant = await firstVariant();
    const addressId = await createAddress(session);
    const before = await stockOf(variant.id);

    await api().post("/api/cart/items").set(auth(session)).send({ variantId: variant.id, quantity: 2 });
    const created = await api()
      .post("/api/orders")
      .set(auth(session))
      .send({ addressId, paymentMethod: "RAZORPAY" });
    expect(created.status).toBe(201);

    const admin = await api().post("/api/auth/login").send({ email: "admin@cuddlehug.com", password: "Admin@1234" });
    const cancelled = await api()
      .patch(`/api/admin/orders/${created.body.data.id}/status`)
      .set(auth({ accessToken: admin.body.data.accessToken, cookie: "", user: admin.body.data.user }))
      .send({ status: "CANCELLED" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");

    const after = await stockOf(variant.id);
    expect(after.quantity).toBe(before.quantity);
    expect(after.reserved).toBe(before.reserved);
  });
});
