import { Prisma, ProductColor, ProductSize } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { toMinor } from "../utils/money";
import { available } from "./inventory.service";
import { getSettings } from "./settings.service";
import { computePricing, pricingToDto, type PricingLine } from "./pricing";
import { toPricingCoupon, validateCoupon, type ValidatedCoupon } from "./coupon.service";

type Db = Prisma.TransactionClient | PrismaClient;
type PrismaClient = typeof prisma;

export const MAX_QTY_PER_LINE = 10;

export type CartLineRow = {
  id: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    size: ProductSize;
    color: ProductColor;
    sku: string;
    price: Prisma.Decimal;
    mrp: Prisma.Decimal;
    isActive: boolean;
    inventory: { quantity: number; reserved: number } | null;
    product: {
      id: string;
      name: string;
      slug: string;
      status: string;
      images: { url: string; position: number; isPrimary: boolean }[];
    };
  };
};

async function loadLines(client: Db, cartId: string): Promise<CartLineRow[]> {
  return client.cartItem.findMany({
    where: { cartId },
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          inventory: true,
          product: { include: { images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] } } },
        },
      },
    },
  });
}

function lineImage(row: CartLineRow): string | null {
  return row.variant.product.images[0]?.url ?? null;
}

export async function resolveCart(params: { userId?: string; sessionId?: string }) {
  if (params.userId) {
    const existing = await prisma.cart.findUnique({ where: { userId: params.userId } });
    if (existing) return existing;
    return prisma.cart.create({ data: { userId: params.userId, sessionId: params.sessionId ?? null } });
  }
  if (params.sessionId) {
    const existing = await prisma.cart.findUnique({ where: { sessionId: params.sessionId } });
    if (existing) return existing;
    return prisma.cart.create({ data: { sessionId: params.sessionId } });
  }
  throw AppError.badRequest("Unable to resolve cart");
}

export async function mergeCarts(params: { sessionId?: string; userId: string }) {
  if (!params.sessionId) return;
  const [guestCart, userCart] = await Promise.all([
    prisma.cart.findUnique({ where: { sessionId: params.sessionId } }),
    prisma.cart.findUnique({ where: { userId: params.userId } }),
  ]);
  if (!guestCart || guestCart.id === userCart?.id) return;

  if (!userCart) {
    await prisma.cart.update({
      where: { id: guestCart.id },
      data: { userId: params.userId, sessionId: null, couponCode: guestCart.couponCode },
    });
    return;
  }

  const guestItems = await loadLines(prisma, guestCart.id);
  for (const item of guestItems) {
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
    });
    const quantity = Math.min(
      MAX_QTY_PER_LINE,
      (existing?.quantity ?? 0) + item.quantity,
    );
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
      create: { cartId: userCart.id, variantId: item.variantId, quantity },
      update: { quantity },
    });
  }
  await prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => undefined);
}

export async function buildCartDto(cart: { id: string; couponCode: string | null }, userId: string | null) {
  const rows = await loadLines(prisma, cart.id);
  const settings = await getSettings();

  const items = rows
    .filter((row) => row.variant.isActive && row.variant.product.status !== "ARCHIVED")
    .map((row) => {
      const stock = row.variant.inventory ? available(row.variant.inventory) : 0;
      return {
        id: row.id,
        variantId: row.variantId,
        quantity: row.quantity,
        maxQuantity: Math.min(MAX_QTY_PER_LINE, stock),
        inStock: stock > 0,
        available: stock,
        product: {
          id: row.variant.product.id,
          name: row.variant.product.name,
          slug: row.variant.product.slug,
          image: lineImage(row),
          status: row.variant.product.status,
        },
        variant: {
          id: row.variant.id,
          size: row.variant.size,
          color: row.variant.color,
          sku: row.variant.sku,
          price: row.variant.price.toString(),
          mrp: row.variant.mrp.toString(),
        },
      };
    });

  const pricingLines: PricingLine[] = rows.map((row) => ({
    variantId: row.variantId,
    unitPrice: row.variant.price.toString(),
    mrp: row.variant.mrp.toString(),
    quantity: row.quantity,
  }));

  let coupon: ValidatedCoupon | null = null;
  if (cart.couponCode) {
    try {
      coupon = await validateCoupon({
        code: cart.couponCode,
        userId,
        subtotalMinor: pricingLines.reduce(
          (acc, l) => acc + toMinor(l.unitPrice) * BigInt(l.quantity),
          0n,
        ),
        variantIds: pricingLines.map((l) => l.variantId),
      });
    } catch {
      // Expired / now invalid coupon -> drop it so checkout never fails silently
      await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
      coupon = null;
    }
  }

  const pricing = computePricing({
    lines: pricingLines,
    coupon: coupon ? toPricingCoupon(coupon) : null,
    settings,
    couponCode: coupon?.code,
  });

  return {
    id: cart.id,
    itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
    items,
    coupon: coupon
      ? {
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value,
          discount: pricingToDto(pricing).couponDiscount,
        }
      : null,
    summary: pricingToDto(pricing),
  };
}

