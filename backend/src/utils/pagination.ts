export type PaginationQuery = {
  page?: number;
  limit?: number;
};

export function normalizePagination(query: PaginationQuery | undefined, opts?: { maxLimit?: number }) {
  const maxLimit = opts?.maxLimit ?? 100;
  const page = Math.max(1, Math.floor(Number(query?.page) || 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query?.limit) || 12)));
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

export function buildMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
