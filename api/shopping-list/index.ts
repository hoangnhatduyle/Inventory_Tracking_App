import { authedHandler, assertMethod } from '../_lib/handler.js';
import { ApiError } from '../_lib/errors.js';
import { parseBody } from '../_lib/validation.js';
import { shoppingItemCreate } from '../_lib/schemas.js';
import { toCamel, toCamelList, toSnake } from '../_lib/mappers.js';

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);

  if (method === 'GET') {
    const { data, error } = await client
      .from('shopping_list')
      .select('*')
      .order('is_purchased', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw new ApiError('INTERNAL', 'Failed to load shopping list', error);
    return toCamelList(data ?? []);
  }

  const body = parseBody(req, shoppingItemCreate);
  const row = toSnake({ ...body, userId: user.id });
  const { data, error } = await client
    .from('shopping_list')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new ApiError('INTERNAL', 'Failed to add shopping item', error);
  return toCamel(data);
});
