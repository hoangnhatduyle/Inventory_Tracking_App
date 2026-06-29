import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { toCamel } from '../../_lib/mappers.js';

export default authedHandler(async ({ client }, req) => {
  assertMethod(req, ['GET']);
  const barcode = String(req.query.barcode ?? '').trim();
  if (!barcode || barcode.length > 120) {
    throw new ApiError('BAD_REQUEST', 'Invalid barcode');
  }
  const { data, error } = await client
    .from('barcode_mappings')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw new ApiError('INTERNAL', 'Failed to load barcode', error);
  if (!data) throw new ApiError('NOT_FOUND', 'Barcode not found');
  return toCamel(data);
});
