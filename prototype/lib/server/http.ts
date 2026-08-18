/** Shared HTTP helpers for the API route handlers (contract "Konvensi"). */
import type { ApiError } from "../contract/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function err(code: string, message: string, details?: Record<string, unknown>): ApiError {
  return { error: { code, message, details } };
}

export function paginate<T>(arr: T[], page = 1, limit = 25) {
  const total = arr.length;
  const start = (page - 1) * limit;
  return { data: arr.slice(start, start + limit), meta: { page, limit, total } };
}

export const num = (v: string | undefined, dflt: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : dflt;
};
