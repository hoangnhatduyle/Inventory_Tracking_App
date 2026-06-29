import { randomUUID } from 'node:crypto';
import { authedHandler, assertMethod } from '../_lib/handler.js';
import { ApiError } from '../_lib/errors.js';
import { parseBody } from '../_lib/validation.js';
import { signUploadRequest } from '../_lib/schemas.js';

// POST /api/uploads/sign
// Body: { scope: 'items'|'receipts', contentType, ext }
// Response: { path, token, signedUrl, expiresIn }
//
// Generates a one-shot upload URL for Supabase Storage that the browser
// uses to PUT the image directly. The path is server-chosen
// (<userId>/<scope>/<uuid>.<ext>) so the client cannot collide or escape its
// own folder; the storage RLS policy enforces the same invariant.

export default authedHandler(async ({ user, client }, req) => {
  assertMethod(req, ['POST']);
  const body = parseBody(req, signUploadRequest);

  const path = `${user.id}/${body.scope}/${randomUUID()}.${body.ext}`;

  const { data, error } = await client.storage
    .from('inventory-images')
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new ApiError('INTERNAL', 'Failed to sign upload URL', error);
  }

  return {
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    contentType: body.contentType,
    expiresIn: 60, // seconds; Supabase default for signed upload URLs
  };
});
