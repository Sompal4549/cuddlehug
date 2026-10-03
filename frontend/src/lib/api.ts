export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * When NEXT_PUBLIC_API_URL is empty the browser calls `/api/*` on its own
 * origin and Next.js proxies the request to the backend (see next.config.ts).
 * Set NEXT_PUBLIC_API_URL to talk to the backend directly (cross-origin).
 */
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function origin() {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
}

/** Absolute URL for an API path: `/products` -> `<origin>/api/products`. */
export function apiUrl(path: string): string {
  const suffix = `/api${path.startsWith("/") ? path : `/${path}`}`;
  return new URL(`${BASE}${suffix}`, origin()).toString();
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestOptions = {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry (used by auth calls themselves). */
  noRetry?: boolean;
};

type ApiEnvelope<T> = { success: boolean; data?: T; message?: string; code?: string; details?: unknown; meta?: Record<string, unknown> };

let refreshPromise: Promise<boolean> | null = null;

/** Single-flight refresh so parallel 401s only trigger one token rotation. */
async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(apiUrl("/auth/refresh"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const url = new URL(apiUrl(path));
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }

  const doFetch = () =>
    fetch(url.toString(), {
      method,
      credentials: "include",
      signal: options.signal,
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("Cannot reach the server. Check your connection.", 0, "NETWORK_ERROR");
  }

  if (res.status === 401 && !options.noRetry) {
    const refreshed = await refreshSession();
    if (refreshed) res = await doFetch();
  }

  if (res.status === 204) return { success: true, data: undefined as T };

  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!res.ok || !payload?.success) {
    throw new ApiError(
      payload?.message ?? `Request failed (${res.status})`,
      res.status,
      payload?.code ?? "REQUEST_FAILED",
      payload?.details,
    );
  }

  return payload;
}

export async function apiFetch<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  return (await request<T>(method, path, options)).data as T;
}

/** Same as `apiFetch` but also returns the envelope's `meta` (pagination info). */
export async function apiFetchFull<T>(
  method: Method,
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const payload = await request<T>(method, path, options);
  return { data: payload.data as T, meta: payload.meta };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>("GET", path, options),
  getFull: <T>(path: string, options?: RequestOptions) => apiFetchFull<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>("PATCH", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>("PUT", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>("DELETE", path, options),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}
