import { z } from 'zod';
import { authedHandler, assertMethod } from '../../../../_lib/handler.js';
import { ApiError } from '../../../../_lib/errors.js';
import { parseBody } from '../../../../_lib/validation.js';
import { positiveNumber } from '../../../../_lib/validation.js';

// POST /api/inventory/:id/batches/deduct
// Body: { amount }
// Atomic FIFO deduction (see supabase/migrations/0006_batch_fifo_function.sql).
export default authedHandler(async ({ client }, req) => {
  assertMethod(req, ['POST']);
  const itemId = Number.parseInt(String(req.query.id ?? ''), 10);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid item id');
  }
  const { amount } = parseBody(req, z.object({ amount: positiveNumber }));

  const { data, error } = await client.rpc('deduct_batches_fifo', {
    p_item_id: itemId,
    p_amount: amount,
  });
  if (error) throw new ApiError('INTERNAL', 'Failed to deduct from batches', error);
  if (data !== true) {
    throw new ApiError('CONFLICT', 'Requested amount exceeds available batch stock');
  }
  return { ok: true };
});
