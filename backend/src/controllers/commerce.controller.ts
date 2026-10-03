import { asyncHandler } from "../utils/asyncHandler";
import { created, success } from "../utils/response";
import {
  addToCart as addToCartService,
  applyCouponToCart,
  getCart,
  removeCartItem,
  removeCouponFromCart,
  updateCartItem,
} from "../services/cart.service";
import { wishlistService } from "../services/account.service";
import { orderService } from "../services/order.service";
import { paymentService } from "../services/payment.service";
import {
  applyCouponSchema,
  cartAddSchema,
  cartUpdateSchema,
  createOrderSchema,
  devCompletePaymentSchema,
  paymentIntentSchema,
  verifyPaymentSchema,
} from "../validators/commerce.validator";
import { paginationSchema } from "../validators/commerce.validator";
import { AppError } from "../utils/errors";
import { z } from "zod";

function cartContext(req: { user?: { id: string }; sessionId?: string }) {
  if (req.user) return { userId: req.user.id, sessionId: undefined };
  if (req.sessionId) return { userId: undefined, sessionId: req.sessionId };
  throw AppError.unauthorized("Sign in or start a shopping session");
}

export const cartController = {
  get: asyncHandler(async (req, res) => {
    const ctx = cartContext(req);
    const cart = await getCart(ctx.userId, ctx.sessionId);
    success(res, cart);
  }),

  add: asyncHandler(async (req, res) => {
    const input = cartAddSchema.parse(req.body);
    const ctx = cartContext(req);
    const cart = await addToCartService({ ...ctx, variantId: input.variantId, quantity: input.quantity });
    success(res, cart);
  }),

  update: asyncHandler(async (req, res) => {
    const input = cartUpdateSchema.parse(req.body);
    const ctx = cartContext(req);
    const cart = await updateCartItem({ ...ctx, variantId: input.variantId, quantity: input.quantity });
    success(res, cart);
  }),

  remove: asyncHandler(async (req, res) => {
    const ctx = cartContext(req);
    const cart = await removeCartItem({ ...ctx, itemId: (req.params.itemId as string) });
    success(res, cart);
  }),

  applyCoupon: asyncHandler(async (req, res) => {
    const input = applyCouponSchema.parse(req.body);
    const ctx = cartContext(req);
    const cart = await applyCouponToCart({ ...ctx, code: input.code });
    success(res, cart);
  }),

  removeCoupon: asyncHandler(async (req, res) => {
    const ctx = cartContext(req);
    const cart = await removeCouponFromCart(ctx);
    success(res, cart);
  }),
};

export const wishlistController = {
  list: asyncHandler(async (req, res) => {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await wishlistService.get(req.user!.id, page, limit);
    success(res, { items: result.items }, result.meta);
  }),

  add: asyncHandler(async (req, res) => {
    const body = z.object({ productId: z.string().min(1) }).parse(req.body);
    const result = await wishlistService.add(req.user!.id, body.productId);
    created(res, result);
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await wishlistService.remove(req.user!.id, (req.params.productId as string));
    success(res, result);
  }),

  check: asyncHandler(async (req, res) => {
    const inWishlist = await wishlistService.has(req.user!.id, (req.params.productId as string));
    success(res, { inWishlist });
  }),
};

export const orderController = {
  create: asyncHandler(async (req, res) => {
    const input = createOrderSchema.parse(req.body);
    const headerKey = req.header("idempotency-key");
    const idempotencyKey =
      typeof headerKey === "string" && headerKey.trim().length > 0 && headerKey.length <= 100
        ? headerKey.trim()
        : null;
    const order = await orderService.create({
      userId: req.user!.id,
      addressId: input.addressId,
      paymentMethod: input.paymentMethod,
      couponCode: input.couponCode,
      billingAddressId: input.billingAddressId,
      ip: req.ip,
      idempotencyKey,
    });
    created(res, order);
  }),

  listMine: asyncHandler(async (req, res) => {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await orderService.listForUser(req.user!.id, page, limit);
    success(res, { items: result.items }, result.meta);
  }),

  getMine: asyncHandler(async (req, res) => {
    const order = await orderService.getForUser(req.user!.id, (req.params.id as string));
    success(res, order);
  }),

  stats: asyncHandler(async (req, res) => {
    const stats = await orderService.statsForUser(req.user!.id);
    success(res, stats);
  }),

  listAdmin: asyncHandler(async (req, res) => {
    const query = paginationSchema
      .extend({
        search: z.string().trim().max(120).optional(),
        status: z
          .enum([
            "PENDING",
            "CONFIRMED",
            "PROCESSING",
            "PACKED",
            "SHIPPED",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "CANCELLED",
            "RETURNED",
            "REFUNDED",
          ])
          .optional(),
        paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .parse(req.query);

    const result = await orderService.listAdmin(query);
    success(res, { items: result.items }, result.meta);
  }),

  adminGet: asyncHandler(async (req, res) => {
    const order = await orderService.adminGet((req.params.id as string));
    success(res, order);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const input = z
      .object({
        status: z.enum([
          "PENDING",
          "CONFIRMED",
          "PROCESSING",
          "PACKED",
          "SHIPPED",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "CANCELLED",
          "RETURNED",
          "REFUNDED",
        ]),
        note: z.string().trim().max(300).optional().nullable(),
        trackingNumber: z.string().trim().max(80).optional().nullable(),
        courierName: z.string().trim().max(80).optional().nullable(),
        cancelReason: z.string().trim().max(300).optional().nullable(),
      })
      .parse(req.body);

    const order = await orderService.updateStatus((req.params.id as string), input, req.user!.id);
    success(res, order);
  }),
};

export const paymentController = {
  createIntent: asyncHandler(async (req, res) => {
    const input = paymentIntentSchema.parse(req.body);
    const intent = await paymentService.createIntent({
      orderId: input.orderId,
      userId: req.user!.id,
      isAdmin: req.user!.role === "ADMIN",
    });
    success(res, intent);
  }),

  verify: asyncHandler(async (req, res) => {
    const input = verifyPaymentSchema.parse(req.body);
    const order = await paymentService.verify({
      razorpayOrderId: input.razorpay_order_id,
      razorpayPaymentId: input.razorpay_payment_id,
      razorpaySignature: input.razorpay_signature,
      userId: req.user!.id,
      ip: req.ip,
    });
    success(res, order);
  }),

  devComplete: asyncHandler(async (req, res) => {
    const input = devCompletePaymentSchema.parse(req.body);
    const order = await paymentService.devComplete({
      orderId: input.orderId,
      userId: req.user!.id,
      ip: req.ip,
    });
    success(res, order);
  }),

  status: asyncHandler(async (req, res) => {
    const input = z.object({ orderId: z.string().min(1).max(64) }).parse(req.query);
    const order = await paymentService.getOrder(input.orderId, req.user!.id);
    success(res, { orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, status: order.status });
  }),
};
