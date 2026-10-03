import { z } from "zod";
import { ProductColor, ProductSize } from "@prisma/client";

export const idSchema = z.string().min(1).max(64);

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Invalid slug");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(160);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[0-9][0-9\s-]{7,15}$/, "Enter a valid phone number");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

/** Query-string list: `?sizes=SMALL,LARGE` */
export const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => item.parse(v))
        : undefined,
    );

export const productSizeSchema = z.nativeEnum(ProductSize);
export const productColorSchema = z.nativeEnum(ProductColor);

export const moneyInput = z
  .union([z.string(), z.number()])
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(String(v)), "Invalid amount");

export const imageUrlSchema = z.string().min(1).max(600);
