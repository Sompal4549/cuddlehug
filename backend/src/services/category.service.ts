import { CategoryStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/errors";
import { uniqueSlug } from "../utils/slug";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validators/catalog.validator";

export type CreateCategoryDto = CreateCategoryInput;
export type UpdateCategoryDto = UpdateCategoryInput;

const categoryInclude = {
  _count: { select: { products: { where: { status: "ACTIVE" as const } }, children: true } },
} satisfies Prisma.CategoryInclude;

export const categoryService = {
  async listPublic() {
    const categories = await prisma.category.findMany({
      where: { status: "ACTIVE" },
      include: categoryInclude,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      sortOrder: c.sortOrder,
      productCount: c._count.products,
      childCount: c._count.children,
    }));
  },

  async listAdmin() {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true, children: true } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      status: c.status,
      sortOrder: c.sortOrder,
      parentId: c.parentId,
      parent: c.parent,
      productCount: c._count.products,
      childCount: c._count.children,
      updatedAt: c.updatedAt.toISOString(),
    }));
  },

  async getBySlug(slug: string) {
    const category = await prisma.category.findUnique({ where: { slug }, include: categoryInclude });
    if (!category || category.status !== "ACTIVE") throw AppError.notFound("Category not found");
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      productCount: category._count.products,
    };
  },

  async create(input: CreateCategoryDto) {
    const exists = await prisma.category.findUnique({ where: { slug: input.slug ?? input.name } });
    if (exists) throw AppError.conflict(`Category "${input.name}" already exists`);

    const slug = await uniqueSlug(input.slug ?? input.name, async (candidate) =>
      Boolean(await prisma.category.findUnique({ where: { slug: candidate } })),
    );

    if (input.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw AppError.notFound("Parent category not found");
    }

    return prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        image: input.image ?? null,
        status: input.status,
        sortOrder: input.sortOrder,
        parentId: input.parentId ?? null,
      },
      include: categoryInclude,
    });
  },

  async update(id: string, input: UpdateCategoryDto) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw AppError.notFound("Category not found");

    if (input.name && input.name !== category.name) {
      const conflict = await prisma.category.findFirst({ where: { name: input.name, id: { not: id } } });
      if (conflict) throw AppError.conflict(`Category "${input.name}" already exists`);
    }
    if (input.parentId && input.parentId === id) {
      throw AppError.badRequest("A category cannot be its own parent");
    }

    return prisma.category.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        image: input.image,
        status: input.status,
        sortOrder: input.sortOrder,
        parentId: input.parentId,
      },
      include: categoryInclude,
    });
  },

  async remove(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw AppError.notFound("Category not found");
    if (category._count.products > 0) {
      throw new AppError(
        `Cannot delete: ${category._count.products} product(s) still use this category`,
        409,
        "CONFLICT",
      );
    }
    if (category._count.children > 0) {
      throw new AppError("Cannot delete: this category has sub-categories", 409, "CONFLICT");
    }
    await prisma.category.delete({ where: { id } });
    return { deleted: true };
  },

  async reorder(entries: { id: string; sortOrder: number }[]) {
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.category.update({ where: { id: entry.id }, data: { sortOrder: entry.sortOrder } }),
      ),
    );
    return { updated: entries.length };
  },
};

export const CATEGORY_STATUS = CategoryStatus;
