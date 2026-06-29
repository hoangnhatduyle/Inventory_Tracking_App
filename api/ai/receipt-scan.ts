import { z } from 'zod';
import { authedHandler, assertMethod } from '../_lib/handler.js';
import { ApiError } from '../_lib/errors.js';
import { parseBody } from '../_lib/validation.js';
import { receiptScanRequest } from '../_lib/schemas.js';
import { consumeAiQuotaOrThrow } from '../_lib/rateLimit.js';
import { chat, safeJsonParse } from '../_lib/openai.js';
import { env } from '../_lib/env.js';

// POST /api/ai/receipt-scan
// Body: { imagePath } - the storage path returned by /api/uploads/sign.
// Response: { items: [{ name, quantity, unit, price, categoryHint?, shelfLifeDaysHint? }] }
//
// The image is fetched from Supabase Storage server-side (we already verified
// the user owns the path via the schema validation) and base64-encoded for
// the OpenAI vision request. We never trust the client to send the raw image
// bytes - it must upload first via the signed URL, which is size-capped.

const itemShape = z.object({
  name: z.string().min(1).max(200),
  quantity: z.coerce.number().nonnegative().optional(),
  unit: z.string().max(30).optional(),
  price: z.coerce.number().nonnegative().optional(),
  categoryHint: z.string().max(60).optional(),
  shelfLifeDaysHint: z.coerce.number().int().nonnegative().max(3650).optional(),
});

const responseShape = z.object({
  items: z.array(itemShape).max(200),
});

// Tiny magic-byte sniffer. Returns the canonical MIME type if the buffer
// starts with the expected signature for one of the allowed formats; null
// otherwise. We do not pull in an external dep for this so the cold-start
// stays small.
function sniffImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export default authedHandler(async ({ user, client }, req) => {
  assertMethod(req, ['POST']);
  const body = parseBody(req, receiptScanRequest);

  // Defence in depth: enforce that the path's first segment is the caller's
  // user id. The schema regex already requires the shape <uuid>/<scope>/...,
  // and the storage RLS policy enforces the same constraint server-side, but
  // a wrong-user path here would just fail the storage download confusingly.
  const owner = body.imagePath.split('/')[0];
  if (owner !== user.id) {
    throw new ApiError('FORBIDDEN', 'imagePath does not belong to caller');
  }

  await consumeAiQuotaOrThrow({
    client,
    requestType: 'receipt',
    max: env.quotaReceipt,
  });

  // Download the receipt from Storage using the user-bound client so RLS still
  // applies.
  const dl = await client.storage.from('inventory-images').download(body.imagePath);
  if (dl.error || !dl.data) {
    throw new ApiError('NOT_FOUND', 'Receipt image not found in storage');
  }

  const buffer = Buffer.from(await dl.data.arrayBuffer());
  if (buffer.byteLength > 5 * 1024 * 1024) {
    throw new ApiError('PAYLOAD_TOO_LARGE', 'Receipt image exceeds 5 MiB limit');
  }
  const declaredMime = dl.data.type || 'image/jpeg';
  const sniffedMime = sniffImageMime(buffer);
  if (!sniffedMime) {
    throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 'Receipt must be a valid JPEG, PNG or WebP');
  }
  // The stored MIME (set by the client at upload time) MUST match the actual
  // file bytes; otherwise we are looking at a content-type spoof. Defence
  // against audit findings L1 / L3.
  if (declaredMime !== sniffedMime) {
    throw new ApiError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Receipt image MIME type does not match its contents',
    );
  }
  const dataUrl = `data:${sniffedMime};base64,${buffer.toString('base64')}`;

  const system =
    'You extract grocery items from a receipt photo. Return STRICT JSON: ' +
    '{"items": [{"name": string, "quantity"?: number, "unit"?: string, ' +
    '"price"?: number, "categoryHint"?: string, "shelfLifeDaysHint"?: integer}]}. ' +
    'Skip tax, totals, discounts, store info, and non-food items. Quantities ' +
    'default to 1. Prices in the receipt currency, no symbols. Maximum 200 items.';

  const raw = await chat({
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract groceries from this receipt.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
    responseFormat: 'json_object',
    maxOutputTokens: 4000,
  });

  const parsed = safeJsonParse(raw);
  const validated = responseShape.safeParse(parsed);
  if (!validated.success) {
    throw new ApiError('INTERNAL', 'AI returned malformed receipt data');
  }

  return validated.data;
});
