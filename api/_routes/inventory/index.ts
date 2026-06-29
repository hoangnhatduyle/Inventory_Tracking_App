import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { inventoryItemCreate } from '../../_lib/schemas.js';
import { toCamel, toCamelList, toSnake } from '../../_lib/mappers.js';

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);

  if (method === 'GET') {
    const { data, error } = await client
      .from('inventory_items')
      .select('*')
      .order('expiration_date', { ascending: true });
    if (error) throw new ApiError('INTERNAL', 'Failed to load inventory', error);
    return toCamelList(data ?? []);
  }

  // POST
  const body = parseBody(req, inventoryItemCreate);
  const row = toSnake({ ...body, userId: user.id });

  const { data, error } = await client
    .from('inventory_items')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new ApiError('INTERNAL', 'Failed to create item', error);
  return toCamel(data);
});
