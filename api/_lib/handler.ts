import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './cors.js';
import { withErrorHandler, ApiError } from './errors.js';
import { requireAuth, type AuthContext } from './supabase.js';

type AuthedHandler = (
  ctx: AuthContext,
  req: VercelRequest,
  res: VercelResponse,
) => Promise<unknown>;

// Compose CORS + auth + error envelope. Endpoints that need auth use this
// wrapper; public endpoints (none currently) would use withErrorHandler directly.
export function authedHandler(handler: AuthedHandler) {
  return withErrorHandler(async (req, res) => {
    if (applyCors(req, res)) return;
    const ctx = await requireAuth(req);
    return handler(ctx, req, res);
  });
}

export function assertMethod(
  req: VercelRequest,
  allowed: readonly string[],
): string {
  if (!req.method || !allowed.includes(req.method)) {
    throw new ApiError(
      'METHOD_NOT_ALLOWED',
      `Allowed methods: ${allowed.join(', ')}`,
    );
  }
  return req.method;
}
