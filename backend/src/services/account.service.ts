import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { buildMeta } from "../utils/pagination";

export const addressService = {
  async list(userId: string) {
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    return addresses.map((a) => ({ ...a, createdAt: undefined }));
  },

  async create(userId: string, input: Omit<Prisma.AddressUncheckedCreateInput, "userId" | "id">) {
    const count = await prisma.address.count({ where: { userId } });
    const makeDefault = input.isDefault || count === 0;

    return prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          ...input,
          userId,
          isDefault: makeDefault,
          line2: input.line2 ?? null,
        },
      });
    });
  },

  async update(userId: string, id: string, input: Partial<Omit<Prisma.AddressUncheckedUpdateInput, "userId">>) {
    const address = await prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw AppError.notFound("Address not found");

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({ where: { id }, data: input });
    });
  },

  async remove(userId: string, id: string) {
    const address = await prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw AppError.notFound("Address not found");
    await prisma.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { deleted: true };
  },

  async setDefault(userId: string, id: string) {
    const address = await prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw AppError.notFound("Address not found");
    await prisma.$transaction([
      prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  },

  async get(userId: string, id: string) {
    const address = await prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw AppError.notFound("Address not found");
    return address;
  },
};

export const wishlistService = {
  async get(userId: string, page: number, limit: number) {
    const wishlist = await prisma.wishlist.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const where: Prisma.WishlistItemWhereInput = { wishlistId: wishlist.id };
    const [total, items] = await Promise.all([
      prisma.wishlistItem.count({ where }),
      prisma.wishlistItem.findMany({
        where,
        include: {
          product: {
            include: {
              images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
              variants: {
                where: { isActive: true },
                include: { inventory: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => {
        const variant = item.product.variants[0];
        const available = variant?.inventory
          ? Math.max(0, variant.inventory.quantity - variant.inventory.reserved)
          : 0;
        return {
          id: item.id,
          createdAt: item.createdAt.toISOString(),
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            image: item.product.images[0]?.url ?? null,
            price: item.product.price.toString(),
            mrp: item.product.mrp.toString(),
            discountPercent: item.product.discountPercent,
            ratingAverage: Number(item.product.ratingAverage),
            ratingCount: item.product.ratingCount,
            inStock: available > 0,
            variantId: variant?.id ?? null,
          },
        };
      }),
      meta: buildMeta(page, limit, total),
    };
  },

  async has(userId: string, productId: string) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) return false;
    const item = await prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });
    return Boolean(item);
  },

  async add(userId: string, productId: string) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw AppError.notFound("Product not found");

    const wishlist = await prisma.wishlist.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const existing = await prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });
    if (existing) return { added: false, item: existing };

    const item = await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId } });
    return { added: true, item };
  },

  async remove(userId: string, productId: string) {
    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) return { removed: true };
    await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id, productId } });
    return { removed: true };
  },

  async count(userId: string) {
    return prisma.wishlistItem.count({ where: { wishlist: { userId } } });
  },
};

export const notificationService = {
  async list(userId: string, page: number, limit: number, unreadOnly = false) {
    const where: Prisma.NotificationWhereInput = { userId, ...(unreadOnly ? { read: false } : {}) };
    const [total, items, unread] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      meta: { ...buildMeta(page, limit, total), unread },
    };
  },

  async markRead(userId: string, id: string) {
    await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { ok: true };
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { ok: true };
  },

  async unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, read: false } });
  },
};
