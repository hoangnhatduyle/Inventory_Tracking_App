import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { locationUpdate } from '../../_lib/schemas.js';
import { toCamel, toSnake } from '../../_lib/mappers.js';

export default authedHandler(async ({ client }, req) => {
  const method = assertMethod(req, ['PATCH', 'DELETE']);
  const id = Number.parseInt(String(req.query.id ?? ''), 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid location id');
  }

  if (method === 'PATCH') {
    const body = parseBody(req, locationUpdate);
    if (Object.keys(body).length === 0) {
      throw new ApiError('BAD_REQUEST', 'No fields to update');
    }
    const { data, error } = await client
      .from('locations')
      .update(toSnake(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL', 'Failed to update location', error);
    if (!data) throw new ApiError('NOT_FOUND', 'Location not found');
    return toCamel(data);
  }

  const { error, count } = await client
    .from('locations')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw new ApiError('INTERNAL', 'Failed to delete location', error);
  if (!count) throw new ApiError('NOT_FOUND', 'Location not found');
  return { deleted: true };
});
