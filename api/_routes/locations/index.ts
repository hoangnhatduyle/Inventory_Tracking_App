import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { locationCreate } from '../../_lib/schemas.js';
import { toCamel, toCamelList, toSnake } from '../../_lib/mappers.js';

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);

  if (method === 'GET') {
    const { data, error } = await client
      .from('locations')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw new ApiError('INTERNAL', 'Failed to load locations', error);
    return toCamelList(data ?? []);
  }

  const body = parseBody(req, locationCreate);
  const { data, error } = await client
    .from('locations')
    .insert(toSnake({ ...body, userId: user.id }))
    .select('*')
    .single();
  if (error) throw new ApiError('INTERNAL', 'Failed to create location', error);
  return toCamel(data);
});
