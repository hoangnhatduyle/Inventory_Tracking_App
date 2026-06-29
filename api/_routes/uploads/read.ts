import { z } from 'zod';
import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseQuery } from '../../_lib/validation.js';

// GET /api/uploads/read?path=<userId>/<scope>/<uuid>.<ext>
// Returns a short-lived signed READ URL the browser can use as an <img src>.
// Authorization is doubly enforced: the user JWT must match the path's first
// segment, AND Supabase Storage RLS will refuse if it doesn't.

const querySchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-z0-9-]+\/(items|receipts)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i),
  expiresIn: z.coerce.number().int().min(10).max(3600).optional().default(900),
});

export default authedHandler(async ({ user, client }, req) => {
  assertMethod(req, ['GET']);
  const parsed = parseQuery(req, querySchema);
  const path = parsed.path;
  const expiresIn = parsed.expiresIn ?? 900;

  if (path.split('/')[0] !== user.id) {
    throw new ApiError('FORBIDDEN', 'path does not belong to caller');
  }

  const { data, error } = await client.storage
    .from('inventory-images')
    .createSignedUrl(path, expiresIn);
  if (error || !data) {
    throw new ApiError('NOT_FOUND', 'Image not found');
  }
  return { url: data.signedUrl, expiresIn };
});
