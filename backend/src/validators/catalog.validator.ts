import { z } from "zod";
import { CategoryStatus, ProductStatus } from "@prisma/client";
import { idSchema, imageUrlSchema, moneyInput, slugSchema } from "./common";

export const createAddressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Home"),
  fullName: z.string().trim().min(3).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9][0-9\s-]{7,15}$/, "Enter a valid phone number"),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid pincode"),
  country: z.string().trim().min(2).max(60).default("India"),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial().extend({
  id: idSchema.optional(),
});

export const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  availability: z.enum(["all", "in_stock", "out_of_stock"]).default("all"),
  sort: z
    .enum(["relevance", "price_asc", "price_desc", "newest", "rating", "bestselling", "discount"])
    .default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  featured: z.coerce.boolean().optional(),
  bestSeller: z.coerce.boolean().optional(),
  newArrival: z.coerce.boolean().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: slugSchema.optional(),
  description: z.string().trim().max(600).optional().nullable(),
  image: imageUrlSchema.optional().nullable(),
  status: z.nativeEnum(CategoryStatus).default("ACTIVE"),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  parentId: idSchema.optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

const imageSchema = z.object({
  id: idSchema.optional(),
  url: imageUrlSchema,
  alt: z.string().trim().max(160).optional().nullable(),
  position: z.number().int().min(0).max(50).default(0),
  isPrimary: z.boolean().default(false),
});

const variantSchema = z.object({
  id: idSchema.optional(),
  size: z.enum(["MINI", "SMALL", "MEDIUM", "LARGE", "GIANT"]).default("MEDIUM"),
  color: z.enum(["BROWN", "PINK", "WHITE", "CREAM", "RED"]).default("BROWN"),
  sku: z.string().trim().min(3).max(60),
  mrp: moneyInput,
  price: moneyInput,
  isActive: z.boolean().default(true),
  stock: z.number().int().min(0).max(100000).optional(),
  lowStockThreshold: z.number().int().min(0).max(10000).optional(),
});

const productBase = z.object({
    name: z.string().trim().min(3).max(140),
    sku: z.string().trim().min(3).max(60),
    categoryId: idSchema,
    shortDescription: z.string().trim().max(300).optional().nullable(),
    description: z.string().trim().min(10).max(8000),
    mrp: moneyInput,
    price: moneyInput,
    discountPercent: z.number().int().min(0).max(100).default(0),
    status: z.nativeEnum(ProductStatus).default("DRAFT"),
    material: z.string().trim().max(200).optional().nullable(),
    filling: z.string().trim().max(200).optional().nullable(),
    weightGrams: z.number().int().min(0).max(20000).optional().nullable(),
    careInstructions: z.string().trim().max(600).optional().nullable(),
    ageRecommendation: z.string().trim().max(120).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
    isFeatured: z.boolean().default(false),
    isBestSeller: z.boolean().default(false),
    isNewArrival: z.boolean().default(false),
    lowStockThreshold: z.number().int().min(0).max(10000).default(5),
    images: z.array(imageSchema).max(12).default([]),
    variants: z.array(variantSchema).min(1).max(40),
  });

export const createProductSchema = productBase.refine((p) => Number(p.price) <= Number(p.mrp), {
  message: "Selling price cannot be higher than MRP",
  path: ["price"],
});

export const updateProductSchema = productBase.partial().extend({
  images: z.array(imageSchema).max(12).optional(),
  variants: z.array(variantSchema).min(1).max(40).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
