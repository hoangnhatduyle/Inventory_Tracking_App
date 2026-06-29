import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { parseBody } from '../../_lib/validation.js';
import { expirationSuggestRequest } from '../../_lib/schemas.js';
import { consumeAiQuotaOrThrow } from '../../_lib/rateLimit.js';
import { chat, safeJsonParse } from '../../_lib/openai.js';
import { env } from '../../_lib/env.js';

// POST /api/ai/expiration-suggest
// Body: { itemName, categoryName?, storageLocation?, purchaseDate? }
// Response: { days: number, note: string }
//
// Atomic quota enforced BEFORE the OpenAI call (audit H5/H6). User-controlled
// strings are length-limited by the zod schema; the system prompt is fixed
// and never includes raw user content as instructions, only as data.

export default authedHandler(async ({ client }, req) => {
  assertMethod(req, ['POST']);
  const body = parseBody(req, expirationSuggestRequest);

  await consumeAiQuotaOrThrow({
    client,
    requestType: 'expiration',
    max: env.quotaExpiration,
    itemName: body.itemName,
  });

  const system =
    'You estimate how many days a grocery item will remain safe and palatable ' +
    'after purchase, given its category and storage location. Respond with a ' +
    'compact JSON object only: {"days": <integer>, "note": <short string>}. ' +
    'Conservative estimates; refrigeration/freezing matter; consider opened ' +
    'vs unopened packaging if mentioned. Never include disclaimers, never ' +
    'include extra fields.';

  const userPayload = {
    itemName: body.itemName,
    categoryName: body.categoryName ?? null,
    storageLocation: body.storageLocation ?? null,
    purchaseDate: body.purchaseDate ?? null,
  };

  const raw = await chat({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
    responseFormat: 'json_object',
    maxOutputTokens: 200,
  });

  const parsed = safeJsonParse<{ days?: unknown; note?: unknown }>(raw);
  if (!parsed) throw new ApiError('INTERNAL', 'AI returned malformed JSON');

  const days = Number(parsed.days);
  const note = typeof parsed.note === 'string' ? parsed.note.slice(0, 200) : '';
  if (!Number.isFinite(days) || days < 0 || days > 3650) {
    throw new ApiError('INTERNAL', 'AI returned an invalid day count');
  }

  return { days: Math.round(days), note };
});
