import { authedHandler, assertMethod } from '../../../_lib/handler.js';
import { ApiError } from '../../../_lib/errors.js';

// DELETE /api/inventory/images/:imageId
// Removes the row AND the underlying Storage object.
export default authedHandler(async ({ client }, req) => {
  assertMethod(req, ['DELETE']);
  const id = Number.parseInt(String(req.query.imageId ?? ''), 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid image id');
  }

  const row = await client
    .from('item_images')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (row.error) throw new ApiError('INTERNAL', 'Failed to look up image', row.error);
  if (!row.data) throw new ApiError('NOT_FOUND', 'Image not found');

  const del = await client.from('item_images').delete({ count: 'exact' }).eq('id', id);
  if (del.error) throw new ApiError('INTERNAL', 'Failed to delete image row', del.error);

  // Best-effort blob delete; row delete is the source of truth so we do not
  // unwind the row if storage fails (orphan blobs can be GC'd by a cron later).
  await client.storage
    .from('inventory-images')
    .remove([row.data.storage_path as string])
    .catch((err) => console.warn('[images] storage remove failed', err));

  return { deleted: true };
});
