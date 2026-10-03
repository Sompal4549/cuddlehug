import { NotificationType, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { fromMinor, toMinor } from "../utils/money";
import { buildMeta } from "../utils/pagination";
import { orderNumberFrom } from "../utils/slug";
import { audit } from "../middleware/context";
import { emails } from "../utils/mailer";
import { available, confirmStock, lockInventory, releaseStock, reserveStock } from "./inventory.service";
import { computePricing, type PricingLine } from "./pricing";
import { getSettings } from "./settings.service";
import { recordCouponUsage, toPricingCoupon, validateCoupon } from "./coupon.service";
import { clearCartItems, loadLines } from "./cart.service";
import { pushService } from "./push.service";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  RETURNED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export const ORDER_INCLUDE = {
  items: true,
  payment: true,
  history: { orderBy: { createdAt: "asc" as const } },
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

export function toOrderDto(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal.toString(),
    discountAmount: order.discountAmount.toString(),
    couponCode: order.couponCode,
    shippingAmount: order.shippingAmount.toString(),
    taxAmount: order.taxAmount.toString(),
    totalAmount: order.totalAmount.toString(),
    currency: order.currency,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    trackingNumber: order.trackingNumber,
    courierName: order.courierName,
    estimatedDelivery: order.estimatedDelivery?.toISOString() ?? null,
    cancelReason: order.cancelReason,
    placedAt: order.placedAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    user: order.user,
    payment: order.payment
      ? {
          id: order.payment.id,
          provider: order.payment.provider,
          providerOrderId: order.payment.providerOrderId,
          providerPaymentId: order.payment.providerPaymentId,
          amount: order.payment.amount.toString(),
          status: order.payment.status,
          method: order.payment.method,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      productSlug: item.productSlug,
      variantLabel: item.variantLabel,
      sku: item.sku,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice.toString(),
      mrp: item.mrp.toString(),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toString(),
    })),
    history: order.history.map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { key: "order" },
    create: { key: "order", value: 1 },
    update: { value: { increment: 1 } },
  });
  return orderNumberFrom(counter.value);
}

async function notifyOrder(userId: string, type: NotificationType, title: string, body: string, data?: Record<string, unknown>) {
  await prisma.notification.create({
    data: { userId, type, title, body, data: (data ?? undefined) as never },
  });
  // Fire-and-forget push; never blocks or fails the business operation.
  // B-9: `type` in the data map lets the app deep-link the right screen.
  void pushService.sendToUser(userId, { title, body, data: { ...(data ?? {}), type } });
}

