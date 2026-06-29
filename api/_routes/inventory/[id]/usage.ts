import { z } from 'zod';
import { authedHandler, assertMethod } from '../../../_lib/handler.js';
import { ApiError } from '../../../_lib/errors.js';
import { parseBody } from '../../../_lib/validation.js';
import { toCamel, toCamelList, toSnake } from '../../../_lib/mappers.js';
import { positiveNumber, optionalText } from '../../../_lib/validation.js';

const schema = z.object({
  amountUsed: positiveNumber,
  currentQuantity: positiveNumber,
  notes: optionalText(500),
});

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);
  const itemId = Number.parseInt(String(req.query.id ?? ''), 10);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid item id');
  }

  if (method === 'GET') {
    const { data, error } = await client
      .from('usage_history')
      .select('*')
      .eq('item_id', itemId)
      .order('recorded_at', { ascending: false });
    if (error) throw new ApiError('INTERNAL', 'Failed to load usage history', error);
    return toCamelList(data ?? []);
  }

  const body = parseBody(req, schema);
  const insert = await client
    .from('usage_history')
    .insert(
      toSnake({
        itemId,
        userId: user.id,
        amountUsed: body.amountUsed,
        remainingAmount: body.currentQuantity,
        notes: body.notes,
      }),
    )
    .select('*')
    .single();
  if (insert.error) throw new ApiError('INTERNAL', 'Failed to log usage', insert.error);

  // Keep inventory_items.current_quantity in sync.
  await client
    .from('inventory_items')
    .update({ current_quantity: body.currentQuantity })
    .eq('id', itemId)
    .then(
      () => undefined,
      (err) => console.warn('[usage] failed to update current_quantity', err),
    );

  return toCamel(insert.data);
});
