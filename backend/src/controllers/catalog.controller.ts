import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { created, success } from "../utils/response";
import { productService } from "../services/product.service";
import { categoryService } from "../services/category.service";
import { reviewService } from "../services/review.service";
import {
  createCategorySchema,
  createProductSchema,
  listQuerySchema,
  updateCategorySchema,
  updateProductSchema,
} from "../validators/catalog.validator";
import { createReviewSchema, moderateReviewSchema, paginationSchema } from "../validators/commerce.validator";
import { z } from "zod";
import { ReviewStatus } from "@prisma/client";

export const productController = {
  list: asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const isAdminRequest = req.user?.role === "ADMIN" && req.query.admin === "true";
    const result = await productService.list(query, { publicOnly: !isAdminRequest });
    success(res, { items: result.items }, result.meta);
  }),

  related: asyncHandler(async (req, res) => {
    const slug = req.params.slug as string;
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true, categoryId: true } });
    if (!product) throw AppError.notFound("Product not found");
    const query = z.object({ limit: z.coerce.number().int().min(1).max(12).default(6) }).parse(req.query);
    const items = await productService.related(product.id, product.categoryId, query.limit);
    success(res, { items });
  }),

  featured: asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 8;
    const items = await productService.featured(limit);
    success(res, { items });
  }),

  bestSellers: asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 8;
    const items = await productService.bestSellers(limit);
    success(res, { items });
  }),

  newArrivals: asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 8;
    const items = await productService.newArrivals(limit);
    success(res, { items });
  }),

  getBySlug: asyncHandler(async (req, res) => {
    const product = await productService.getBySlug((req.params.slug as string));
    success(res, product);
  }),

  adminGet: asyncHandler(async (req, res) => {
    const product = await productService.adminGet((req.params.id as string));
    success(res, product);
  }),

  create: asyncHandler(async (req, res) => {
    const input = createProductSchema.parse(req.body);
    const product = await productService.create(input);
    created(res, product);
  }),

  update: asyncHandler(async (req, res) => {
    const input = updateProductSchema.parse(req.body);
    const product = await productService.update((req.params.id as string), input);
    success(res, product);
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await productService.remove((req.params.id as string));
    success(res, result);
  }),

  toggleStatus: asyncHandler(async (req, res) => {
    const body = z.object({ status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]) }).parse(req.body);
    const product = await productService.togglePublish((req.params.id as string), body.status);
    success(res, product);
  }),
};

export const categoryController = {
  listPublic: asyncHandler(async (_req, res) => {
    const items = await categoryService.listPublic();
    success(res, { items });
  }),

  listAdmin: asyncHandler(async (_req, res) => {
    const items = await categoryService.listAdmin();
    success(res, { items });
  }),

  getBySlug: asyncHandler(async (req, res) => {
    const category = await categoryService.getBySlug((req.params.slug as string));
    success(res, category);
  }),

  create: asyncHandler(async (req, res) => {
    const input = createCategorySchema.parse(req.body);
    const category = await categoryService.create(input);
    created(res, category);
  }),

  update: asyncHandler(async (req, res) => {
    const input = updateCategorySchema.parse(req.body);
    const category = await categoryService.update((req.params.id as string), input);
    success(res, category);
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await categoryService.remove((req.params.id as string));
    success(res, result);
  }),

  reorder: asyncHandler(async (req, res) => {
    const body = z
      .object({ entries: z.array(z.object({ id: z.string().min(1), sortOrder: z.number().int().min(0) })).min(1) })
      .parse(req.body);
    const result = await categoryService.reorder(body.entries);
    success(res, result);
  }),
};

export const reviewController = {
  listForProduct: asyncHandler(async (req, res) => {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await reviewService.listForProduct((req.params.productId as string), page, limit);
    success(res, { items: result.items, distribution: result.distribution }, result.meta);
  }),

  create: asyncHandler(async (req, res) => {
    const input = createReviewSchema.parse(req.body);
    const result = await reviewService.create(req.user!.id, input);
    created(res, result);
  }),

  listMine: asyncHandler(async (req, res) => {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await reviewService.listMine(req.user!.id, page, limit);
    success(res, { items: result.items }, result.meta);
  }),

  adminList: asyncHandler(async (req, res) => {
    const query = paginationSchema
      .extend({
        status: z.nativeEnum(ReviewStatus).optional(),
        search: z.string().trim().max(120).optional(),
        productId: z.string().optional(),
      })
      .parse(req.query);
    const result = await reviewService.listAdmin({
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
      productId: query.productId,
    });
    success(res, { items: result.items }, result.meta);
  }),

  moderate: asyncHandler(async (req, res) => {
    const input = moderateReviewSchema.parse(req.body);
    const review = await reviewService.moderate((req.params.id as string), input.status);
    success(res, review);
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await reviewService.remove((req.params.id as string));
    success(res, result);
  }),
};

