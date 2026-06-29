import { z } from 'zod';
import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { mapItemImage, mapItemImageList, toSnake } from '../../_lib/mappers.js';

const createSchema = z.object({
  storagePath: z
    .string()
    .min(1)
    .max(500)
    .regex(/^[a-z0-9-]+\/(items|receipts)\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i),
  isPrimary: z.boolean().optional().default(false),
});

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);
  const itemId = Number.parseInt(String(req.query.id ?? ''), 10);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid item id');
  }

  if (method === 'GET') {
    const { data, error } = await client
      .from('item_images')
      .select('*')
      .eq('item_id', itemId)
      .order('is_primary', { ascending: false })
      .order('id', { ascending: true });
    if (error) throw new ApiError('INTERNAL', 'Failed to load images', error);
    return mapItemImageList(data ?? []);
  }

  const body = parseBody(req, createSchema);
  // Path must belong to caller (defence in depth on top of the storage RLS).
  if (body.storagePath.split('/')[0] !== user.id) {
    throw new ApiError('FORBIDDEN', 'storagePath does not belong to caller');
  }

  const { data, error } = await client
    .from('item_images')
    .insert(
      toSnake({
        itemId,
        userId: user.id,
        storagePath: body.storagePath,
        isPrimary: body.isPrimary,
      }),
    )
    .select('*')
    .single();
  if (error) throw new ApiError('INTERNAL', 'Failed to attach image', error);
  return mapItemImage(data);
});
