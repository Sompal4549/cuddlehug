import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { buildMeta } from "../utils/pagination";
import { slugify, uniqueSlug } from "../utils/slug";
import type { CreateProductInput, ListQuery } from "../validators/catalog.validator";

const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  shortDescription: true,
  mrp: true,
  price: true,
  discountPercent: true,
  status: true,
  isFeatured: true,
  isBestSeller: true,
  isNewArrival: true,
  ratingAverage: true,
  ratingCount: true,
  soldCount: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: [{ isPrimary: "desc" as const }, { position: "asc" as const }] },
  variants: {
    where: { isActive: true },
    select: {
      id: true,
      size: true,
      color: true,
      sku: true,
      price: true,
      mrp: true,
      inventory: { select: { quantity: true, reserved: true, lowStockThreshold: true } },
    },
  },
  _count: { select: { reviews: { where: { status: "APPROVED" as const } } } },
};

export type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export function toProductCard(product: ProductCardRow) {
  const available = product.variants.reduce(
    (acc, v) => acc + Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)),
    0,
  );
  const images = product.images.map((img) => ({ url: img.url, alt: img.alt, isPrimary: img.isPrimary }));
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    shortDescription: product.shortDescription,
    mrp: product.mrp.toString(),
    price: product.price.toString(),
    discountPercent: product.discountPercent,
    status: product.status,
    category: product.category,
    images,
    image: images[0]?.url ?? null,
    ratingAverage: Number(product.ratingAverage),
    ratingCount: product.ratingCount,
    reviewCount: product._count.reviews,
    soldCount: product.soldCount,
    isFeatured: product.isFeatured,
    isBestSeller: product.isBestSeller,
    isNewArrival: product.isNewArrival,
    inStock: available > 0,
    available,
    lowStock: available > 0 && available <= Math.min(...product.variants.map((v) => v.inventory?.lowStockThreshold ?? 5)),
    createdAt: product.createdAt.toISOString(),
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      sku: v.sku,
      price: v.price.toString(),
      mrp: v.mrp.toString(),
      available: Math.max(0, (v.inventory?.quantity ?? 0) - (v.inventory?.reserved ?? 0)),
    })),
  };
}

export type ProductCard = ReturnType<typeof toProductCard>;

function buildWhere(query: ListQuery, publicOnly: boolean): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (publicOnly) where.status = "ACTIVE";
  else if (query.status) where.status = query.status;

  if (query.category) {
    where.category = { OR: [{ slug: query.category }, { id: query.category }] };
  }

  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { shortDescription: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { tags: { has: term.toLowerCase() } },
      { category: { name: { contains: term, mode: "insensitive" } } },
    ];
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {
      ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
    };
  }

  if (query.size || query.color) {
    where.variants = {
      some: {
        isActive: true,
        ...(query.size ? { size: { in: query.size.split(",") as never[] } } : {}),
        ...(query.color ? { color: { in: query.color.split(",") as never[] } } : {}),
      },
    };
  }

  if (query.rating) {
    where.ratingAverage = { gte: query.rating };
  }

  if (query.availability === "in_stock") {
    where.variants = { some: { isActive: true, inventory: { quantity: { gt: 0 } } } };
  } else if (query.availability === "out_of_stock") {
    where.AND = [{ variants: { some: { isActive: true, inventory: { quantity: { lte: 0 } } } } }];
  }

  if (query.featured) where.isFeatured = true;
  if (query.bestSeller) where.isBestSeller = true;
  if (query.newArrival) where.isNewArrival = true;

  return where;
}

function buildOrderBy(sort: ListQuery["sort"], search?: string): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }];
    case "price_desc":
      return [{ price: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "rating":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    case "bestselling":
      return [{ soldCount: "desc" }, { createdAt: "desc" }];
    case "discount":
      return [{ discountPercent: "desc" }, { price: "asc" }];
    case "relevance":
    default:
      return search
        ? [{ soldCount: "desc" }, { ratingAverage: "desc" }]
        : [{ isFeatured: "desc" }, { soldCount: "desc" }, { createdAt: "desc" }];
  }
}

