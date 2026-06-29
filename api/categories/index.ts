import { authedHandler, assertMethod } from '../_lib/handler.js';
import { ApiError } from '../_lib/errors.js';
import { parseBody } from '../_lib/validation.js';
import { categoryCreate } from '../_lib/schemas.js';
import { toCamel, toCamelList, toSnake } from '../_lib/mappers.js';

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);

  if (method === 'GET') {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw new ApiError('INTERNAL', 'Failed to load categories', error);
    return toCamelList(data ?? []);
  }

  const body = parseBody(req, categoryCreate);
  const { data, error } = await client
    .from('categories')
    .insert(
      toSnake({
        ...body,
        userId: user.id,
        isSystem: false,
      }),
    )
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new ApiError('CONFLICT', 'A category with that name already exists');
    }
    throw new ApiError('INTERNAL', 'Failed to create category', error);
  }
  return toCamel(data);
});
