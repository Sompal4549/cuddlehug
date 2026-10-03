import { InventoryTransactionType, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";

type Tx = Prisma.TransactionClient;

export const available = (inventory: { quantity: number; reserved: number }) =>
  Math.max(0, inventory.quantity - inventory.reserved);

/** Locks inventory rows for the duration of a transaction (prevents oversell). */
export async function lockInventory(tx: Tx, variantIds: string[]): Promise<void> {
  if (variantIds.length === 0) return;
  await tx.$queryRaw`SELECT "id" FROM "Inventory" WHERE "variantId" IN (${Prisma.join(variantIds)}) FOR UPDATE`;
}

export async function assertStock(
  tx: Tx,
  variantId: string,
  quantity: number,
): Promise<{ quantity: number; reserved: number }> {
  const inventory = await tx.inventory.findUnique({ where: { variantId } });
  if (!inventory) throw new AppError("Product variant not found", 404, "NOT_FOUND");
  const avail = available(inventory);
  if (avail < quantity) {
    throw new AppError(
      `Only ${avail} left in stock`,
      409,
      "OUT_OF_STOCK",
      { available: avail, requested: quantity },
    );
  }
  return inventory;
}

/** Reserves stock when an order is placed (does not decrement on hand qty). */
export async function reserveStock(
  tx: Tx,
  variantId: string,
  quantity: number,
  referenceId: string,
  actorId?: string | null,
): Promise<void> {
  const inventory = await assertStock(tx, variantId, quantity);
  await tx.inventory.update({
    where: { variantId },
    data: { reserved: inventory.reserved + quantity },
  });
  await tx.inventoryTransaction.create({
    data: {
      variantId,
      type: InventoryTransactionType.ORDER_RESERVATION,
      quantity,
      delta: 0,
      referenceId,
      note: `Reserved ${quantity} for order`,
      actorId: actorId ?? null,
    },
  });
}

/**
 * Converts a reservation into an actual stock deduction when an order is
 * confirmed (payment captured / COD confirmed). Idempotent by design: callers
 * must only invoke it when transitioning an order into CONFIRMED.
 */
export async function confirmStock(tx: Tx, variantId: string, quantity: number, referenceId: string) {
  const inventory = await tx.inventory.findUnique({ where: { variantId } });
  if (!inventory) throw new AppError("Inventory record missing", 500, "INTERNAL_ERROR");
  const reserved = Math.max(0, inventory.reserved - quantity);
  const quantityNew = Math.max(0, inventory.quantity - quantity);
  await tx.inventory.update({ where: { variantId }, data: { reserved, quantity: quantityNew } });
  await tx.inventoryTransaction.create({
    data: {
      variantId,
      type: InventoryTransactionType.STOCK_REMOVED,
      quantity,
      delta: -quantity,
      referenceId,
      note: `Confirmed/fulfilled ${quantity} units`,
    },
  });
}

/**
 * Releases a reservation (order cancelled before payment) or restocks goods
 * (order cancelled/returned after payment).
 */
export async function releaseStock(
  tx: Tx,
  variantId: string,
  quantity: number,
  referenceId: string,
  alreadyDeducted: boolean,
) {
  const inventory = await tx.inventory.findUnique({ where: { variantId } });
  if (!inventory) return;

  if (alreadyDeducted) {
    await tx.inventory.update({
      where: { variantId },
      data: { quantity: inventory.quantity + quantity },
    });
    await tx.inventoryTransaction.create({
      data: {
        variantId,
        type: InventoryTransactionType.RETURN,
        quantity,
        delta: quantity,
        referenceId,
        note: `Restocked ${quantity} units`,
      },
    });
  } else {
    await tx.inventory.update({
      where: { variantId },
      data: { reserved: Math.max(0, inventory.reserved - quantity) },
    });
    await tx.inventoryTransaction.create({
      data: {
        variantId,
        type: InventoryTransactionType.ORDER_CANCELLATION,
        quantity,
        delta: 0,
        referenceId,
        note: `Released reservation of ${quantity} units`,
      },
    });
  }
}

/** Admin stock adjustment (add / remove / manual / return). */
export async function adjustStock(params: {
  variantId: string;
  type: InventoryTransactionType;
  quantity: number;
  note?: string | null;
  actorId: string;
}) {
  const { variantId, type, quantity, note, actorId } = params;

  return prisma.$transaction(async (tx) => {
    await lockInventory(tx, [variantId]);
    const inventory = await tx.inventory.findUnique({ where: { variantId } });
    if (!inventory) throw new AppError("Inventory record not found", 404, "NOT_FOUND");

    let nextQuantity = inventory.quantity;
    let delta = 0;

    switch (type) {
      case "STOCK_ADDED":
      case "RETURN":
        delta = quantity;
        nextQuantity = inventory.quantity + quantity;
        break;
      case "STOCK_REMOVED":
        delta = -quantity;
        nextQuantity = inventory.quantity - quantity;
        if (nextQuantity < inventory.reserved) {
          throw new AppError(
            "Cannot remove that many units - stock is reserved for open orders",
            409,
            "INVALID_STATE",
          );
        }
        if (nextQuantity < 0) throw new AppError("Stock cannot go negative", 409, "OUT_OF_STOCK");
        break;
      case "MANUAL_ADJUSTMENT":
        nextQuantity = quantity;
        delta = nextQuantity - inventory.quantity;
        break;
      default:
        throw new AppError("Unsupported transaction type", 400, "BAD_REQUEST");
    }

    if (nextQuantity < 0) throw new AppError("Stock cannot go negative", 409, "OUT_OF_STOCK");

    await tx.inventory.update({ where: { variantId }, data: { quantity: nextQuantity } });
    await tx.inventoryTransaction.create({
      data: {
        variantId,
        type,
        quantity,
        delta,
        note: note ?? null,
        actorId,
      },
    });

    return tx.inventory.findUnique({ where: { variantId }, include: { variant: true } });
  },{ timeout: 20000, maxWait: 5000 });
}
