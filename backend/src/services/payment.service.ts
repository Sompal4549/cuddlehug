import { NotificationType, OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { devPaymentMode, env, razorpayConfigured, webhookConfigured } from "../config/env";
import { AppError } from "../utils/errors";
import { toMinor } from "../utils/money";
import { createRazorpayOrder, verifyRazorpaySignature, verifyRazorpayWebhookSignature } from "../utils/razorpay";
import { randomToken } from "../utils/token";
import { logger } from "../utils/logger";
import { audit } from "../middleware/context";
import { emails } from "../utils/mailer";
import { confirmStock } from "./inventory.service";
import { pushService } from "./push.service";
import { ORDER_INCLUDE, toOrderDto, type OrderWithRelations } from "./order.service";

async function notify(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  await prisma.notification.create({
    data: { userId, type: NotificationType.PAYMENT_CONFIRMATION, title, body, data: (data ?? undefined) as never },
  });
  void pushService.sendToUser(userId, {
    title,
    body,
    data: { ...(data ?? {}), type: NotificationType.PAYMENT_CONFIRMATION },
  });
}

/**
 * Marks a payment as captured and the order as confirmed.
 * Idempotent: repeated callbacks are no-ops after the first success.
 */
async function capturePayment(params: {
  orderId: string;
  providerPaymentId?: string | null;
  signature?: string | null;
  provider?: "RAZORPAY" | "MANUAL";
  method?: string;
  actorId?: string;
}): Promise<OrderWithRelations> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: params.orderId }, include: ORDER_INCLUDE });
    if (!order) throw AppError.notFound("Order not found");

    const payment = await tx.payment.findUnique({ where: { orderId: params.orderId } });
    if (!payment) throw AppError.notFound("Payment record not found");

    // --- Idempotency guard ---------------------------------------------
    if (payment.status === PaymentStatus.PAID && order.status !== OrderStatus.PENDING) {
      return order;
    }
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new AppError("This order can no longer be paid", 409, "INVALID_STATE");
    }
    // -------------------------------------------------------------------

    const now = new Date();
    const estimatedDelivery = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 5);

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        provider: params.provider ?? payment.provider,
        providerPaymentId: params.providerPaymentId ?? payment.providerPaymentId,
        signature: params.signature ?? payment.signature,
        method: params.method ?? payment.method,
        failureReason: null,
      },
    });

    const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
    for (const item of items) {
      await confirmStock(tx, item.variantId, item.quantity, order.id);
    }

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paidAt: now,
        estimatedDelivery,
        history: { create: { status: OrderStatus.CONFIRMED, note: "Payment received" } },
      },
      include: ORDER_INCLUDE,
    });
  },{ timeout: 20000, maxWait: 5000 });
}

async function failPayment(orderId: string, reason: string) {
  await prisma.payment.updateMany({
    where: { orderId, status: PaymentStatus.PENDING },
    data: { status: PaymentStatus.FAILED, failureReason: reason.slice(0, 300) },
  });
}