export type CartDto = Awaited<ReturnType<typeof buildCartDto>>;

export async function getCart(userId?: string, sessionId?: string) {
  const cart = await resolveCart({ userId, sessionId });
  return buildCartDto(cart, userId ?? null);
}

export async function addToCart(params: { userId?: string; sessionId?: string; variantId: string; quantity: number }) {
  const cart = await resolveCart({ userId: params.userId, sessionId: params.sessionId });

  const variant = await prisma.productVariant.findUnique({
    where: { id: params.variantId },
    include: { inventory: true, product: true },
  });
  if (!variant || !variant.isActive) throw AppError.notFound("Product option not found");
  if (variant.product.status !== "ACTIVE")
    throw AppError.badRequest("This product is not available for purchase", "BAD_REQUEST");

  const stock = variant.inventory ? available(variant.inventory) : 0;
  if (stock <= 0) throw new AppError("Product is out of stock", 409, "OUT_OF_STOCK");

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: params.variantId } },
  });
  const nextQuantity = Math.min(MAX_QTY_PER_LINE, (existing?.quantity ?? 0) + params.quantity);
  if (nextQuantity > stock) {
    throw new AppError(`Only ${stock} left in stock`, 409, "OUT_OF_STOCK", { available: stock });
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: params.variantId } },
    create: { cartId: cart.id, variantId: params.variantId, quantity: nextQuantity },
    update: { quantity: nextQuantity },
  });

  return getCart(params.userId, params.sessionId);
}

export async function updateCartItem(params: {
  userId?: string;
  sessionId?: string;
  variantId: string;
  quantity: number;
}) {
  const cart = await resolveCart({ userId: params.userId, sessionId: params.sessionId });

  if (params.quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId: params.variantId } });
    return getCart(params.userId, params.sessionId);
  }

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: params.variantId } },
  });
  if (!existing) throw AppError.notFound("Item not found in cart");

  const variant = await prisma.productVariant.findUnique({
    where: { id: params.variantId },
    include: { inventory: true },
  });
  const stock = variant?.inventory ? available(variant.inventory) : 0;
  if (params.quantity > stock) {
    throw new AppError(`Only ${stock} left in stock`, 409, "OUT_OF_STOCK", { available: stock });
  }

  await prisma.cartItem.update({
    where: { id: existing.id },
    data: { quantity: params.quantity },
  });
  return getCart(params.userId, params.sessionId);
}

export async function removeCartItem(params: { userId?: string; sessionId?: string; itemId: string }) {
  const cart = await resolveCart({ userId: params.userId, sessionId: params.sessionId });
  await prisma.cartItem.deleteMany({ where: { id: params.itemId, cartId: cart.id } });
  return getCart(params.userId, params.sessionId);
}

export async function applyCouponToCart(params: {
  userId?: string;
  sessionId?: string;
  code: string;
}) {
  const cart = await resolveCart({ userId: params.userId, sessionId: params.sessionId });
  const lines = await loadLines(prisma, cart.id);
  if (lines.length === 0) throw new AppError("Your cart is empty", 400, "CART_EMPTY");

  const subtotal = lines.reduce((acc, l) => acc + toMinor(l.variant.price) * BigInt(l.quantity), 0n);
  await validateCoupon({
    code: params.code,
    userId: params.userId ?? null,
    subtotalMinor: subtotal,
    variantIds: lines.map((l) => l.variantId),
  });

  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: params.code.toUpperCase() } });
  return getCart(params.userId, params.sessionId);
}

export async function removeCouponFromCart(params: { userId?: string; sessionId?: string }) {
  const cart = await resolveCart({ userId: params.userId, sessionId: params.sessionId });
  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
  return getCart(params.userId, params.sessionId);
}

export async function clearCartItems(cartId: string, client: Db = prisma) {
  await client.cartItem.deleteMany({ where: { cartId } });
  await client.cart.update({ where: { id: cartId }, data: { couponCode: null } });
}

export { loadLines };
