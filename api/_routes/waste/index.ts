import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { wasteCreate } from '../../_lib/schemas.js';
import { toCamel, toCamelList, toSnake } from '../../_lib/mappers.js';

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);

  if (method === 'GET') {
    const { data, error } = await client
      .from('wasted_items')
      .select('*')
      .order('wasted_date', { ascending: false });
    if (error) throw new ApiError('INTERNAL', 'Failed to load waste log', error);
    return toCamelList(data ?? []);
  }

  // POST (ad-hoc waste entry not tied to an inventory item)
  const body = parseBody(req, wasteCreate);
  const row = toSnake({ ...body, userId: user.id });
  const { data, error } = await client
    .from('wasted_items')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new ApiError('INTERNAL', 'Failed to record waste', error);
  return toCamel(data);
});
