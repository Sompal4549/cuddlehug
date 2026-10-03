import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { toMinor, fromMinor } from "../utils/money";
import type { CouponForPricing } from "./pricing";

export type ValidatedCoupon = {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: string;
  description: string | null;
  minOrderAmount: string;
  maxDiscount: string | null;
  endsAt: Date;
  variantIds: string[];
};

/**
 * Validates a coupon for a given cart. Throws INVALID_COUPON with an
 * explanatory message when the code cannot be used.
 */
export async function validateCoupon(params: {
  code: string;
  userId: string | null;
  subtotalMinor: bigint;
  variantIds: string[];
}): Promise<ValidatedCoupon> {
  const code = params.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: { products: { select: { productId: true } }, variants: { select: { variantId: true } } },
  });

  if (!coupon) throw new AppError("This coupon code does not exist", 400, "INVALID_COUPON");
  if (!coupon.active) throw new AppError("This coupon is no longer active", 400, "INVALID_COUPON");

  const now = Date.now();
  if (coupon.startsAt.getTime() > now) throw new AppError("This coupon is not active yet", 400, "INVALID_COUPON");
  if (coupon.endsAt.getTime() < now) throw new AppError("This coupon has expired", 400, "INVALID_COUPON");

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError("This coupon has reached its usage limit", 400, "INVALID_COUPON");
  }

  if (params.subtotalMinor < toMinor(coupon.minOrderAmount)) {
    throw new AppError(
      `This coupon requires a minimum order of ₹${fromMinor(toMinor(coupon.minOrderAmount))}`,
      400,
      "INVALID_COUPON",
    );
  }

  if (params.userId) {
    const used = await prisma.couponUsage.count({ where: { couponId: coupon.id, userId: params.userId } });
    if (used >= coupon.perUserLimit) {
      throw new AppError("You have already used this coupon", 400, "INVALID_COUPON");
    }
  }

  const restrictedProductIds = coupon.products.map((p) => p.productId);
  const restrictedVariantIds = coupon.variants.map((v) => v.variantId);

  if (restrictedProductIds.length > 0 || restrictedVariantIds.length > 0) {
    const eligible = await prisma.productVariant.findMany({
      where: {
        id: { in: params.variantIds },
        ...(restrictedProductIds.length > 0
          ? { OR: [{ productId: { in: restrictedProductIds } }, { id: { in: restrictedVariantIds } }] }
          : { id: { in: restrictedVariantIds } }),
      },
      select: { id: true },
    });
    if (eligible.length === 0) {
      throw new AppError("This coupon does not apply to the items in your cart", 400, "INVALID_COUPON");
    }
  }

  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: fromMinor(toMinor(coupon.value)),
    description: coupon.description,
    minOrderAmount: fromMinor(toMinor(coupon.minOrderAmount)),
    maxDiscount: coupon.maxDiscount ? fromMinor(toMinor(coupon.maxDiscount)) : null,
    endsAt: coupon.endsAt,
    variantIds: restrictedVariantIds,
  };
}

export function toPricingCoupon(coupon: ValidatedCoupon): CouponForPricing {
  return {
    type: coupon.type,
    value: coupon.value,
    maxDiscount: coupon.maxDiscount,
    minOrderAmount: coupon.minOrderAmount,
    variantIds: coupon.variantIds,
  };
}

export async function recordCouponUsage(params: {
  couponId: string;
  userId: string;
  orderId: string;
  discountAmount: bigint;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? prisma;
  await client.couponUsage.create({
    data: {
      couponId: params.couponId,
      userId: params.userId,
      orderId: params.orderId,
      discountAmount: fromMinor(params.discountAmount),
    },
  });
  await client.coupon.update({ where: { id: params.couponId }, data: { usedCount: { increment: 1 } } });
}

export async function listCoupons(params: { page: number; limit: number; search?: string; active?: boolean }) {
  const where: Prisma.CouponWhereInput = {
    ...(params.search ? { code: { contains: params.search, mode: "insensitive" } } : {}),
    ...(params.active === undefined ? {} : { active: params.active }),
  };
  const [total, items] = await Promise.all([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: { products: true, variants: true, _count: { select: { usages: true } } },
    }),
  ]);
  return { items, total };
}

export async function countUsages(couponId: string): Promise<number> {
  return prisma.couponUsage.count({ where: { couponId } });
}

export async function deactivateCoupon(couponId: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId }, include: { products: true, variants: true } });
  if (!coupon) throw AppError.notFound("Coupon not found");
  const updated = await prisma.coupon.update({ where: { id: couponId }, data: { active: false } });
  return { ...updated, products: coupon.products, variants: coupon.variants };
}

export async function removeCoupon(couponId: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw AppError.notFound("Coupon not found");
  await prisma.coupon.delete({ where: { id: couponId } });
  return { deleted: true };
}

export type CreateCouponInput = {
  code: string;
  description?: string | null;
  type: "PERCENTAGE" | "FIXED";
  value: string | number;
  minOrderAmount: string | number;
  maxDiscount?: string | number | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit?: number | null;
  perUserLimit: number;
  active: boolean;
  productIds: string[];
  variantIds: string[];
};

export async function createCoupon(input: CreateCouponInput) {
  const exists = await prisma.coupon.findUnique({ where: { code: input.code.toUpperCase() } });
  if (exists) throw AppError.conflict(`Coupon code ${input.code.toUpperCase()} already exists`);

  return prisma.coupon.create({
    data: {
      code: input.code.toUpperCase(),
      description: input.description ?? null,
      type: input.type,
      value: input.value,
      minOrderAmount: input.minOrderAmount,
      maxDiscount: input.maxDiscount ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit,
      active: input.active,
      products: input.productIds.length ? { create: input.productIds.map((productId) => ({ productId })) } : undefined,
      variants: input.variantIds.length ? { create: input.variantIds.map((variantId) => ({ variantId })) } : undefined,
    },
    include: { products: true, variants: true },
  });
}

export async function updateCoupon(id: string, input: Partial<CreateCouponInput>) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw AppError.notFound("Coupon not found");

  const { productIds, variantIds, ...rest } = input;
  return prisma.$transaction(async (tx) => {
    if (productIds) {
      await tx.couponProduct.deleteMany({ where: { couponId: id } });
      if (productIds.length)
        await tx.couponProduct.createMany({ data: productIds.map((productId) => ({ couponId: id, productId })) });
    }
    if (variantIds) {
      await tx.couponVariant.deleteMany({ where: { couponId: id } });
      if (variantIds.length)
        await tx.couponVariant.createMany({ data: variantIds.map((variantId) => ({ couponId: id, variantId })) });
    }
    return tx.coupon.update({
      where: { id },
      data: {
        ...rest,
        code: rest.code ? rest.code.toUpperCase() : undefined,
        value: rest.value,
      },
      include: { products: true, variants: true },
    });
  },{ timeout: 20000, maxWait: 5000 });
}
