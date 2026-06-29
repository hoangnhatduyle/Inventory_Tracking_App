import { authedHandler, assertMethod } from '../../_lib/handler.js';
import { ApiError } from '../../_lib/errors.js';
import { sendPush } from '../../_lib/push.js';
import { env } from '../../_lib/env.js';

export default authedHandler(async ({ user, client }, req) => {
  assertMethod(req, ['POST']);

  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    throw new ApiError(
      'INTERNAL',
      'Push notifications are not configured on this deployment',
    );
  }

  const { data: subs, error } = await client
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id);

  if (error) throw new ApiError('INTERNAL', 'Failed to load subscriptions', error);
  if (!subs?.length) {
    throw new ApiError('BAD_REQUEST', 'No push subscription found. Enable notifications first.');
  }

  let sent = 0;
  for (const sub of subs) {
    try {
      await sendPush(sub, {
        title: 'Test from Chắt Chiu',
        body: 'Push notifications are working.',
        url: '/settings',
        tag: 'push-test',
      });
      sent++;
    } catch (err) {
      console.warn('[push/test] delivery failed', sub.endpoint, err);
    }
  }

  if (!sent) {
    throw new ApiError('INTERNAL', 'Could not deliver test notification');
  }

  return { sent };
});
