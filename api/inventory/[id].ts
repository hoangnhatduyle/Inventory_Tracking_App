import { authedHandler, assertMethod } from '../_lib/handler.js';
import { ApiError } from '../_lib/errors.js';
import { parseBody } from '../_lib/validation.js';
import { inventoryItemUpdate } from '../_lib/schemas.js';
import { toCamel, toSnake } from '../_lib/mappers.js';

export default authedHandler(async ({ client }, req) => {
  const method = assertMethod(req, ['GET', 'PATCH', 'DELETE']);
  const id = Number.parseInt(String(req.query.id ?? ''), 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid item id');
  }

  if (method === 'GET') {
    const { data, error } = await client
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL', 'Failed to load item', error);
    if (!data) throw new ApiError('NOT_FOUND', 'Item not found');
    return toCamel(data);
  }

  if (method === 'PATCH') {
    const body = parseBody(req, inventoryItemUpdate);
    if (Object.keys(body).length === 0) {
      throw new ApiError('BAD_REQUEST', 'No fields to update');
    }
    const patch = toSnake(body);
    const { data, error } = await client
      .from('inventory_items')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL', 'Failed to update item', error);
    if (!data) throw new ApiError('NOT_FOUND', 'Item not found');
    return toCamel(data);
  }

  // DELETE
  const { error, count } = await client
    .from('inventory_items')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw new ApiError('INTERNAL', 'Failed to delete item', error);
  if (!count) throw new ApiError('NOT_FOUND', 'Item not found');
  return { deleted: true };
});
