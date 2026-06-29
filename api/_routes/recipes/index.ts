import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { recipeCreate } from '../../_lib/schemas.js';
import { toCamel, toCamelList, toSnake } from '../../_lib/mappers.js';

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);

  if (method === 'GET') {
    const { data, error } = await client
      .from('recipes')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw new ApiError('INTERNAL', 'Failed to load recipes', error);
    return toCamelList(data ?? []);
  }

  const body = parseBody(req, recipeCreate);
  const { data, error } = await client
    .from('recipes')
    .upsert(toSnake({ ...body, userId: user.id }), { onConflict: 'user_id,name' })
    .select('*')
    .single();
  if (error) throw new ApiError('INTERNAL', 'Failed to save recipe', error);
  return toCamel(data);
});
