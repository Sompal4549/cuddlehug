import { OrderStatus, PaymentStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { buildMeta } from "../utils/pagination";
import { available } from "./inventory.service";

export type RangeInput = { from?: Date; to?: Date; range: "7d" | "30d" | "90d" | "1y" | "all" };

export function resolveRange(input: RangeInput): { from: Date; to: Date } {
  const to = input.to ?? new Date();
  let from = input.from;
  if (!from) {
    switch (input.range) {
      case "7d":
        from = new Date(to.getTime() - 7 * 86400000);
        break;
      case "30d":
        from = new Date(to.getTime() - 30 * 86400000);
        break;
      case "90d":
        from = new Date(to.getTime() - 90 * 86400000);
        break;
      case "1y":
        from = new Date(to.getTime() - 365 * 86400000);
        break;
      default:
        from = new Date(0);
    }
  }
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

const ACTIVE_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
];

export const adminService = {
  async dashboard(input: RangeInput) {
    const { from, to } = resolveRange(input);

    const [
      totalOrders,
      pendingOrders,
      totalProducts,
      totalCustomers,
      paidAgg,
      refundAgg,
      lowStock,
      revenueRows,
      statusRows,
      topProducts,
      recentOrders,
      newCustomers,
      reviewQueue,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      prisma.product.count({ where: { status: { not: "ARCHIVED" } } }),
      prisma.user.count({ where: { role: Role.CUSTOMER } }),
      prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: from, lte: to } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.REFUNDED, createdAt: { gte: from, lte: to } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      getLowStock(),
      prisma.order.findMany({
        where: { createdAt: { gte: from, lte: to }, status: { notIn: ["CANCELLED"] } },
        select: { createdAt: true, totalAmount: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.order.groupBy({ by: ["status"], _count: true }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true, lineTotal: true },
        _count: true,
        orderBy: { _sum: { quantity: "desc" } },
        take: 8,
      }),
      prisma.order.findMany({
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          items: { select: { productName: true, quantity: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.user.count({ where: { role: Role.CUSTOMER, createdAt: { gte: from, lte: to } } }),
      prisma.review.count({ where: { status: "PENDING" } }),
    ]);

    const topProductIds = topProducts.map((t) => t.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, slug: true, images: { take: 1, select: { url: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      cards: {
        totalSales: paidAgg._sum.totalAmount?.toString() ?? "0.00",
        totalOrders,
        totalProducts,
        totalCustomers,
        pendingOrders,
        lowStock: lowStock.length,
        revenue: paidAgg._sum.totalAmount?.toString() ?? "0.00",
        refunds: refundAgg._sum.totalAmount?.toString() ?? "0.00",
        paidOrders: paidAgg._count,
        refundedOrders: refundAgg._count,
        newCustomers,
        pendingReviews: reviewQueue,
      },
      chart: buildDailySeries(revenueRows, from, to),
      statusBreakdown: statusRows.map((s) => ({ status: s.status, count: s._count })),
      topProducts: topProducts.map((t) => ({
        productId: t.productId,
        name: productMap.get(t.productId)?.name ?? "Unknown product",
        slug: productMap.get(t.productId)?.slug ?? "",
        image: productMap.get(t.productId)?.images[0]?.url ?? null,
        quantity: t._sum.quantity ?? 0,
        revenue: t._sum.lineTotal?.toString() ?? "0.00",
        orders: t._count,
      })),
      lowStock,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount.toString(),
        createdAt: o.createdAt.toISOString(),
        customer: o.user
          ? `${o.user.firstName} ${o.user.lastName}`
          : "Unknown",
        email: o.user?.email ?? "",
        itemCount: o.items.length,
        items: o.items.map((i) => `${i.productName} ×${i.quantity}`),
      })),
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  },

  async customers(params: { page: number; limit: number; search?: string; status?: string }) {
    const where: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: "insensitive" } },
              { firstName: { contains: params.search, mode: "insensitive" } },
              { lastName: { contains: params.search, mode: "insensitive" } },
              { phone: { contains: params.search } },
            ],
          }
        : {}),
      ...(params.status ? { status: params.status as never } : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          orders: {
            select: { totalAmount: true, createdAt: true, paymentStatus: true },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { orders: true, reviews: true } },
        },
      }),
    ]);

    return {
      items: users.map((u) => {
        const spend = u.orders
          .filter((o) => o.paymentStatus === PaymentStatus.PAID)
          .reduce((acc, o) => acc + Number(o.totalAmount), 0);
        return {
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
          orderCount: u._count.orders,
          reviewCount: u._count.reviews,
          totalSpend: spend.toFixed(2),
          lastOrderAt: u.orders[0]?.createdAt.toISOString() ?? null,
        };
      }),
      meta: buildMeta(params.page, params.limit, total),
    };
  },

  async setCustomerStatus(userId: string, status: "ACTIVE" | "BLOCKED") {
    const user = await prisma.user.findFirst({ where: { id: userId, role: Role.CUSTOMER } });
    if (!user) throw new Error("Customer not found");
    const updated = await prisma.user.update({ where: { id: userId }, data: { status } });
    if (status === "BLOCKED") {
      await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return { id: updated.id, status: updated.status };
  },

  async auditLogs(params: { page: number; limit: number; entity?: string; userId?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.entity ? { entity: params.entity } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
    ]);
    return {
      items: items.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        meta: log.meta,
        ip: log.ip,
        createdAt: log.createdAt.toISOString(),
        actor: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : null,
      })),
      meta: buildMeta(params.page, params.limit, total),
    };
  },
};

async function getLowStock() {
  const inventories = await prisma.inventory.findMany({
    include: {
      variant: {
        include: {
          product: { select: { id: true, name: true, slug: true, lowStockThreshold: true } },
        },
      },
    },
    take: 500,
  });

  return inventories
    .map((inv) => ({
      variantId: inv.variantId,
      sku: inv.variant.sku,
      size: inv.variant.size,
      color: inv.variant.color,
      quantity: inv.quantity,
      reserved: inv.reserved,
      available: available(inv),
      lowStockThreshold: inv.lowStockThreshold,
      product: inv.variant.product,
    }))
    .filter((row) => row.available <= row.lowStockThreshold)
    .sort((a, b) => a.available - b.available)
    .slice(0, 50);
}

function buildDailySeries(
  rows: { createdAt: Date; totalAmount: Prisma.Decimal }[],
  from: Date,
  to: Date,
) {
  const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    buckets.set(cursor.toISOString().slice(0, 10), { date: cursor.toISOString().slice(0, 10), revenue: 0, orders: 0 });
    cursor.setDate(cursor.getDate() + 1);
    if (buckets.size > 400) break;
  }
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? { date: key, revenue: 0, orders: 0 };
    bucket.revenue += Number(row.totalAmount);
    bucket.orders += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}
