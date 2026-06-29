import { authedHandler, assertMethod } from '../../../../_lib/handler.js';
import { ApiError } from '../../../../_lib/errors.js';
import { parseBody } from '../../../../_lib/validation.js';
import { batchCreate } from '../../../../_lib/schemas.js';
import { toCamel, toCamelList, toSnake } from '../../../../_lib/mappers.js';

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST', 'DELETE']);
  const itemId = Number.parseInt(String(req.query.id ?? ''), 10);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid item id');
  }

  if (method === 'GET') {
    const { data, error } = await client
      .from('inventory_batches')
      .select('*')
      .eq('item_id', itemId)
      .order('expiration_date', { ascending: true, nullsFirst: false });
    if (error) throw new ApiError('INTERNAL', 'Failed to load batches', error);
    return toCamelList(data ?? []);
  }

  if (method === 'POST') {
    const body = parseBody(req, batchCreate.omit({ itemId: true }));
    const row = toSnake({ ...body, itemId, userId: user.id });
    const { data, error } = await client
      .from('inventory_batches')
      .insert(row)
      .select('*')
      .single();
    if (error) throw new ApiError('INTERNAL', 'Failed to add batch', error);
    return toCamel(data);
  }

  // DELETE - removes ALL batches for the item (cascade on item delete will
  // handle this normally; this method exists for explicit "reset batches" flows)
  const { error, count } = await client
    .from('inventory_batches')
    .delete({ count: 'exact' })
    .eq('item_id', itemId);
  if (error) throw new ApiError('INTERNAL', 'Failed to delete batches', error);
  return { deleted: count ?? 0 };
});
