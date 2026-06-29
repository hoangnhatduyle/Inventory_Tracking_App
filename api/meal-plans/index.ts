import { z } from 'zod';
import { authedHandler, assertMethod } from '../_lib/handler.js';
import { ApiError } from '../_lib/errors.js';
import { parseBody, parseQuery, dateString } from '../_lib/validation.js';
import { mealPlanCreate } from '../_lib/schemas.js';
import { toCamel, toCamelList, toSnake } from '../_lib/mappers.js';

const listQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);

  if (method === 'GET') {
    const { from, to } = parseQuery(req, listQuery);
    let q = client
      .from('meal_plans')
      .select('*')
      .order('plan_date', { ascending: true })
      .order('meal_type', { ascending: true });
    if (from) q = q.gte('plan_date', from);
    if (to) q = q.lte('plan_date', to);
    const { data, error } = await q;
    if (error) throw new ApiError('INTERNAL', 'Failed to load meal plans', error);
    return toCamelList(data ?? []);
  }

  // POST - on conflict (user_id, plan_date, meal_type) the unique constraint
  // (migration 0001) returns 23505, which we surface as a CONFLICT. The UI
  // can then prompt the user to overwrite (PATCH on the existing id).
  const body = parseBody(req, mealPlanCreate);
  const row = toSnake({ ...body, userId: user.id });

  const insert = await client.from('meal_plans').insert(row).select('*').single();
  if (insert.error) {
    if ((insert.error as { code?: string }).code === '23505') {
      throw new ApiError(
        'CONFLICT',
        `A meal is already planned for ${body.planDate} ${body.mealType}`,
      );
    }
    throw new ApiError('INTERNAL', 'Failed to add meal plan', insert.error);
  }

  // Sync free-text meal name into the recipe library so it shows up in the
  // Meals tab. Replaces the buggy ensureMealInLibrary on the web client
  // (audit finding H9). Best-effort - we never block the create on this.
  if (!body.recipeId && body.mealName) {
    await client
      .from('recipes')
      .upsert(
        toSnake({
          userId: user.id,
          name: body.mealName,
          ingredients: '',
        }),
        { onConflict: 'user_id,name' },
      )
      .select('id')
      .single()
      .then(
        () => undefined,
        (err) => console.warn('[meal-plans] ensureMealInLibrary failed', err),
      );
  }

  return toCamel(insert.data);
});
