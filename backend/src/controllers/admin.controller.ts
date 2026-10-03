import { asyncHandler } from "../utils/asyncHandler";
import { created, success } from "../utils/response";
import { adminService } from "../services/admin.service";
import { reportService } from "../services/report.service";
import { adjustStock } from "../services/inventory.service";
import {
  countUsages,
  createCoupon,
  deactivateCoupon,
  listCoupons,
  removeCoupon,
  updateCoupon,
} from "../services/coupon.service";
import { productService } from "../services/product.service";
import { getSettings, publicSettings, updateSettings } from "../services/settings.service";
import { deleteImage, uploadImage } from "../services/upload.service";
import { uploadMiddleware } from "../middleware/upload";
import { paginationSchema, reportQuerySchema, inventoryAdjustSchema, createCouponSchema, updateCouponSchema, settingsSchema } from "../validators/commerce.validator";
import { AppError } from "../utils/errors";
import { z } from "zod";
import type { RequestHandler } from "express";

const listQuery = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
});

export const adminController = {
  dashboard: asyncHandler(async (req, res) => {
    const query = reportQuerySchema.parse(req.query);
    const data = await adminService.dashboard(query);
    success(res, data);
  }),

  // ---- customers -------------------------------------------------------
  customers: asyncHandler(async (req, res) => {
    const query = listQuery.extend({ status: z.enum(["ACTIVE", "BLOCKED"]).optional() }).parse(req.query);
    const result = await adminService.customers(query);
    success(res, { items: result.items }, result.meta);
  }),

  setCustomerStatus: asyncHandler(async (req, res) => {
    const body = z.object({ status: z.enum(["ACTIVE", "BLOCKED"]) }).parse(req.body);
    const result = await adminService.setCustomerStatus((req.params.id as string), body.status);
    success(res, result);
  }),

  // ---- inventory -------------------------------------------------------
  inventory: asyncHandler(async (req, res) => {
    const query = listQuery
      .extend({ lowOnly: z.coerce.boolean().optional().default(false) })
      .parse(req.query);
    const result = await reportService.inventory(query);
    success(res, { items: result.items, summary: result.summary }, {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / query.limit)),
    });
  }),

  inventoryTransactions: asyncHandler(async (req, res) => {
    const query = listQuery
      .extend({
        variantId: z.string().optional(),
        type: z.enum(["STOCK_ADDED", "STOCK_REMOVED", "ORDER_RESERVATION", "ORDER_CANCELLATION", "RETURN", "MANUAL_ADJUSTMENT"]).optional(),
      })
      .parse(req.query);
    const result = await reportService.inventoryTransactions(query);
    success(res, { items: result.items }, result.meta);
  }),

  adjustInventory: asyncHandler(async (req, res) => {
    const input = inventoryAdjustSchema.parse(req.body);
    const result = await adjustStock({ ...input, actorId: req.user!.id });
    success(res, result);
  }),

  // ---- coupons ---------------------------------------------------------
  coupons: asyncHandler(async (req, res) => {
    const query = listQuery.extend({ active: z.coerce.boolean().optional() }).parse(req.query);
    const result = await listCoupons(query);
    success(res, { items: result.items.map(couponDto) }, {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / query.limit)),
    });
  }),

  createCoupon: asyncHandler(async (req, res) => {
    const input = createCouponSchema.parse(req.body);
    const coupon = await createCoupon(input);
    created(res, couponDto(coupon));
  }),

  updateCoupon: asyncHandler(async (req, res) => {
    const input = updateCouponSchema.parse(req.body);
    const coupon = await updateCoupon((req.params.id as string), input);
    success(res, couponDto(coupon));
  }),

  deleteCoupon: asyncHandler(async (req, res) => {
    const usages = await countUsages((req.params.id as string));
    if (usages > 0) {
      // Never delete data that historic orders reference - deactivate instead.
      const coupon = await deactivateCoupon((req.params.id as string));
      success(res, { deactivated: true, coupon: couponDto(coupon) });
      return;
    }
    const result = await removeCoupon((req.params.id as string));
    success(res, result);
  }),

  // ---- reports ---------------------------------------------------------
  reportSales: asyncHandler(async (req, res) => {
    const query = reportQuerySchema.parse(req.query);
    success(res, await reportService.sales(query));
  }),

  reportOrders: asyncHandler(async (req, res) => {
    const query = reportQuerySchema.parse(req.query);
    success(res, await reportService.orders(query));
  }),

  reportProducts: asyncHandler(async (req, res) => {
    const query = reportQuerySchema
      .extend({ categoryId: z.string().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
      .parse(req.query);
    const result = await reportService.products(query);
    success(res, { items: result.items }, { total: result.total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(result.total / query.limit)) });
  }),

  reportInventory: asyncHandler(async (req, res) => {
    const query = reportQuerySchema.extend({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), search: z.string().optional(), lowOnly: z.coerce.boolean().optional().default(false) }).parse(req.query);
    const result = await reportService.inventory(query);
    success(res, { items: result.items, summary: result.summary }, { total: result.total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(result.total / query.limit)) });
  }),

  reportCustomers: asyncHandler(async (req, res) => {
    const query = reportQuerySchema.parse(req.query);
    success(res, { items: await reportService.customers(query) });
  }),

  reportCoupons: asyncHandler(async (req, res) => {
    const query = reportQuerySchema.parse(req.query);
    success(res, { items: await reportService.coupons(query) });
  }),

  reportRevenue: asyncHandler(async (req, res) => {
    const query = reportQuerySchema.parse(req.query);
    success(res, await reportService.revenue(query));
  }),

  // ---- settings --------------------------------------------------------
  getSettings: asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    success(res, publicSettings(settings));
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const input = settingsSchema.parse(req.body);
    const settings = await updateSettings(input);
    success(res, publicSettings(settings));
  }),

  // ---- audit -----------------------------------------------------------
  auditLogs: asyncHandler(async (req, res) => {
    const query = listQuery.extend({ entity: z.string().max(60).optional(), userId: z.string().optional() }).parse(req.query);
    const result = await adminService.auditLogs(query);
    success(res, { items: result.items }, result.meta);
  }),

  // ---- image uploads ---------------------------------------------------
  uploadImage: asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("No image file provided");
    const result = await uploadImage(req.file, { folder: "cuddlehug/admin" });
    created(res, result);
  }),

  deleteUpload: asyncHandler(async (req, res) => {
    const body = z.object({ url: z.string().min(1).max(600) }).parse(req.body);
    await deleteImage(body.url);
    success(res, { deleted: true });
  }),

  // ---- quick admin helpers -------------------------------------------
  relatedProducts: asyncHandler(async (req, res) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(24).default(6) }).parse(req.query);
    const items = await productService.bestSellers(query.limit);
    success(res, { items });
  }),
};

export const uploadSingle: RequestHandler = (req, res, next) => {
  uploadMiddleware.single("image")(req, res, (error: unknown) => {
    if (error) {
      next(AppError.badRequest(error instanceof Error ? error.message : "Upload failed"));
      return;
    }
    next();
  });
};

function couponDto(coupon: {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: { toString(): string };
  minOrderAmount: { toString(): string };
  maxDiscount: { toString(): string } | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  active: boolean;
  products?: unknown[];
  variants?: unknown[];
}) {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    value: coupon.value.toString(),
    minOrderAmount: coupon.minOrderAmount.toString(),
    maxDiscount: coupon.maxDiscount ? coupon.maxDiscount.toString() : null,
    startsAt: coupon.startsAt.toISOString(),
    endsAt: coupon.endsAt.toISOString(),
    usageLimit: coupon.usageLimit,
    perUserLimit: coupon.perUserLimit,
    usedCount: coupon.usedCount,
    active: coupon.active,
    restrictions: {
      products: (coupon.products ?? []).length,
      variants: (coupon.variants ?? []).length,
    },
  };
}