function statusLabel(status: OrderStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const orderService = {
  async create(params: {
    userId: string;
    addressId: string;
    paymentMethod: PaymentMethod;
    couponCode?: string | null;
    billingAddressId?: string | null;
    ip?: string;
    idempotencyKey?: string | null;
  }) {
    // Idempotent replay: a retried request with the same key returns the
    // order created by the first attempt instead of creating a duplicate.
    if (params.idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { userId_key: { userId: params.userId, key: params.idempotencyKey } },
      });
      if (existing) {
        const order = await prisma.order.findUnique({ where: { id: existing.orderId }, include: ORDER_INCLUDE });
        if (order) return toOrderDto(order);
      }
    }

    const settings = await getSettings();
    if (settings["store.status"] !== "open") throw new AppError("The store is temporarily closed", 503, "INVALID_STATE");
    if (params.paymentMethod === "COD" && !settings["shipping.codEnabled"]) {
      throw AppError.badRequest("Cash on delivery is not available");
    }

    const address = await prisma.address.findFirst({
      where: { id: params.addressId, userId: params.userId },
    });
    if (!address) throw AppError.notFound("Delivery address not found");

    const billingAddress = params.billingAddressId
      ? await prisma.address.findFirst({ where: { id: params.billingAddressId, userId: params.userId } })
      : null;
    if (params.billingAddressId && !billingAddress) throw AppError.notFound("Billing address not found");

    let order: OrderWithRelations;
    try {
      order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({ where: { userId: params.userId } });
      if (!cart) throw new AppError("Your cart is empty", 400, "CART_EMPTY");

      // Serialize concurrent checkouts for the same cart.
      await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "id" = ${cart.id} FOR UPDATE`;

      const rows = await loadLines(tx, cart.id);
      const purchasable = rows.filter((r) => r.variant.isActive && r.variant.product.status === "ACTIVE");
      if (purchasable.length === 0) throw new AppError("Your cart is empty", 400, "CART_EMPTY");

      const variantIds = purchasable.map((r) => r.variantId);
      await lockInventory(tx, variantIds);

      for (const row of purchasable) {
        const stock = row.variant.inventory ? available(row.variant.inventory) : 0;
        if (stock < row.quantity) {
          throw new AppError(
            `Only ${stock} left for ${row.variant.product.name}`,
            409,
            "OUT_OF_STOCK",
            { available: stock, variantId: row.variantId },
          );
        }
      }

      const pricingLines: PricingLine[] = purchasable.map((row) => ({
        variantId: row.variantId,
        unitPrice: row.variant.price.toString(),
        mrp: row.variant.mrp.toString(),
        quantity: row.quantity,
      }));

      let couponId: string | null = null;
      let pricingCoupon = null;
      const requestedCode = params.couponCode ?? cart.couponCode;
      const subtotalMinor = pricingLines.reduce((acc, l) => acc + toMinor(l.unitPrice) * BigInt(l.quantity), 0n);
      if (requestedCode) {
        const coupon = await validateCoupon({
          code: requestedCode,
          userId: params.userId,
          subtotalMinor,
          variantIds,
        });
        couponId = coupon.id;
        pricingCoupon = toPricingCoupon(coupon);
      }

      const pricing = computePricing({
        lines: pricingLines,
        coupon: pricingCoupon,
        settings,
      });

      const orderNumber = await nextOrderNumber(tx);
      const isCod = params.paymentMethod === "COD";
      const confirmedAt = new Date();
      const estimatedDelivery = new Date(confirmedAt.getTime() + 1000 * 60 * 60 * 24 * 5);

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: params.userId,
          status: isCod ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: params.paymentMethod,
          subtotal: fromMinor(pricing.subtotal),
          discountAmount: fromMinor(pricing.couponDiscount),
          couponCode: couponId ? requestedCode!.toUpperCase() : null,
          couponId,
          shippingAmount: fromMinor(pricing.shipping),
          taxAmount: fromMinor(pricing.tax),
          totalAmount: fromMinor(pricing.total),
          shippingAddress: JSON.parse(JSON.stringify(address)) as Prisma.InputJsonValue,
          billingAddress: billingAddress
            ? (JSON.parse(JSON.stringify(billingAddress)) as Prisma.InputJsonValue)
            : undefined,
          estimatedDelivery: isCod ? estimatedDelivery : null,
          items: {
            create: purchasable.map((row) => {
              const unitPrice = row.variant.price;
              const lineTotal = toMinor(unitPrice) * BigInt(row.quantity);
              return {
                productId: row.variant.product.id,
                variantId: row.variant.id,
                productName: row.variant.product.name,
                productSlug: row.variant.product.slug,
                variantLabel: `${row.variant.size} / ${row.variant.color}`,
                sku: row.variant.sku,
                imageUrl: row.variant.product.images[0]?.url ?? null,
                unitPrice: unitPrice.toString(),
                mrp: row.variant.mrp.toString(),
                quantity: row.quantity,
                lineTotal: fromMinor(lineTotal),
              };
            }),
          },
          history: { create: { status: isCod ? OrderStatus.CONFIRMED : OrderStatus.PENDING, note: "Order placed" } },
          payment: { create: { amount: fromMinor(pricing.total), provider: "RAZORPAY", status: PaymentStatus.PENDING } },
        },
        include: ORDER_INCLUDE,
      });

      // Inventory: reserve now, deduct on confirmation.
      for (const row of purchasable) {
        await reserveStock(tx, row.variantId, row.quantity, created.id, params.userId);
      }

      if (isCod) {
        for (const row of purchasable) {
          await confirmStock(tx, row.variantId, row.quantity, created.id);
        }
      }

      if (couponId) {
        await recordCouponUsage({
          couponId,
          userId: params.userId,
          orderId: created.id,
          discountAmount: pricing.couponDiscount,
          tx,
        });
      }

      await clearCartItems(cart.id, tx);

      if (params.idempotencyKey) {
        await tx.idempotencyKey.create({
          data: { userId: params.userId, key: params.idempotencyKey, orderId: created.id },
        });
      }

      return created;
      },{ timeout: 20000, maxWait: 5000 });
    } catch (error) {
      // Two concurrent retries raced on the same key: the loser rolled back,
      // so hand back the order the winner created.
      const isKeyConflict =
        params.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (isKeyConflict) {
        const existing = await prisma.idempotencyKey.findUnique({
          where: { userId_key: { userId: params.userId, key: params.idempotencyKey! } },
        });
        if (existing) {
          const prior = await prisma.order.findUnique({ where: { id: existing.orderId }, include: ORDER_INCLUDE });
          if (prior) return toOrderDto(prior);
        }
      }
      throw error;
    }

    await notifyOrder(
      params.userId,
      "ORDER_CONFIRMATION",
      `Order ${order.orderNumber} confirmed`,
      `We received your order of ₹${order.totalAmount.toString()}.`,
      { orderId: order.id },
    );
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (user) {
      await emails.orderConfirmation(user.email, order.orderNumber, order.totalAmount.toString());
    }
    await audit({
      userId: params.userId,
      action: "order.create",
      entity: "Order",
      entityId: order.id,
      meta: { orderNumber: order.orderNumber },
      ip: params.ip,
    });

    return order;
  },

  async listForUser(userId: string, page: number, limit: number) {
    const where: Prisma.OrderWhereInput = { userId };
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: orders.map(toOrderDto), meta: buildMeta(page, limit, total) };
  },

  async getForUser(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw AppError.notFound("Order not found");
    return toOrderDto(order);
  },

  async listAdmin(params: {
    page: number;
    limit: number;
    search?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.OrderWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { orderNumber: { contains: params.search, mode: "insensitive" } },
              { user: { email: { contains: params.search, mode: "insensitive" } } },
              { user: { firstName: { contains: params.search, mode: "insensitive" } } },
              { user: { lastName: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: ORDER_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);
    return { items: orders.map(toOrderDto), meta: buildMeta(params.page, params.limit, total) };
  },

  async adminGet(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) throw AppError.notFound("Order not found");
    return toOrderDto(order);
  },

  async updateStatus(
    orderId: string,
    input: {
      status: OrderStatus;
      note?: string | null;
      trackingNumber?: string | null;
      courierName?: string | null;
      cancelReason?: string | null;
    },
    actorId: string,
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) throw AppError.notFound("Order not found");

    const allowed = TRANSITIONS[order.status];
    if (order.status !== input.status && !allowed.includes(input.status)) {
      throw new AppError(
        `Cannot move order from ${statusLabel(order.status)} to ${statusLabel(input.status)}`,
        409,
        "INVALID_STATE",
      );
    }

    const alreadyConfirmed = order.status !== OrderStatus.PENDING;
    const nextConfirmed = input.status !== OrderStatus.PENDING && input.status !== OrderStatus.CANCELLED;

    const updated = await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({ where: { orderId } });

      // Entering CONFIRMED for the first time -> deduct stock from reservation.
      if (!alreadyConfirmed && nextConfirmed) {
        for (const item of items) {
          await confirmStock(tx, item.variantId, item.quantity, orderId);
        }
      }

      // Cancellation / return -> release or restock.
      if (input.status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
        for (const item of items) {
          await releaseStock(tx, item.variantId, item.quantity, orderId, alreadyConfirmed);
        }
        if (order.couponId) {
          await tx.couponUsage.deleteMany({ where: { orderId } });
          await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { decrement: 1 } } });
        }
      }

      if (input.status === OrderStatus.RETURNED) {
        for (const item of items) {
          await releaseStock(tx, item.variantId, item.quantity, orderId, true);
        }
      }

      const paymentStatus =
        input.status === OrderStatus.DELIVERED && order.paymentMethod === PaymentMethod.COD
          ? PaymentStatus.PAID
          : input.status === OrderStatus.REFUNDED
            ? PaymentStatus.REFUNDED
            : order.paymentStatus;

      const result = await tx.order.update({
        where: { id: orderId },
        data: {
          status: input.status,
          paymentStatus,
          trackingNumber: input.trackingNumber ?? undefined,
          courierName: input.courierName ?? undefined,
          cancelReason: input.cancelReason ?? undefined,
          paidAt:
            input.status === OrderStatus.DELIVERED && order.paymentMethod === PaymentMethod.COD
              ? new Date()
              : undefined,
          history: {
            create: {
              status: input.status,
              note: input.note ?? (input.cancelReason ? `Cancelled: ${input.cancelReason}` : null),
            },
          },
        },
        include: ORDER_INCLUDE,
      });

      if (paymentStatus !== order.paymentStatus) {
        await tx.payment.updateMany({ where: { orderId }, data: { status: paymentStatus } });
      }

      return result;
    },{ timeout: 20000, maxWait: 5000 });

    await notifyOrder(
      order.userId,
      input.status === OrderStatus.SHIPPED || input.status === OrderStatus.OUT_FOR_DELIVERY
        ? "SHIPPING"
        : input.status === OrderStatus.DELIVERED
          ? "DELIVERY"
          : input.status === OrderStatus.CANCELLED || input.status === OrderStatus.REFUNDED
            ? "PAYMENT_CONFIRMATION"
            : "ORDER_CONFIRMATION",
      `Order ${order.orderNumber} ${statusLabel(input.status)}`,
      `Your order is now ${statusLabel(input.status)}.${
        input.trackingNumber ? ` Tracking: ${input.trackingNumber}` : ""
      }`,
      { orderId: order.id },
    );

    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    if (user) {
      await emails.orderStatus(user.email, order.orderNumber, statusLabel(input.status), input.trackingNumber);
    }

    await audit({
      userId: actorId,
      action: "order.update_status",
      entity: "Order",
      entityId: orderId,
      meta: { from: order.status, to: input.status },
    });

    return updated;
  },

  async statsForUser(userId: string) {
    const [total, pending, delivered, cancelled] = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.order.count({
        where: { userId, status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"] } },
      }),
      prisma.order.count({ where: { userId, status: "DELIVERED" } }),
      prisma.order.count({ where: { userId, status: { in: ["CANCELLED", "RETURNED"] } } }),
    ]);
    const spend = await prisma.order.aggregate({
      where: { userId, paymentStatus: { in: [PaymentStatus.PAID] } },
      _sum: { totalAmount: true },
    });
    return {
      totalOrders: total,
      pendingOrders: pending,
      deliveredOrders: delivered,
      cancelledOrders: cancelled,
      totalSpend: spend._sum.totalAmount?.toString() ?? "0.00",
    };
  },
};

export { TRANSITIONS as ORDER_TRANSITIONS };
