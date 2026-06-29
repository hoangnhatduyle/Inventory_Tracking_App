import { authedHandler, assertMethod } from '../../../_lib/handler.js';
import { ApiError } from '../../../_lib/errors.js';
import { parseBody } from '../../../_lib/validation.js';
import { batchCreate } from '../../../_lib/schemas.js';
import { toCamel, toSnake } from '../../../_lib/mappers.js';

export default authedHandler(async ({ client }, req) => {
  const method = assertMethod(req, ['PATCH', 'DELETE']);
  const batchId = Number.parseInt(String(req.query.batchId ?? ''), 10);
  if (!Number.isFinite(batchId) || batchId <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid batch id');
  }

  if (method === 'PATCH') {
    const body = parseBody(req, batchCreate.omit({ itemId: true }).partial());
    if (Object.keys(body).length === 0) {
      throw new ApiError('BAD_REQUEST', 'No fields to update');
    }
    const { data, error } = await client
      .from('inventory_batches')
      .update(toSnake(body))
      .eq('id', batchId)
      .select('*')
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL', 'Failed to update batch', error);
    if (!data) throw new ApiError('NOT_FOUND', 'Batch not found');
    return toCamel(data);
  }

  const { error, count } = await client
    .from('inventory_batches')
    .delete({ count: 'exact' })
    .eq('id', batchId);
  if (error) throw new ApiError('INTERNAL', 'Failed to delete batch', error);
  if (!count) throw new ApiError('NOT_FOUND', 'Batch not found');
  return { deleted: true };
});
