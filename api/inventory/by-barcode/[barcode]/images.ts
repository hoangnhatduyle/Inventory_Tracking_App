import { authedHandler, assertMethod } from '../../../_lib/handler.js';
import { ApiError } from '../../../_lib/errors.js';
import { mapItemImageList } from '../../../_lib/mappers.js';

// GET /api/inventory/by-barcode/:barcode/images
// Returns item_images rows for inventory items owned by the caller that share
// the given barcode. Used by the item form to pre-fill a photo when re-scanning
// a product the user has added before.
export default authedHandler(async ({ client }, req) => {
  assertMethod(req, ['GET']);

  const raw = String(req.query.barcode ?? '').trim();
  if (!raw) {
    throw new ApiError('BAD_REQUEST', 'barcode is required');
  }

  const { data, error } = await client
    .from('inventory_items')
    .select('id, item_images(*)')
    .eq('barcode', raw)
    .order('id', { ascending: false });

  if (error) {
    throw new ApiError('INTERNAL', 'Failed to load barcode images', error);
  }

  const images = (data ?? []).flatMap((row) => {
    const nested = row.item_images;
    if (Array.isArray(nested)) return nested;
    return nested ? [nested] : [];
  });

  return mapItemImageList(images);
});
