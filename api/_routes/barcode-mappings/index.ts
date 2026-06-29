import { z } from 'zod';
import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { toCamel, toCamelList, toSnake } from '../../_lib/mappers.js';
import { optionalText, requiredText } from '../../_lib/validation.js';

const createSchema = z.object({
  barcode: requiredText(120),
  itemName: requiredText(200),
  categoryId: z.coerce.number().int().positive(),
  locationId: z.coerce.number().int().positive().optional().nullable(),
  price: z.coerce.number().nonnegative().optional().nullable(),
  suggestedShelfLifeDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  aiNote: optionalText(500),
  imagePath: optionalText(500),
});

export default authedHandler(async ({ user, client }, req) => {
  const method = assertMethod(req, ['GET', 'POST']);

  if (method === 'GET') {
    const { data, error } = await client
      .from('barcode_mappings')
      .select('*')
      .order('item_name', { ascending: true });
    if (error) throw new ApiError('INTERNAL', 'Failed to load barcodes', error);
    return toCamelList(data ?? []);
  }

  const body = parseBody(req, createSchema);
  const { data, error } = await client
    .from('barcode_mappings')
    .upsert(toSnake({ ...body, userId: user.id }), { onConflict: 'user_id,barcode' })
    .select('*')
    .single();
  if (error) throw new ApiError('INTERNAL', 'Failed to save barcode', error);
  return toCamel(data);
});
