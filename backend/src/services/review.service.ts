import { Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { buildMeta } from "../utils/pagination";
import type { CreateReviewInput } from "../validators/commerce.validator";

const reviewInclude = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  product: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewWithRelations = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

export function toReviewDto(review: ReviewWithRelations) {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title,
    comment: review.comment,
    imageUrl: review.imageUrl,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    user: review.user
      ? {
          id: review.user.id,
          name: `${review.user.firstName} ${review.user.lastName}`,
          avatarUrl: review.user.avatarUrl,
        }
      : null,
    product: review.product,
  };
}

async function recomputeProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: ReviewStatus.APPROVED },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAverage: (agg._avg.rating ?? 0).toFixed(2),
      ratingCount: agg._count,
    },
  });
}

export const reviewService = {
  async listForProduct(productId: string, page: number, limit: number) {
    const where: Prisma.ReviewWhereInput = { productId, status: ReviewStatus.APPROVED };
    const [total, reviews, distribution] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.groupBy({
        by: ["rating"],
        where: { productId, status: ReviewStatus.APPROVED },
        _count: true,
      }),
    ]);

    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const row of distribution) {
      dist[row.rating as keyof typeof dist] = row._count;
    }

    return { items: reviews.map(toReviewDto), meta: buildMeta(page, limit, total), distribution: dist };
  },

  /**
   * Only a customer with a qualifying (non-cancelled) order for the product
   * can write a review.
   */
  async create(userId: string, input: CreateReviewInput) {
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw AppError.notFound("Product not found");

    const purchased = await prisma.order.findFirst({
      where: {
        userId,
        status: { notIn: ["CANCELLED", "RETURNED"] },
        items: { some: { productId: input.productId } },
      },
      select: { id: true },
    });
    if (!purchased) {
      throw new AppError("You can only review products you have purchased", 403, "FORBIDDEN");
    }

    const existing = await prisma.review.findUnique({
      where: { productId_userId: { productId: input.productId, userId } },
    });
    if (existing) throw AppError.conflict("You have already reviewed this product");

    const review = await prisma.review.create({
      data: {
        productId: input.productId,
        userId,
        orderId: input.orderId ?? purchased.id,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
        imageUrl: input.imageUrl ?? null,
        status: ReviewStatus.PENDING,
      },
      include: reviewInclude,
    });

    return { review: toReviewDto(review), message: "Thanks! Your review is awaiting moderation." };
  },

  async listMine(userId: string, page: number, limit: number) {
    const where: Prisma.ReviewWhereInput = { userId };
    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items: reviews.map(toReviewDto), meta: buildMeta(page, limit, total) };
  },

  async listAdmin(params: {
    page: number;
    limit: number;
    status?: ReviewStatus;
    search?: string;
    productId?: string;
  }) {
    const where: Prisma.ReviewWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: "insensitive" } },
              { comment: { contains: params.search, mode: "insensitive" } },
              { product: { name: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);
    return { items: reviews.map(toReviewDto), meta: buildMeta(params.page, params.limit, total) };
  },

  async moderate(id: string, status: ReviewStatus) {
    const review = await prisma.review.update({ where: { id }, data: { status }, include: reviewInclude });
    await recomputeProductRating(review.productId);
    return toReviewDto(review);
  },

  async remove(id: string) {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw AppError.notFound("Review not found");
    await prisma.review.delete({ where: { id } });
    await recomputeProductRating(review.productId);
    return { deleted: true };
  },
};
