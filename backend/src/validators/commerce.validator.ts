import { z } from "zod";
import { idSchema, moneyInput, paginationSchema } from "./common";

export { paginationSchema };

export const cartAddSchema = z.object({
  variantId: idSchema,
  quantity: z.number().int().min(1).max(99).default(1),
});

export const cartUpdateSchema = z.object({
  variantId: idSchema,
  quantity: z.number().int().min(0).max(99),
});

export const applyCouponSchema = z.object({
  code: z.string().trim().min(3).max(40).toUpperCase(),
});

export const createOrderSchema = z.object({
  addressId: idSchema,
  paymentMethod: z.enum(["RAZORPAY", "COD"]).default("RAZORPAY"),
  couponCode: z.string().trim().max(40).optional().nullable(),
  useDifferentBillingAddress: z.boolean().default(false),
  billingAddressId: idSchema.optional().nullable(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(300),
});

export const devCompletePaymentSchema = z.object({
  orderId: idSchema,
});

export const paymentIntentSchema = z.object({
  orderId: idSchema,
});

const couponBase = z.object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Coupon code may only contain letters, numbers, - and _")
      .transform((v) => v.toUpperCase()),
    description: z.string().trim().max(300).optional().nullable(),
    type: z.enum(["PERCENTAGE", "FIXED"]),
    value: moneyInput,
    minOrderAmount: moneyInput.default("0"),
    maxDiscount: moneyInput.optional().nullable(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    usageLimit: z.number().int().min(1).max(1000000).optional().nullable(),
    perUserLimit: z.number().int().min(1).max(1000).default(1),
    active: z.boolean().default(true),
    productIds: z.array(idSchema).default([]),
    variantIds: z.array(idSchema).default([]),
  });

export const createCouponSchema = couponBase
  .refine((c) => c.endsAt > c.startsAt, {
    message: "End date must be after start date",
    path: ["endsAt"],
  })
  .refine((c) => c.type !== "PERCENTAGE" || Number(c.value) <= 100, {
    message: "Percentage discount cannot exceed 100",
    path: ["value"],
  });

export const updateCouponSchema = couponBase.partial();

export const createReviewSchema = z.object({
  productId: idSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  comment: z.string().trim().min(10).max(2000),
  imageUrl: z.string().url().max(600).optional().nullable(),
  orderId: idSchema.optional().nullable(),
});

export const moderateReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
});

export const inventoryAdjustSchema = z
  .object({
    variantId: idSchema,
    type: z.enum(["STOCK_ADDED", "STOCK_REMOVED", "MANUAL_ADJUSTMENT", "RETURN"]),
    quantity: z.number().int().min(1).max(10000),
    note: z.string().trim().max(300).optional().nullable(),
  })
  .refine((v) => v.type !== "MANUAL_ADJUSTMENT" || v.quantity >= 1, {
    message: "Quantity required",
    path: ["quantity"],
  });

export const orderStatusSchema = z.object({
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
});

export const settingsSchema = z.record(
  z.string().min(1).max(80),
  z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown()), z.null()]),
);

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  range: z.enum(["7d", "30d", "90d", "1y", "all"]).default("30d"),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
