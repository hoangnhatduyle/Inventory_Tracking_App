import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';

export default authedHandler(async ({ client }, req) => {
  assertMethod(req, ['DELETE']);
  const id = Number.parseInt(String(req.query.id ?? ''), 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ApiError('BAD_REQUEST', 'Invalid waste entry id');
  }
  const { error, count } = await client
    .from('wasted_items')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw new ApiError('INTERNAL', 'Failed to delete waste entry', error);
  if (!count) throw new ApiError('NOT_FOUND', 'Waste entry not found');
  return { deleted: true };
});