export const paymentService = {
  isDevMode: () => devPaymentMode,

  async createIntent(params: { orderId: string; userId: string; isAdmin: boolean }) {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: { payment: true },
    });
    if (!order) throw AppError.notFound("Order not found");
    if (!params.isAdmin && order.userId !== params.userId) throw AppError.forbidden();
    if (order.paymentStatus === PaymentStatus.PAID || order.status !== OrderStatus.PENDING) {
      throw new AppError("This order has already been paid", 409, "INVALID_STATE");
    }
    if (order.paymentMethod !== "RAZORPAY") {
      throw new AppError("This order is not payable online", 409, "INVALID_STATE");
    }

    if (devPaymentMode) {
      logger.info(`[dev-payment] intent created for order ${order.orderNumber}`);
      return {
        devMode: true as const,
        keyId: null as string | null,
        razorpayOrderId: null as string | null,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: Number(toMinor(order.totalAmount)),
        amountDisplay: order.totalAmount.toString(),
        currency: order.currency,
      };
    }

    if (!razorpayConfigured) {
      throw new AppError("Payment gateway is not configured", 503, "PAYMENT_NOT_CONFIGURED");
    }

    let providerOrderId = order.payment?.providerOrderId;
    if (!providerOrderId) {
      const rzpOrder = await createRazorpayOrder({
        amountMinor: toMinor(order.totalAmount),
        currency: order.currency,
        receipt: order.orderNumber,
        notes: { cuddlehug_order_id: order.id, order_number: order.orderNumber },
      });
      providerOrderId = rzpOrder.id;
      await prisma.payment.update({
        where: { orderId: order.id },
        data: { providerOrderId, amount: order.totalAmount },
      });
    }

    return {
      devMode: false as const,
      keyId: env.RAZORPAY_KEY_ID,
      razorpayOrderId: providerOrderId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(toMinor(order.totalAmount)),
      amountDisplay: order.totalAmount.toString(),
      currency: order.currency,
    };
  },

  async verify(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    userId: string;
    ip?: string;
  }) {
    const payment = await prisma.payment.findUnique({
      where: { providerOrderId: params.razorpayOrderId },
      include: { order: true },
    });
    if (!payment) throw AppError.notFound("Payment order not found");
    if (payment.order.userId !== params.userId) throw AppError.forbidden();

    const valid = verifyRazorpaySignature({
      orderId: params.razorpayOrderId,
      paymentId: params.razorpayPaymentId,
      signature: params.razorpaySignature,
    });

    if (!valid) {
      await failPayment(payment.orderId, "Invalid payment signature");
      await audit({
        userId: params.userId,
        action: "payment.verify_failed",
        entity: "Order",
        entityId: payment.orderId,
        ip: params.ip,
      });
      throw new AppError("Payment verification failed", 400, "PAYMENT_SIGNATURE_INVALID");
    }

    // Idempotent: a repeated callback simply returns the already confirmed order.
    if (payment.status === PaymentStatus.PAID) {
      return toOrderDto(
        (await prisma.order.findUnique({ where: { id: payment.orderId }, include: ORDER_INCLUDE }))!,
      );
    }

    const order = await capturePayment({
      orderId: payment.orderId,
      providerPaymentId: params.razorpayPaymentId,
      signature: params.razorpaySignature,
      provider: "RAZORPAY",
      method: "card",
    });

    await notify(
      order.userId,
      "Payment received",
      `We received ₹${order.totalAmount.toString()} for order ${order.orderNumber}.`,
      { orderId: order.id },
    );
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    if (user) await emails.paymentConfirmation(user.email, order.orderNumber, order.totalAmount.toString());
    await audit({
      userId: params.userId,
      action: "payment.confirmed",
      entity: "Order",
      entityId: order.id,
      meta: { paymentId: params.razorpayPaymentId },
      ip: params.ip,
    });

    return toOrderDto(order);
  },

  /**
   * Development-only payment completion. Uses the exact same confirmation
   * service as real signature verification, so inventory, coupons, coupons and
   * notifications behave identically. Only mounted when Razorpay keys are
   * absent and NODE_ENV !== production.
   */
  async devComplete(params: { orderId: string; userId: string; ip?: string }) {
    if (!devPaymentMode) {
      throw new AppError("Development payments are disabled", 403, "FORBIDDEN");
    }

    const order = await prisma.order.findUnique({ where: { id: params.orderId } });
    if (!order) throw AppError.notFound("Order not found");
    if (order.userId !== params.userId) throw AppError.forbidden();
    if (order.paymentStatus === PaymentStatus.PAID) return paymentService.getOrder(order.id, params.userId);

    await prisma.payment.update({
      where: { orderId: order.id },
      data: {
        provider: "MANUAL",
        providerPaymentId: `devpay_${randomToken(8)}`,
        method: "dev",
      },
    });

    const confirmed = await capturePayment({
      orderId: order.id,
      providerPaymentId: `devpay_${randomToken(8)}`,
      signature: null,
      provider: "MANUAL",
      method: "dev",
    });

    await notify(
      confirmed.userId,
      "Payment received",
      `Dev payment of ₹${confirmed.totalAmount.toString()} captured for ${confirmed.orderNumber}.`,
      { orderId: confirmed.id },
    );
    await audit({
      userId: params.userId,
      action: "payment.dev_confirmed",
      entity: "Order",
      entityId: confirmed.id,
      ip: params.ip,
    });

    return toOrderDto(confirmed);
  },

  /**
   * Razorpay webhook receiver. Independently of any client callback this
   * reconciles payment/order state, so a mobile app killed mid-payment can
   * never leave an order stuck in PENDING. Idempotent: replays are no-ops.
   */
  async handleWebhook(params: { rawBody: string; signature?: string | null }) {
    if (!webhookConfigured) {
      throw new AppError("Webhook secret is not configured", 503, "PAYMENT_NOT_CONFIGURED");
    }
    if (!params.signature || !verifyRazorpayWebhookSignature(params.rawBody, params.signature)) {
      throw new AppError("Invalid webhook signature", 401, "UNAUTHORIZED");
    }

    let event: {
      event?: string;
      payload?: {
        payment?: {
          entity?: { id?: string; order_id?: string; method?: string | null; error_description?: string | null };
        };
      };
    };
    try {
      event = JSON.parse(params.rawBody) as typeof event;
    } catch {
      throw AppError.badRequest("Malformed webhook payload");
    }

    const entity = event.payload?.payment?.entity;
    const providerOrderId = entity?.order_id;

    if (event.event === "payment.captured" && providerOrderId) {
      const payment = await prisma.payment.findUnique({
        where: { providerOrderId },
        include: { order: true },
      });
      if (!payment) {
        logger.warn(`[razorpay-webhook] unknown order ${providerOrderId}`);
        return { received: true, handled: "unknown_payment" };
      }
      if (payment.status === PaymentStatus.PAID) {
        return { received: true, handled: "already_paid" };
      }

      try {
        const order = await capturePayment({
          orderId: payment.orderId,
          providerPaymentId: entity.id ?? null,
          provider: "RAZORPAY",
          method: entity.method ?? "unknown",
        });
        await notify(
          order.userId,
          "Payment received",
          `We received ₹${order.totalAmount.toString()} for order ${order.orderNumber}.`,
          { orderId: order.id },
        );
        const user = await prisma.user.findUnique({ where: { id: order.userId } });
        if (user) await emails.paymentConfirmation(user.email, order.orderNumber, order.totalAmount.toString());
        await audit({
          userId: order.userId,
          action: "payment.webhook_captured",
          entity: "Order",
          entityId: order.id,
          meta: { paymentId: entity.id ?? null },
        });
        return { received: true, handled: "captured" };
      } catch (error) {
        // Order cancelled/refunded in the meantime — acknowledge so Razorpay
        // stops retrying an event we deliberately do not apply.
        if (error instanceof AppError && error.statusCode === 409) {
          logger.warn(`[razorpay-webhook] ignoring capture for ${payment.order.orderNumber}: ${error.message}`);
          return { received: true, handled: "ignored" };
        }
        throw error;
      }
    }

    if (event.event === "payment.failed" && providerOrderId) {
      const payment = await prisma.payment.findUnique({ where: { providerOrderId } });
      if (payment && payment.status === PaymentStatus.PENDING) {
        await failPayment(payment.orderId, entity.error_description ?? "Payment failed");
      }
      return { received: true, handled: "failed" };
    }

    return { received: true, handled: "ignored" };
  },

  async getOrder(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw AppError.notFound("Order not found");
    return toOrderDto(order);
  },
};

export type { OrderWithRelations };
