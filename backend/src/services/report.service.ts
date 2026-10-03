import { OrderStatus, PaymentStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { available } from "./inventory.service";
import { resolveRange, type RangeInput } from "./admin.service";

async function orderRangeWhere(input: RangeInput): Promise<Prisma.OrderWhereInput> {
  const { from, to } = resolveRange(input);
  return { createdAt: { gte: from, lte: to } };
}

export const reportService = {
  async sales(input: RangeInput) {
    const where = await orderRangeWhere(input);
    const orders = await prisma.order.findMany({
      where,
      select: { createdAt: true, totalAmount: true, discountAmount: true, taxAmount: true, shippingAmount: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    const byDay = new Map<string, { date: string; orders: number; revenue: number; tax: number; shipping: number; discounts: number }>();
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? { date: key, orders: 0, revenue: 0, tax: 0, shipping: 0, discounts: 0 };
      entry.orders += 1;
      entry.revenue += Number(order.totalAmount);
      entry.tax += Number(order.taxAmount);
      entry.shipping += Number(order.shippingAmount);
      entry.discounts += Number(order.discountAmount);
      byDay.set(key, entry);
    }

    const totals = orders.reduce(
      (acc, o) => {
        acc.revenue += Number(o.totalAmount);
        acc.tax += Number(o.taxAmount);
        acc.shipping += Number(o.shippingAmount);
        acc.discounts += Number(o.discountAmount);
        return acc;
      },
      { revenue: 0, tax: 0, shipping: 0, discounts: 0 },
    );

    return {
      series: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      totals: {
        orders: orders.length,
        revenue: totals.revenue.toFixed(2),
        tax: totals.tax.toFixed(2),
        shipping: totals.shipping.toFixed(2),
        discounts: totals.discounts.toFixed(2),
        averageOrderValue: orders.length ? (totals.revenue / orders.length).toFixed(2) : "0.00",
      },
    };
  },

  async orders(input: RangeInput) {
    const where = await orderRangeWhere(input);
    const [byStatus, byPayment, byMethod, count] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where, _count: true, _sum: { totalAmount: true } }),
      prisma.order.groupBy({ by: ["paymentStatus"], where, _count: true, _sum: { totalAmount: true } }),
      prisma.order.groupBy({ by: ["paymentMethod"], where, _count: true, _sum: { totalAmount: true } }),
      prisma.order.count({ where }),
    ]);
    return {
      total: count,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count, amount: r._sum.totalAmount?.toString() ?? "0.00" })),
      byPaymentStatus: byPayment.map((r) => ({
        status: r.paymentStatus,
        count: r._count,
        amount: r._sum.totalAmount?.toString() ?? "0.00",
      })),
      byPaymentMethod: byMethod.map((r) => ({
        method: r.paymentMethod,
        count: r._count,
        amount: r._sum.totalAmount?.toString() ?? "0.00",
      })),
    };
  },

  async products(input: RangeInput & { categoryId?: string; page: number; limit: number }) {
    const where = await orderRangeWhere(input);
    const grouped = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: where },
      _sum: { quantity: true, lineTotal: true },
      _count: true,
    });

    const ids = grouped.map((g) => g.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, ...(input.categoryId ? { categoryId: input.categoryId } : {}) },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        mrp: true,
        soldCount: true,
        ratingAverage: true,
        ratingCount: true,
        status: true,
        images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { reviews: { where: { status: "APPROVED" } } } },
      },
    });

    const map = new Map(products.map((p) => [p.id, p]));
    const rows = grouped
      .map((g) => {
        const product = map.get(g.productId);
        if (!product) return null;
        return {
          productId: g.productId,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          category: product.category,
          image: product.images[0]?.url ?? null,
          price: product.price.toString(),
          mrp: product.mrp.toString(),
          unitsSold: g._sum.quantity ?? 0,
          revenue: g._sum.lineTotal?.toString() ?? "0.00",
          orderLines: g._count,
          rating: Number(product.ratingAverage),
          ratingCount: product.ratingCount,
          status: product.status,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.unitsSold ?? 0) - (a!.unitsSold ?? 0));

    const start = (input.page - 1) * input.limit;
    return { items: rows.slice(start, start + input.limit), total: rows.length };
  },

  async inventory(params: { lowOnly: boolean; search?: string; page: number; limit: number }) {
    const inventories = await prisma.inventory.findMany({
      include: {
        variant: {
          include: {
            product: { select: { id: true, name: true, slug: true, status: true } },
            transactions: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    let rows = inventories.map((inv) => ({
      inventoryId: inv.id,
      variantId: inv.variantId,
      sku: inv.variant.sku,
      size: inv.variant.size,
      color: inv.variant.color,
      quantity: inv.quantity,
      reserved: inv.reserved,
      available: available(inv),
      lowStockThreshold: inv.lowStockThreshold,
      updatedAt: inv.updatedAt.toISOString(),
      lastMovement: inv.variant.transactions[0]
        ? {
            type: inv.variant.transactions[0].type,
            delta: inv.variant.transactions[0].delta,
            at: inv.variant.transactions[0].createdAt.toISOString(),
          }
        : null,
      product: inv.variant.product,
    }));

    if (params.search) {
      const term = params.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.sku.toLowerCase().includes(term) ||
          r.product.name.toLowerCase().includes(term) ||
          r.product.slug.toLowerCase().includes(term),
      );
    }
    if (params.lowOnly) rows = rows.filter((r) => r.available <= r.lowStockThreshold);

    const start = (params.page - 1) * params.limit;
    return {
      items: rows.slice(start, start + params.limit),
      total: rows.length,
      summary: {
        totalVariants: inventories.length,
        totalUnits: inventories.reduce((acc, i) => acc + i.quantity, 0),
        totalReserved: inventories.reduce((acc, i) => acc + i.reserved, 0),
        outOfStock: inventories.filter((i) => available(i) <= 0).length,
        lowStock: inventories.filter((i) => available(i) > 0 && available(i) <= i.lowStockThreshold).length,
      },
    };
  },

  async inventoryTransactions(params: { page: number; limit: number; variantId?: string; type?: string }) {
    const where: Prisma.InventoryTransactionWhereInput = {
      ...(params.variantId ? { variantId: params.variantId } : {}),
      ...(params.type ? { type: params.type as never } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          variant: { include: { product: { select: { name: true, slug: true } } } },
          actor: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        quantity: t.quantity,
        delta: t.delta,
        referenceId: t.referenceId,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
        variant: {
          id: t.variantId,
          sku: t.variant.sku,
          size: t.variant.size,
          color: t.variant.color,
          product: t.variant.product,
        },
        actor: t.actor ? `${t.actor.firstName} ${t.actor.lastName}` : null,
      })),
      meta: { page: params.page, limit: params.limit, total, totalPages: Math.max(1, Math.ceil(total / params.limit)) },
    };
  },

  async customers(input: RangeInput) {
    const where = await orderRangeWhere(input);
    const grouped = await prisma.order.groupBy({
      by: ["userId"],
      where,
      _count: true,
      _sum: { totalAmount: true },
    });
    const ids = grouped.map((g) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, role: Role.CUSTOMER },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        status: true,
        orders: { select: { createdAt: true, paymentStatus: true, totalAmount: true }, orderBy: { createdAt: "desc" } },
      },
    });
    const map = new Map(users.map((u) => [u.id, u]));

    return grouped
      .map((g) => {
        const user = map.get(g.userId);
        if (!user) return null;
        const paidSpend = user.orders
          .filter((o) => o.paymentStatus === PaymentStatus.PAID)
          .reduce((acc, o) => acc + Number(o.totalAmount), 0);
        return {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          status: user.status,
          orders: g._count,
          totalSpend: paidSpend.toFixed(2),
          lastOrderAt: user.orders[0]?.createdAt.toISOString() ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b!.totalSpend) - Number(a!.totalSpend));
  },

  async coupons(input: RangeInput) {
    const where = { createdAt: { ...(await resolveRangeAsync(input)) } };
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true, orders: true } } },
    });
    const usages = await prisma.couponUsage.findMany({ where, select: { couponId: true, discountAmount: true } });
    const discountByCoupon = new Map<string, number>();
    for (const usage of usages) {
      discountByCoupon.set(usage.couponId, (discountByCoupon.get(usage.couponId) ?? 0) + Number(usage.discountAmount));
    }

    return coupons.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value.toString(),
      active: c.active,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      usageLimit: c.usageLimit,
      usedCount: c.usedCount,
      perUserLimit: c.perUserLimit,
      minOrderAmount: c.minOrderAmount.toString(),
      maxDiscount: c.maxDiscount?.toString() ?? null,
      totalUsages: c._count.usages,
      discountGiven: (discountByCoupon.get(c.id) ?? 0).toFixed(2),
    }));
  },

  async revenue(input: RangeInput) {
    const where = await orderRangeWhere(input);
    const orders = await prisma.order.findMany({
      where,
      select: { createdAt: true, totalAmount: true, paymentStatus: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    let cumulative = 0;
    const series = orders.map((o) => {
      const isRevenue = o.paymentStatus === PaymentStatus.PAID || o.status === OrderStatus.DELIVERED;
      if (isRevenue) cumulative += Number(o.totalAmount);
      return {
        date: o.createdAt.toISOString().slice(0, 10),
        cumulative: Number(cumulative.toFixed(2)),
        revenue: isRevenue ? Number(o.totalAmount) : 0,
      };
    });

    const grouped = new Map<string, number>();
    for (const point of series) {
      grouped.set(point.date, (grouped.get(point.date) ?? 0) + point.revenue);
    }

    return {
      totalRevenue: cumulative.toFixed(2),
      series: [...grouped.entries()].map(([date, revenue]) => ({ date, revenue: revenue.toFixed(2) })),
      cumulative: series.filter((_, index) => index % Math.max(1, Math.ceil(series.length / 60)) === 0),
    };
  },
};

async function resolveRangeAsync(input: RangeInput) {
  const { from, to } = resolveRange(input);
  return { gte: from, lte: to };
}
