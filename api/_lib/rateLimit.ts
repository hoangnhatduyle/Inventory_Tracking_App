import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './errors.js';

// Atomic per-user monthly quota. Delegates to the SQL function defined in
// supabase/migrations/0002_ai_quota_function.sql. The function does
// count + insert in a single statement so concurrent requests can never
// exceed the quota (audit finding H6 TOCTOU). On DB error we fail closed
// rather than open (audit finding H5).

export async function consumeAiQuotaOrThrow(opts: {
  client: SupabaseClient;
  requestType: 'expiration' | 'receipt';
  max: number;
  itemName?: string | null;
}): Promise<void> {
  const { client, requestType, max, itemName } = opts;

  const { data, error } = await client.rpc('try_consume_ai_quota', {
    p_request_type: requestType,
    p_max: max,
    p_item_name: itemName ?? null,
  });

  if (error) {
    // Fail closed: if we cannot enforce the quota, do not let the request
    // through. Logged server-side so it can be alerted on.
    console.error('[rateLimit] try_consume_ai_quota failed', error);
    throw new ApiError('INTERNAL', 'Quota check unavailable; please retry');
  }

  if (data !== true) {
    throw new ApiError(
      'QUOTA_EXCEEDED',
      `Monthly ${requestType} quota of ${max} requests reached`,
    );
  }
}
