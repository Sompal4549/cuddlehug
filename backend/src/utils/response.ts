import type { Response } from "express";

export type Meta = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
};

export function success<T>(res: Response, data: T, meta?: Meta, status = 200) {
  return res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function created<T>(res: Response, data: T, meta?: Meta) {
  return success(res, data, meta, 201);
}

export function failure(res: Response, status: number, message: string, code: string, details?: unknown) {
  return res.status(status).json({
    success: false,
    message,
    code,
    ...(details !== undefined ? { details } : {}),
  });
}
