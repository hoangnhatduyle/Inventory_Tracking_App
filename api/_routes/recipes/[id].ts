import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { recipeUpdate } from '../../_lib/schemas.js';
import { toCamel, toSnake } from '../../_lib/mappers.js';

export default authedHandler(async ({ client }, req) => {
  const method = assertMethod(req, ['PATCH', 'DELETE']);
  const id = Number.parseInt(String(req.query.id ?? ''), 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid recipe id');
  }

  if (method === 'PATCH') {
    const body = parseBody(req, recipeUpdate);
    if (Object.keys(body).length === 0) {
      throw new ApiError('BAD_REQUEST', 'No fields to update');
    }
    const { data, error } = await client
      .from('recipes')
      .update(toSnake(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL', 'Failed to update recipe', error);
    if (!data) throw new ApiError('NOT_FOUND', 'Recipe not found');
    return toCamel(data);
  }

  const { error, count } = await client
    .from('recipes')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw new ApiError('INTERNAL', 'Failed to delete recipe', error);
  if (!count) throw new ApiError('NOT_FOUND', 'Recipe not found');
  return { deleted: true };
});