export const productService = {
  async list(query: ListQuery, options?: { publicOnly?: boolean }) {
    const publicOnly = options?.publicOnly ?? true;
    const where = buildWhere(query, publicOnly);
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        select: productCardSelect,
        orderBy: buildOrderBy(query.sort, query.search),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map(toProductCard),
      meta: {
        ...buildMeta(query.page, query.limit, total),
        sort: query.sort,
        search: query.search ?? null,
        category: query.category ?? null,
      },
    };
  },

  async featured(limit = 8) {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE", isFeatured: true },
      select: productCardSelect,
      orderBy: [{ soldCount: "desc" }],
      take: limit,
    });
    return rows.map(toProductCard);
  },

  async bestSellers(limit = 8) {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: productCardSelect,
      orderBy: [{ isBestSeller: "desc" }, { soldCount: "desc" }, { ratingAverage: "desc" }],
      take: limit,
    });
    return rows.map(toProductCard);
  },

  async newArrivals(limit = 8) {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: productCardSelect,
      orderBy: [{ isNewArrival: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    return rows.map(toProductCard);
  },

  async related(productId: string, categoryId: string, limit = 6) {
    const rows = await prisma.product.findMany({
      where: { status: "ACTIVE", categoryId, id: { not: productId } },
      select: productCardSelect,
      orderBy: [{ ratingAverage: "desc" }, { soldCount: "desc" }],
      take: limit,
    });
    if (rows.length < limit) {
      const filler = await prisma.product.findMany({
        where: { status: "ACTIVE", id: { notIn: [productId, ...rows.map((r) => r.id)] } },
        select: productCardSelect,
        orderBy: [{ soldCount: "desc" }],
        take: limit - rows.length,
      });
      rows.push(...filler);
    }
    return rows.map(toProductCard);
  },

  async getBySlug(slug: string) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
        variants: {
          where: { isActive: true },
          include: { inventory: true },
          orderBy: [{ size: "asc" }, { color: "asc" }],
        },
      },
    });
    if (!product || product.status !== "ACTIVE") throw AppError.notFound("Product not found");

    const [, aggregates] = await Promise.all([
      prisma.review.count({ where: { productId: product.id, status: "APPROVED" } }),
      prisma.review.aggregate({
        where: { productId: product.id, status: "APPROVED" },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    const ratingAverage = aggregates._avg.rating ?? Number(product.ratingAverage);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      shortDescription: product.shortDescription,
      description: product.description,
      mrp: product.mrp.toString(),
      price: product.price.toString(),
      discountPercent: product.discountPercent,
      status: product.status,
      material: product.material,
      filling: product.filling,
      weightGrams: product.weightGrams,
      careInstructions: product.careInstructions,
      ageRecommendation: product.ageRecommendation,
      tags: product.tags,
      isFeatured: product.isFeatured,
      isBestSeller: product.isBestSeller,
      isNewArrival: product.isNewArrival,
      soldCount: product.soldCount,
      lowStockThreshold: product.lowStockThreshold,
      ratingAverage: Math.round(ratingAverage * 10) / 10,
      ratingCount: aggregates._count || product.ratingCount,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      images: product.images.map((img) => ({
        id: img.id,
        url: img.url,
        alt: img.alt ?? product.name,
        isPrimary: img.isPrimary,
      })),
      variants: product.variants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        sku: v.sku,
        price: v.price.toString(),
        mrp: v.mrp.toString(),
        available: Math.max(0, v.inventory ? v.inventory.quantity - v.inventory.reserved : 0),
        lowStock:
          v.inventory !== null &&
          v.inventory.quantity - v.inventory.reserved > 0 &&
          v.inventory.quantity - v.inventory.reserved <= v.inventory.lowStockThreshold,
      })),
      createdAt: product.createdAt.toISOString(),
    };
  },

  async adminGet(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
        variants: { include: { inventory: true } },
      },
    });
    if (!product) throw AppError.notFound("Product not found");
    return product;
  },

  async create(input: CreateProductInput) {
    const slug = await uniqueSlug(input.name, async (candidate) =>
      Boolean(await prisma.product.findUnique({ where: { slug: candidate } })),
    );
    const skuExists = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (skuExists) throw AppError.conflict(`SKU ${input.sku} is already in use`);

    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw AppError.notFound("Category not found");

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: input.name,
          slug,
          sku: input.sku,
          categoryId: input.categoryId,
          shortDescription: input.shortDescription ?? null,
          description: input.description,
          mrp: input.mrp,
          price: input.price,
          discountPercent: input.discountPercent,
          status: input.status,
          material: input.material ?? null,
          filling: input.filling ?? null,
          weightGrams: input.weightGrams ?? null,
          careInstructions: input.careInstructions ?? null,
          ageRecommendation: input.ageRecommendation ?? null,
          tags: input.tags.map((t) => t.toLowerCase()),
          isFeatured: input.isFeatured,
          isBestSeller: input.isBestSeller,
          isNewArrival: input.isNewArrival,
          lowStockThreshold: input.lowStockThreshold,
          images: {
            create: input.images.map((img, index) => ({
              url: img.url,
              alt: img.alt ?? input.name,
              position: img.position ?? index,
              isPrimary: img.isPrimary ?? index === 0,
            })),
          },
          variants: {
            create: await Promise.all(
              input.variants.map(async (variant) => ({
                size: variant.size,
                color: variant.color,
                sku: variant.sku,
                mrp: variant.mrp,
                price: variant.price,
                isActive: variant.isActive,
                inventory: {
                  create: {
                    quantity: variant.stock ?? 0,
                    lowStockThreshold: variant.lowStockThreshold ?? input.lowStockThreshold,
                  },
                },
              })),
            ),
          },
        },
        include: { images: true, variants: { include: { inventory: true } }, category: true },
      });
      return product;
    },{ timeout: 20000, maxWait: 5000 });
  },

  async update(id: string, input: Partial<CreateProductInput>) {
    const existing = await prisma.product.findUnique({ where: { id }, include: { images: true } });
    if (!existing) throw AppError.notFound("Product not found");

    if (input.sku && input.sku !== existing.sku) {
      const conflict = await prisma.product.findUnique({ where: { sku: input.sku } });
      if (conflict) throw AppError.conflict(`SKU ${input.sku} is already in use`);
    }
    if (input.categoryId) {
      const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
      if (!category) throw AppError.notFound("Category not found");
    }

    const slug =
      input.name && input.name !== existing.slug
        ? await uniqueSlug(input.name, async (candidate) => {
            const found = await prisma.product.findUnique({ where: { slug: candidate } });
            return Boolean(found && found.id !== id);
          })
        : undefined;

    return prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: input.name,
          slug,
          sku: input.sku,
          categoryId: input.categoryId,
          shortDescription: input.shortDescription,
          description: input.description,
          mrp: input.mrp,
          price: input.price,
          discountPercent: input.discountPercent,
          status: input.status,
          material: input.material,
          filling: input.filling,
          weightGrams: input.weightGrams,
          careInstructions: input.careInstructions,
          ageRecommendation: input.ageRecommendation,
          tags: input.tags?.map((t) => t.toLowerCase()),
          isFeatured: input.isFeatured,
          isBestSeller: input.isBestSeller,
          isNewArrival: input.isNewArrival,
          lowStockThreshold: input.lowStockThreshold,
        },
      });

      if (input.images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (input.images.length) {
          await tx.productImage.createMany({
            data: input.images.map((img, index) => ({
              productId: id,
              url: img.url,
              alt: img.alt ?? input.name ?? existing.name,
              position: img.position ?? index,
              isPrimary: img.isPrimary ?? index === 0,
            })),
          });
        }
      }

      if (input.variants) {
        const current = await tx.productVariant.findMany({ where: { productId: id } });
        const keptIds = input.variants.filter((v) => v.id).map((v) => v.id!);
        const removable = current.filter((v) => !keptIds.includes(v.id));

        for (const gone of removable) {
          const used = await tx.orderItem.count({ where: { variantId: gone.id } });
          if (used > 0) {
            await tx.productVariant.update({ where: { id: gone.id }, data: { isActive: false } });
          } else {
            await tx.productVariant.delete({ where: { id: gone.id } }).catch(async () => {
              await tx.productVariant.update({ where: { id: gone.id }, data: { isActive: false } });
            });
          }
        }

        for (const variant of input.variants) {
          if (variant.id) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                size: variant.size,
                color: variant.color,
                sku: variant.sku,
                mrp: variant.mrp,
                price: variant.price,
                isActive: variant.isActive,
              },
            });
            if (variant.stock !== undefined) {
              await tx.inventory.updateMany({
                where: { variantId: variant.id },
                data: { quantity: variant.stock },
              });
            }
            if (variant.lowStockThreshold !== undefined) {
              await tx.inventory.updateMany({
                where: { variantId: variant.id },
                data: { lowStockThreshold: variant.lowStockThreshold },
              });
            }
          } else {
            const skuConflict = await tx.productVariant.findUnique({ where: { sku: variant.sku } });
            if (skuConflict) throw AppError.conflict(`Variant SKU ${variant.sku} already exists`);
            await tx.productVariant.create({
              data: {
                productId: id,
                size: variant.size,
                color: variant.color,
                sku: variant.sku,
                mrp: variant.mrp,
                price: variant.price,
                isActive: variant.isActive,
                inventory: {
                  create: {
                    quantity: variant.stock ?? 0,
                    lowStockThreshold: variant.lowStockThreshold ?? input.lowStockThreshold ?? existing.lowStockThreshold,
                  },
                },
              },
            });
          }
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: { images: true, variants: { include: { inventory: true } }, category: true },
      });
    },{ timeout: 20000, maxWait: 5000 });
  },

  async remove(id: string) {
    const product = await prisma.product.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } });
    if (!product) throw AppError.notFound("Product not found");

    if (product._count.orderItems > 0) {
      // Never break historical orders: archive instead of hard delete.
      return prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    }
    await prisma.product.delete({ where: { id } });
    return { deleted: true };
  },

  async togglePublish(id: string, status: "ACTIVE" | "DRAFT" | "ARCHIVED") {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw AppError.notFound("Product not found");
    return prisma.product.update({ where: { id }, data: { status } });
  },
};

export { productCardSelect, buildWhere as buildProductWhere, buildOrderBy as buildProductOrderBy };
export const categorySlugify = slugify;
